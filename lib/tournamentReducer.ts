import type {
  Format,
  Id,
  KnockoutSize,
  MixedDraw,
  PlayMode,
  RosterEntry,
  Scoring,
  Team,
  Tournament,
} from '@/lib/types';
import { SCHEMA_VERSION } from '@/lib/types';
import { isRoundComplete } from '@/lib/history';
import {
  activeTeams,
  buildScheduledRounds,
  canGenerateAny,
  nextAdaptiveRound,
} from '@/lib/rounds';
import { defaultGamesPerRound, gamesPerRound } from '@/lib/cycles';
import {
  bracketRounds,
  buildKnockoutRound,
  knockoutStageOf,
  seedKnockout,
} from '@/lib/knockout';
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

export interface TeamInput {
  /** blank falls back to "Ana & Ben" */
  name?: string;
  players: [RosterEntry, RosterEntry];
}

export interface CreateInput {
  name: string;
  format: Format;
  /** defaults to 'individual' — the mode every session had before v2 */
  mode?: PlayMode;
  /** individual mode only: every team is one player from each half */
  mixed?: MixedDraw | null;
  scoring: Scoring;
  courts: number;
  /** total GAMES to play. The UI thinks in rounds; `lib/cycles.ts` converts. */
  plannedRounds: number;
  /** individual mode, names only */
  playerNames: string[];
  /** individual mode, when the names came from the squad. Wins over playerNames. */
  playerEntries?: RosterEntry[];
  /** teams mode */
  teams?: TeamInput[];
  /** games that make up one round. Defaults to unitCount - 1. */
  gamesPerRound?: number;
  /** epoch ms the court booking ends, or null if not specified */
  courtEndsAt?: number | null;
}

export type Action =
  | { type: 'CREATE'; input: CreateInput }
  | { type: 'HYDRATE'; tournament: Tournament }
  | { type: 'SET_SCORE'; roundIndex: number; matchId: Id; scoreA: number | null; scoreB: number | null }
  | { type: 'ADVANCE_ROUND' }
  | { type: 'UNDO_ADVANCE' }
  | { type: 'ADD_PLAYER'; name: string; group?: 0 | 1 }
  | { type: 'SET_PLAYER_GROUP'; playerId: Id; group: 0 | 1 }
  | { type: 'START_KNOCKOUT'; size: KnockoutSize; thirdPlace: boolean }
  | { type: 'CANCEL_KNOCKOUT' }
  | { type: 'ADD_TEAM'; names: [string, string]; teamName?: string }
  | { type: 'SET_PLAYER_ACTIVE'; playerId: Id; active: boolean }
  | { type: 'SET_TEAM_ACTIVE'; teamId: Id; active: boolean }
  | { type: 'SET_GAMES_PER_ROUND'; games: number }
  | { type: 'SET_PLANNED_ROUNDS'; rounds: number }
  | { type: 'ADD_ROUND' }
  | { type: 'FINISH_NOW' }
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

/** The floor below which no court can be filled, in the session's own unit. */
export function unitFloor(t: Tournament): number {
  return t.mode === 'teams' ? 2 : 4;
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

/** True while the session is playing bracket games rather than the group stage. */
export function inKnockout(t: Tournament): boolean {
  return knockoutStageOf(t, t.currentRound) !== null;
}

/**
 * The knockout can only start on a clean boundary: after the game in progress,
 * and only from a group stage that has actually produced a table. Offering it
 * before anyone has played would seed the bracket on entry order.
 */
export function canStartKnockout(t: Tournament): boolean {
  return t.knockout === null && lastScoredGame(t) >= 0;
}

/**
 * The last game anybody has put a number against, or -1 for a session that has
 * not started. This is the line `FINISH_NOW` cuts at: everything above it never
 * happened, everything at or below it is somebody's actual night.
 */
export function lastScoredGame(t: Tournament): number {
  let last = -1;
  for (let i = 0; i < t.rounds.length; i++) {
    if (t.rounds[i]!.matches.some((m) => m.scoreA !== null || m.scoreB !== null)) last = i;
  }
  return last;
}

/** How many planned games would be thrown away by ending the session now. */
export function gamesDroppedByFinishingNow(t: Tournament): number {
  return Math.max(0, t.plannedRounds - Math.max(1, lastScoredGame(t) + 1));
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

        // Inside the bracket the next game is the winners of this one, whatever
        // the session's format is — sudden death does not re-rank a table.
        if (knockoutStageOf(t, next)) {
          const round = buildKnockoutRound(t, next, deps.newId);
          if (!round) return state;
          return {
            ...state,
            tournament: {
              ...t,
              rounds: [...t.rounds.slice(0, next), round],
              currentRound: next,
            },
          };
        }

        if (t.format === 'mexicano' && !t.rounds[next]) {
          const round = nextAdaptiveRound(t, next, deps.newId);
          if (!round) return state; // not enough of the roster left to fill a court
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
        // A lone player cannot join a teams session — they have nobody to pair
        // with. ADD_TEAM is the teams-mode equivalent.
        if (t.mode === 'teams') return state;
        const name = action.name.trim();
        if (!name) return state;
        const arrival = t.mixed
          ? { id: deps.newId(), name, active: true, group: action.group ?? 0 }
          : { id: deps.newId(), name, active: true };
        const withPlayer: Tournament = { ...t, players: [...t.players, arrival] };
        return rebuildIfAmericano(state, withPlayer, deps);
      }

      case 'ADD_TEAM': {
        if (t.mode !== 'teams') return state;
        const names = action.names.map((n) => n.trim());
        if (names.some((n) => !n)) return state;
        const players = names.map((name) => ({ id: deps.newId(), name, active: true }));
        const team: Team = {
          id: deps.newId(),
          name: action.teamName?.trim() || defaultTeamName(names as [string, string]),
          players: [players[0]!.id, players[1]!.id],
          active: true,
        };
        const withTeam: Tournament = {
          ...t,
          players: [...t.players, ...players],
          teams: [...t.teams, team],
        };
        return rebuildIfAmericano(state, withTeam, deps);
      }

      case 'SET_PLAYER_ACTIVE': {
        const player = t.players.find((p) => p.id === action.playerId);
        if (!player || player.active === action.active) return state;
        // A pair leaves together, so route the toggle through the team.
        if (t.mode === 'teams') {
          const team = t.teams.find((tm) => tm.players.includes(action.playerId));
          if (!team) return state;
          return setTeamActive(state, t, team.id, action.active, deps);
        }
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

      case 'SET_TEAM_ACTIVE':
        return setTeamActive(state, t, action.teamId, action.active, deps);

      case 'SET_GAMES_PER_ROUND': {
        // Pure relabelling: the schedule is untouched, only how it is grouped.
        const games = Math.max(1, Math.floor(action.games));
        if (games === t.gamesPerRound) return state;
        return { ...state, tournament: { ...t, gamesPerRound: games } };
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
        const extra = buildScheduledRounds(grown, rounds - t.rounds.length, t.rounds.length, deps.newId);
        return { ...state, tournament: { ...grown, rounds: [...t.rounds, ...extra] } };
      }

      case 'ADD_ROUND': {
        // "One more round" — the request people actually make, which is why it
        // is one action rather than asking them to do the arithmetic in the
        // rounds sheet. A finished session reopens; a session sitting on a
        // fully-scored game steps straight onto the fresh court.
        const per = gamesPerRound(t);
        const live: State = { ...state, tournament: { ...t, status: 'live' } };
        const grown = reducer(live, { type: 'SET_PLANNED_ROUNDS', rounds: t.plannedRounds + per });
        const gt = grown.tournament;
        if (!gt) return state;
        // blockingReason() is null exactly when the current game is complete.
        return blockingReason(gt) === null ? reducer(grown, { type: 'ADVANCE_ROUND' }) : grown;
      }

      case 'FINISH_NOW': {
        // Stop here and call it. Every game that has a score is kept — including
        // a part-scored one, because those points are real — and every planned
        // game above that is dropped, so the standings on screen are the final
        // standings with nothing outstanding to tally.
        const keep = Math.max(1, lastScoredGame(t) + 1);
        const rounds = t.rounds.slice(0, keep);
        if (t.status === 'finished' && rounds.length === t.rounds.length && keep === t.plannedRounds) {
          return state;
        }
        return {
          tournament: {
            ...t,
            rounds,
            plannedRounds: keep,
            currentRound: Math.max(0, Math.min(t.currentRound, rounds.length - 1)),
            status: 'finished',
          },
          notice: null,
        };
      }

      case 'SET_PLAYER_GROUP': {
        // Only meaningful in a mixed draw, and it changes who can partner whom,
        // so the unplayed remainder of the schedule has to be rebuilt.
        if (!t.mixed) return state;
        const player = t.players.find((p) => p.id === action.playerId);
        if (!player || player.group === action.group) return state;
        const moved: Tournament = {
          ...t,
          players: t.players.map((p) =>
            p.id === action.playerId ? { ...p, group: action.group } : p,
          ),
        };
        return rebuildIfAmericano(state, moved, deps);
      }

      case 'START_KNOCKOUT': {
        if (!canStartKnockout(t)) return state;

        // The bracket begins after everything already played. A game in
        // progress with scores on it is somebody's actual game and is kept.
        const fromGame = lastScoredGame(t) + 1;
        const knockout = seedKnockout(t, action.size, action.thirdPlace, fromGame);
        if (!knockout) return state; // not enough of the roster left to fill it

        const staged: Tournament = {
          ...t,
          knockout,
          status: 'live',
          rounds: t.rounds.slice(0, fromGame),
          plannedRounds: fromGame + bracketRounds(action.size),
          currentRound: fromGame,
        };
        const first = buildKnockoutRound(staged, fromGame, deps.newId);
        if (!first) return state;
        return { tournament: { ...staged, rounds: [...staged.rounds, first] }, notice: null };
      }

      case 'CANCEL_KNOCKOUT': {
        // Back to a plain leaderboard night. Bracket games are dropped whole:
        // half a knockout is not a result anybody would want kept.
        if (!t.knockout) return state;
        const { fromGame } = t.knockout;
        const rounds = t.rounds.slice(0, fromGame);
        return {
          tournament: {
            ...t,
            knockout: null,
            rounds,
            plannedRounds: Math.max(1, rounds.length),
            currentRound: Math.max(0, Math.min(t.currentRound, rounds.length - 1)),
            status: 'live',
          },
          notice: null,
        };
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

export function defaultTeamName(names: [string, string]): string {
  return `${names[0]} & ${names[1]}`;
}

/** `profileId` is only written when there is one — an absent key stays absent. */
function makePlayer(e: RosterEntry, deps: Deps, mixed = false): Tournament['players'][number] {
  const base = { id: deps.newId(), name: e.name, active: true };
  const withProfile = e.profileId ? { ...base, profileId: e.profileId } : base;
  return mixed ? { ...withProfile, group: e.group === 1 ? 1 : 0 } : withProfile;
}

function createTournament(input: CreateInput, deps: Deps): Tournament {
  const mode: PlayMode = input.mode ?? 'individual';
  // A mixed draw constrains who may partner whom. Fixed pairs have already
  // answered that question, so the two cannot both apply.
  const mixed: MixedDraw | null = mode === 'teams' ? null : (input.mixed ?? null);

  // In teams mode the pairs ARE the roster: every player still gets a row in
  // `players`, because scores, avatars and the export are all keyed on players.
  const players: Tournament['players'] = [];
  const teams: Team[] = [];

  if (mode === 'teams') {
    for (const raw of input.teams ?? []) {
      const entries = raw.players.map((e) => ({ ...e, name: e.name.trim() }));
      if (entries.some((e) => !e.name)) continue;
      const pair = entries.map((e) => makePlayer(e, deps));
      players.push(...pair);
      teams.push({
        id: deps.newId(),
        name: raw.name?.trim() || defaultTeamName([entries[0]!.name, entries[1]!.name]),
        players: [pair[0]!.id, pair[1]!.id],
        active: true,
      });
    }
  } else {
    const entries: RosterEntry[] =
      input.playerEntries ?? input.playerNames.map((name) => ({ name }));
    for (const e of entries) {
      const name = e.name.trim();
      if (name) players.push(makePlayer({ ...e, name }, deps, mixed !== null));
    }
  }

  const units = mode === 'teams' ? teams.length : players.length;
  // A mixed cycle is as long as the LARGER half, not the whole field: eight
  // players split four and four is four games, where an open draw is seven.
  const split: [number, number] | undefined = mixed
    ? [players.filter((p) => p.group !== 1).length, players.filter((p) => p.group === 1).length]
    : undefined;

  const base: Tournament = {
    id: deps.newId(),
    name: input.name.trim() || 'Padel session',
    createdAt: deps.now(),
    format: input.format,
    mode,
    mixed,
    scoring: input.scoring,
    courts: Math.max(1, Math.floor(input.courts)),
    plannedRounds: Math.max(1, Math.floor(input.plannedRounds)),
    gamesPerRound: Math.max(
      1,
      Math.floor(input.gamesPerRound ?? defaultGamesPerRound(units, mode, split)),
    ),
    courtEndsAt: input.courtEndsAt ?? null,
    players,
    teams,
    rounds: [],
    currentRound: 0,
    knockout: null,
    status: 'live',
    schemaVersion: SCHEMA_VERSION,
  };

  if (!canGenerateAny(base)) return base;

  if (base.format === 'americano') {
    // the whole schedule is known upfront
    return { ...base, rounds: buildScheduledRounds(base, base.plannedRounds, 0, deps.newId) };
  }
  // Mexicano cannot be precomputed: game 1 depends on nothing, game 2 on results
  const first = nextAdaptiveRound(base, 0, deps.newId);
  return { ...base, rounds: first ? [first] : [] };
}

/**
 * A pair leaves or comes back as one. Both members follow the team flag so the
 * scoreboard dims them together and nothing can schedule half a team.
 */
function setTeamActive(
  state: State,
  t: Tournament,
  teamId: Id,
  active: boolean,
  deps: Deps,
): State {
  const team = t.teams.find((tm) => tm.id === teamId);
  if (!team || team.active === active) return state;
  // two pairs is the minimum for one court
  if (!active && activeTeams(t).length - 1 < 2) return state;

  const members = new Set<Id>(team.players);
  const withRoster: Tournament = {
    ...t,
    teams: t.teams.map((tm) => (tm.id === teamId ? { ...tm, active } : tm)),
    players: t.players.map((p) => (members.has(p.id) ? { ...p, active } : p)),
  };
  return rebuildIfAmericano(state, withRoster, deps);
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
  // A bracket is fixtures, not a rotation. Somebody leaving does not re-draw
  // the semi-finals; it is handled at the net, the way it would be in real life.
  if (t.format !== 'americano' || t.status === 'finished' || t.knockout) {
    return { ...state, tournament: t };
  }

  const current = t.rounds[t.currentRound];
  const started = current?.matches.some((m) => m.scoreA !== null || m.scoreB !== null) ?? false;
  const from = t.currentRound + (started ? 1 : 0);
  if (from >= t.plannedRounds) return { ...state, tournament: t };

  const rebuilt = buildScheduledRounds(t, t.plannedRounds - from, from, deps.newId);
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
