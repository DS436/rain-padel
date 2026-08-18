import type {
  Format,
  Id,
  Scoring,
  Tournament,
} from '@/lib/types';
import { SCHEMA_VERSION } from '@/lib/types';
import { isRoundComplete } from '@/lib/history';
import {
  activeRoster,
  buildAmericanoRounds,
  canGenerate,
  nextMexicanoRound,
} from '@/lib/rounds';
import { pauseTimer, resetTimer, startTimer } from '@/lib/timer';

/**
 * Every state transition, as one pure function.
 *
 * Two rules hold everywhere:
 *   1. An invalid action returns the SAME object reference. Never throw. The UI
 *      asks `blockingReason()` first and explains why a button is disabled.
 *   2. Standings, history and round completeness are never stored. They are
 *      recomputed from `rounds`, which is what makes editing a past score
 *      correct without any invalidation logic.
 */

export interface Deps {
  newId: () => Id;
  now: () => number;
}

export type Notice =
  | { kind: 'schedule-rebuilt'; roundsFrom: number }
  | { kind: 'score-total-mismatch'; matchId: Id; total: number; target: number };

export interface State {
  tournament: Tournament | null;
  /** ephemeral UI signal; deliberately NOT part of the persisted Tournament */
  notice: Notice | null;
}

export const initialState: State = { tournament: null, notice: null };

export interface CreateInput {
  name: string;
  format: Format;
  scoring: Scoring;
  courts: number;
  plannedRounds: number;
  playerNames: string[];
  /** epoch ms the court booking ends, or null if not specified */
  courtEndsAt?: number | null;
}

export type Action =
  | { type: 'CREATE'; input: CreateInput }
  | { type: 'HYDRATE'; tournament: Tournament }
  | { type: 'SET_SCORE'; roundIndex: number; matchId: Id; scoreA: number | null; scoreB: number | null }
  | { type: 'ADVANCE_ROUND' }
  | { type: 'UNDO_ADVANCE' }
  | { type: 'ADD_PLAYER'; name: string }
  | { type: 'SET_PLAYER_ACTIVE'; playerId: Id; active: boolean }
  | { type: 'SET_PLANNED_ROUNDS'; rounds: number }
  | { type: 'SET_COURT_END'; at: number | null }
  | { type: 'DELETE_ROUND'; index: number }
  | { type: 'CLEAR_ROUND_SCORES'; index: number }
  | { type: 'START_TIMER'; roundIndex: number }
  | { type: 'PAUSE_TIMER'; roundIndex: number }
  | { type: 'RESET_TIMER'; roundIndex: number }
  | { type: 'FINISH' }
  | { type: 'REOPEN' }
  | { type: 'DISMISS_NOTICE' };

/* ------------------------------ guards ------------------------------ */

export function activeCount(t: Tournament): number {
  return t.players.filter((p) => p.active).length;
}

export function canAdvance(t: Tournament): boolean {
  return blockingReason(t) === null;
}

/** Human-readable reason the Next round button is disabled, or null if it isn't. */
export function blockingReason(t: Tournament): string | null {
  if (t.status === 'finished') return 'This session has finished.';
  const round = t.rounds[t.currentRound];
  if (!round) return 'No round to play.';

  const missing = round.matches
    .filter((m) => m.scoreA === null || m.scoreB === null)
    .map((m) => `Court ${m.courtIndex + 1}`);

  if (missing.length === 1) return `${missing[0]} needs a score`;
  if (missing.length > 1) return `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)} need scores`;
  return null;
}

export function isLastRound(t: Tournament): boolean {
  return t.currentRound >= t.plannedRounds - 1;
}

/* ------------------------------ reducer ------------------------------ */

export function createReducer(deps: Deps) {
  return function reducer(state: State, action: Action): State {
    switch (action.type) {
      case 'CREATE':
        return { tournament: createTournament(action.input, deps), notice: null };

      case 'HYDRATE':
        return { tournament: action.tournament, notice: null };

      case 'DISMISS_NOTICE':
        return state.notice === null ? state : { ...state, notice: null };

      default:
        break;
    }

    const t = state.tournament;
    if (!t) return state;

    switch (action.type) {
      case 'SET_SCORE':
        return setScore(state, t, action);

      case 'ADVANCE_ROUND': {
        if (!canAdvance(t)) return state;

        if (isLastRound(t)) {
          return { ...state, tournament: { ...t, status: 'finished' } };
        }
        const next = t.currentRound + 1;

        if (t.format === 'mexicano' && !t.rounds[next]) {
          const round = nextMexicanoRound(t, next, deps.newId);
          if (!round) return state; // fewer than 4 active players
          return { ...state, tournament: { ...t, rounds: [...t.rounds, round], currentRound: next } };
        }
        if (!t.rounds[next]) return state;
        return { ...state, tournament: { ...t, currentRound: next } };
      }

      case 'UNDO_ADVANCE': {
        // Undoing a finish just reopens the last round in place.
        if (t.status === 'finished') {
          return { ...state, tournament: { ...t, status: 'live' } };
        }
        if (t.currentRound === 0) return state;
        const back = t.currentRound - 1;

        // Mexicano's next round was derived from standings that are about to
        // change, so it cannot survive going back. Americano's is fixed.
        const rounds =
          t.format === 'mexicano' ? t.rounds.slice(0, back + 1) : t.rounds;

        return { ...state, tournament: { ...t, rounds, currentRound: back } };
      }

      case 'ADD_PLAYER': {
        const name = action.name.trim();
        if (!name) return state;
        const withPlayer: Tournament = {
          ...t,
          players: [...t.players, { id: deps.newId(), name, active: true }],
        };
        return rebuildIfAmericano(state, withPlayer, deps);
      }

      case 'SET_PLAYER_ACTIVE': {
        const player = t.players.find((p) => p.id === action.playerId);
        if (!player || player.active === action.active) return state;
        // never let the roster fall below a playable court
        if (!action.active && activeCount(t) - 1 < 4) return state;

        const withRoster: Tournament = {
          ...t,
          players: t.players.map((p) =>
            p.id === action.playerId ? { ...p, active: action.active } : p,
          ),
        };
        return rebuildIfAmericano(state, withRoster, deps);
      }

      case 'SET_PLANNED_ROUNDS': {
        // Never below the round in progress: shortening a session must drop
        // rounds that have not happened, never bin scores already entered.
        const floor = Math.max(1, t.currentRound + 1);
        const rounds = Math.max(floor, Math.floor(action.rounds));
        if (rounds === t.plannedRounds) return state;

        if (rounds < t.plannedRounds) {
          return {
            ...state,
            tournament: {
              ...t,
              plannedRounds: rounds,
              rounds: t.rounds.slice(0, rounds),
              currentRound: Math.min(t.currentRound, rounds - 1),
            },
          };
        }

        const grown: Tournament = { ...t, plannedRounds: rounds };
        if (t.format !== 'americano') return { ...state, tournament: grown };
        // prefix determinism means the already-generated rounds come back identical
        const extra = buildAmericanoRounds(grown, rounds - t.rounds.length, t.rounds.length, deps.newId);
        return { ...state, tournament: { ...grown, rounds: [...t.rounds, ...extra] } };
      }

      case 'SET_COURT_END':
        return t.courtEndsAt === action.at
          ? state
          : { ...state, tournament: { ...t, courtEndsAt: action.at } };

      case 'DELETE_ROUND': {
        // A round that never happened — cancelled, abandoned, or entered twice.
        if (t.rounds.length <= 1) return state; // always keep something to play
        if (!t.rounds[action.index]) return state;

        const rounds = t.rounds
          .filter((_, i) => i !== action.index)
          .map((r, i) => ({ ...r, index: i }));

        // Americano keeps rounds and plannedRounds in lockstep because the whole
        // schedule is materialised upfront. Mexicano generates on demand, so its
        // target just steps down by one and the session carries on.
        const plannedRounds =
          t.format === 'americano'
            ? Math.max(rounds.length, 1)
            : Math.max(t.plannedRounds - 1, rounds.length, 1);

        const currentRound = Math.min(
          action.index < t.currentRound ? t.currentRound - 1 : t.currentRound,
          rounds.length - 1,
        );

        return {
          tournament: { ...t, rounds, plannedRounds, currentRound: Math.max(0, currentRound) },
          notice: null,
        };
      }

      case 'CLEAR_ROUND_SCORES': {
        const round = t.rounds[action.index];
        if (!round) return state;
        if (round.matches.every((m) => m.scoreA === null && m.scoreB === null)) return state;

        const rounds = t.rounds.map((r, i) =>
          i !== action.index
            ? r
            : { ...r, matches: r.matches.map((m) => ({ ...m, scoreA: null, scoreB: null })) },
        );
        return { tournament: { ...t, rounds }, notice: null };
      }

      case 'START_TIMER':
      case 'PAUSE_TIMER':
      case 'RESET_TIMER':
        return applyTimer(state, t, action, deps);

      case 'FINISH':
        return t.status === 'finished' ? state : { ...state, tournament: { ...t, status: 'finished' } };

      case 'REOPEN':
        return t.status === 'live' ? state : { ...state, tournament: { ...t, status: 'live' } };

      default:
        return state;
    }
  };
}

/* ------------------------------ helpers ------------------------------ */

function createTournament(input: CreateInput, deps: Deps): Tournament {
  const players = input.playerNames
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => ({ id: deps.newId(), name, active: true }));

  const base: Tournament = {
    id: deps.newId(),
    name: input.name.trim() || 'Padel session',
    createdAt: deps.now(),
    format: input.format,
    scoring: input.scoring,
    courts: Math.max(1, Math.floor(input.courts)),
    plannedRounds: Math.max(1, Math.floor(input.plannedRounds)),
    courtEndsAt: input.courtEndsAt ?? null,
    players,
    rounds: [],
    currentRound: 0,
    status: 'live',
    schemaVersion: SCHEMA_VERSION,
  };

  if (!canGenerate(activeRoster(base).length)) return base;

  if (base.format === 'americano') {
    // the whole schedule is known upfront
    return { ...base, rounds: buildAmericanoRounds(base, base.plannedRounds, 0, deps.newId) };
  }
  // Mexicano cannot be precomputed: round 1 depends on nothing, round 2 on results
  const first = nextMexicanoRound(base, 0, deps.newId);
  return { ...base, rounds: first ? [first] : [] };
}

function setScore(
  state: State,
  t: Tournament,
  action: Extract<Action, { type: 'SET_SCORE' }>,
): State {
  const round = t.rounds[action.roundIndex];
  if (!round) return state;
  const match = round.matches.find((m) => m.id === action.matchId);
  if (!match) return state;

  const clean = (v: number | null) =>
    v === null ? null : Math.max(0, Math.floor(v));
  const scoreA = clean(action.scoreA);
  const scoreB = clean(action.scoreB);
  if (match.scoreA === scoreA && match.scoreB === scoreB) return state;

  const rounds = t.rounds.map((r, i) =>
    i !== action.roundIndex
      ? r
      : { ...r, matches: r.matches.map((m) => (m.id === action.matchId ? { ...m, scoreA, scoreB } : m)) },
  );

  // Spec 9.6: a match that stopped early is accepted, never blocked — we only
  // note it so the UI can show a soft inline warning.
  let notice: Notice | null = null;
  if (t.scoring.mode === 'points' && scoreA !== null && scoreB !== null) {
    const total = scoreA + scoreB;
    if (total !== t.scoring.target) {
      notice = { kind: 'score-total-mismatch', matchId: action.matchId, total, target: t.scoring.target };
    }
  }

  return { tournament: { ...t, rounds }, notice };
}

/**
 * Americano only: a roster change invalidates the pre-generated future.
 *
 * The immutable boundary is the current round IF any score has been entered —
 * that match is in flight, so it is frozen. An untouched current round has not
 * started yet, so the leaver's court can still be rebuilt.
 */
function rebuildIfAmericano(state: State, t: Tournament, deps: Deps): State {
  if (t.format !== 'americano' || t.status === 'finished') {
    return { ...state, tournament: t };
  }

  const current = t.rounds[t.currentRound];
  const started = current?.matches.some((m) => m.scoreA !== null || m.scoreB !== null) ?? false;
  const from = t.currentRound + (started ? 1 : 0);
  if (from >= t.plannedRounds) return { ...state, tournament: t };

  const rebuilt = buildAmericanoRounds(t, t.plannedRounds - from, from, deps.newId);
  if (rebuilt.length === 0) return { ...state, tournament: t };

  return {
    tournament: { ...t, rounds: [...t.rounds.slice(0, from), ...rebuilt] },
    notice: { kind: 'schedule-rebuilt', roundsFrom: from },
  };
}

function applyTimer(
  state: State,
  t: Tournament,
  action: Extract<Action, { type: 'START_TIMER' | 'PAUSE_TIMER' | 'RESET_TIMER' }>,
  deps: Deps,
): State {
  const round = t.rounds[action.roundIndex];
  if (!round) return state;

  const now = deps.now();
  const timer =
    action.type === 'START_TIMER'
      ? startTimer(round.timer, now)
      : action.type === 'PAUSE_TIMER'
        ? pauseTimer(round.timer, now)
        : resetTimer();

  if (round.timer && timer === round.timer) return state;

  const rounds = t.rounds.map((r, i) => {
    if (i !== action.roundIndex) return r;
    return {
      ...r,
      timer,
      // stamp each court's start once, for the CSV export
      matches:
        action.type === 'START_TIMER'
          ? r.matches.map((m) => (m.startedAt === null ? { ...m, startedAt: now } : m))
          : r.matches,
    };
  });

  return { ...state, tournament: { ...t, rounds } };
}

export { isRoundComplete };
