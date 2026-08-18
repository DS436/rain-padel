import { describe, expect, it } from 'vitest';
import {
  blockingReason,
  canAdvance,
  createReducer,
  initialState,
  type Action,
  type CreateInput,
  type State,
} from '@/lib/tournamentReducer';
import { computeStandings } from '@/lib/standings';
import { counterIds } from './fixtures';
import type { Tournament } from '@/lib/types';

function harness(overrides: Partial<CreateInput> = {}) {
  const reducer = createReducer({ newId: counterIds('id'), now: () => 1_700_000_000_000 });
  const input: CreateInput = {
    name: 'Tuesday',
    format: 'americano',
    scoring: { mode: 'points', target: 24 },
    courts: 2,
    plannedRounds: 7,
    playerNames: Array.from({ length: 8 }, (_, i) => `P${i}`),
    ...overrides,
  };
  const state = reducer(initialState, { type: 'CREATE', input });
  const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s);

  const scoreAll = (s: State, roundIndex: number, a = 14, b = 10): State =>
    s.tournament!.rounds[roundIndex]!.matches.reduce(
      (acc, m) => reducer(acc, { type: 'SET_SCORE', roundIndex, matchId: m.id, scoreA: a, scoreB: b }),
      s,
    );

  return { reducer, state, run, scoreAll };
}

const t = (s: State): Tournament => s.tournament!;

describe('CREATE', () => {
  it('generates the whole americano schedule upfront with unique match ids', () => {
    const { state } = harness();
    expect(t(state).rounds).toHaveLength(7);
    expect(t(state).players).toHaveLength(8);

    const ids = t(state).rounds.flatMap((r) => r.matches.map((m) => m.id));
    expect(ids).toHaveLength(14); // 7 rounds x 2 courts
    expect(new Set(ids).size).toBe(14);
    expect(t(state).rounds.every((r) => r.matches.every((m) => m.scoreA === null))).toBe(true);
  });

  it('generates only round 1 for mexicano, because the rest depends on results', () => {
    const { state } = harness({ format: 'mexicano' });
    expect(t(state).rounds).toHaveLength(1);
  });

  it('refuses to build a schedule below four players', () => {
    const { state } = harness({ playerNames: ['A', 'B', 'C'] });
    expect(t(state).rounds).toEqual([]);
    expect(blockingReason(t(state))).toBe('No round to play.');
  });

  it('drops blank names and trims the rest', () => {
    const { state } = harness({ playerNames: ['  Sara ', '', '   ', 'Marcus'] });
    expect(t(state).players.map((p) => p.name)).toEqual(['Sara', 'Marcus']);
  });
});

describe('a complete session', () => {
  it('runs seven rounds to finished, entirely headless', () => {
    const { state, run, scoreAll } = harness();
    let s = state;

    for (let r = 0; r < 7; r++) {
      expect(canAdvance(t(s)), `round ${r} should block until scored`).toBe(false);
      s = scoreAll(s, r, 14, 10);
      expect(canAdvance(t(s))).toBe(true);
      s = run(s, { type: 'ADVANCE_ROUND' });
    }

    expect(t(s).status).toBe('finished');
    expect(t(s).currentRound).toBe(6);

    // 7 rounds x 2 courts x 4 players, every player on court every round
    const standings = computeStandings(t(s));
    expect(standings.every((row) => row.played === 7)).toBe(true);
    // Each match hands out TWICE its target across four players: both winners
    // bank 14 and both losers bank 10, so a 24-point match distributes 48.
    const MATCHES = 7 * 2;
    expect(standings.reduce((sum, row) => sum + row.points, 0)).toBe(MATCHES * 24 * 2);
  });

  it('names the courts that are still missing a score', () => {
    const { state, reducer } = harness();
    expect(blockingReason(t(state))).toBe('Court 1 and Court 2 need scores');

    const first = t(state).rounds[0]!.matches[0]!;
    const s = reducer(state, { type: 'SET_SCORE', roundIndex: 0, matchId: first.id, scoreA: 14, scoreB: 10 });
    expect(blockingReason(t(s))).toBe('Court 2 needs a score');
  });
});

describe('editing a past score', () => {
  it('recomputes standings and leaves every other round untouched', () => {
    const { state, run, scoreAll } = harness();
    let s = state;
    for (let r = 0; r < 5; r++) {
      s = scoreAll(s, r, 14, 10);
      s = run(s, { type: 'ADVANCE_ROUND' });
    }

    const before = computeStandings(t(s));
    const target = t(s).rounds[1]!.matches[0]!;
    const winner = target.teamA[0];

    const after = run(s, {
      type: 'SET_SCORE',
      roundIndex: 1,
      matchId: target.id,
      scoreA: 24,
      scoreB: 0,
    });

    const pointsFor = (rows: ReturnType<typeof computeStandings>, id: string) =>
      rows.find((r) => r.playerId === id)!.points;

    expect(pointsFor(computeStandings(t(after)), winner)).toBe(pointsFor(before, winner) + 10);

    // untouched rounds are still the very same objects
    expect(t(after).rounds[0]).toBe(t(s).rounds[0]);
    expect(t(after).rounds[2]).toBe(t(s).rounds[2]);
    expect(t(after).currentRound).toBe(t(s).currentRound);
  });

  it('accepts a total that misses the target but flags it', () => {
    const { state, reducer } = harness();
    const m = t(state).rounds[0]!.matches[0]!;
    const s = reducer(state, { type: 'SET_SCORE', roundIndex: 0, matchId: m.id, scoreA: 12, scoreB: 8 });

    expect(t(s).rounds[0]!.matches[0]!.scoreA).toBe(12); // never blocked
    expect(s.notice).toEqual({ kind: 'score-total-mismatch', matchId: m.id, total: 20, target: 24 });
  });

  it('clamps a negative score rather than storing it', () => {
    const { state, reducer } = harness();
    const m = t(state).rounds[0]!.matches[0]!;
    const s = reducer(state, { type: 'SET_SCORE', roundIndex: 0, matchId: m.id, scoreA: -5, scoreB: 29 });
    expect(t(s).rounds[0]!.matches[0]!.scoreA).toBe(0);
  });
});

describe('undo', () => {
  it('goes back a round without erasing what was typed', () => {
    const { state, run, scoreAll } = harness();
    let s = scoreAll(state, 0, 14, 10);
    s = run(s, { type: 'ADVANCE_ROUND' });
    expect(t(s).currentRound).toBe(1);

    const back = run(s, { type: 'UNDO_ADVANCE' });
    expect(t(back).currentRound).toBe(0);
    expect(t(back).rounds[0]!.matches[0]!.scoreA).toBe(14);
  });

  it('reopens a finished session in place', () => {
    const { state, run, scoreAll } = harness({ plannedRounds: 1 });
    let s = scoreAll(state, 0, 14, 10);
    s = run(s, { type: 'ADVANCE_ROUND' });
    expect(t(s).status).toBe('finished');

    const back = run(s, { type: 'UNDO_ADVANCE' });
    expect(t(back).status).toBe('live');
    expect(t(back).currentRound).toBe(0);
  });

  it('discards the mexicano round that was derived from stale standings', () => {
    const { state, run, scoreAll } = harness({ format: 'mexicano' });
    let s = scoreAll(state, 0, 20, 4);
    s = run(s, { type: 'ADVANCE_ROUND' });
    expect(t(s).rounds).toHaveLength(2);

    const generated = t(s).rounds[1]!;
    const back = run(s, { type: 'UNDO_ADVANCE' });
    expect(t(back).rounds).toHaveLength(1);

    // change the result, re-advance, and the pairings follow the new standings
    const m = t(back).rounds[0]!.matches[0]!;
    const edited = run(
      back,
      { type: 'SET_SCORE', roundIndex: 0, matchId: m.id, scoreA: 4, scoreB: 20 },
      { type: 'ADVANCE_ROUND' },
    );
    const regenerated = t(edited).rounds[1]!;
    expect(regenerated.matches.map((x) => [x.teamA, x.teamB])).not.toEqual(
      generated.matches.map((x) => [x.teamA, x.teamB]),
    );
  });

  it('keeps the americano schedule, which does not depend on results', () => {
    const { state, run, scoreAll } = harness();
    let s = scoreAll(state, 0, 14, 10);
    s = run(s, { type: 'ADVANCE_ROUND' });
    const back = run(s, { type: 'UNDO_ADVANCE' });
    expect(t(back).rounds).toHaveLength(7);
    expect(t(back).rounds[1]).toBe(t(s).rounds[1]);
  });
});

describe('roster changes mid-session', () => {
  it('freezes played rounds including their match ids, and rebuilds the rest', () => {
    const { state, run, scoreAll } = harness();
    let s = state;
    for (let r = 0; r < 2; r++) {
      s = scoreAll(s, r, 14, 10);
      s = run(s, { type: 'ADVANCE_ROUND' });
    }
    // round 2 is in flight: one court already has a score
    const inFlight = t(s).rounds[2]!.matches[0]!;
    s = run(s, { type: 'SET_SCORE', roundIndex: 2, matchId: inFlight.id, scoreA: 14, scoreB: 10 });

    const frozen = t(s).rounds.slice(0, 3);
    const leaver = t(s).players[3]!.id;
    const after = run(s, { type: 'SET_PLAYER_ACTIVE', playerId: leaver, active: false });

    expect(after.notice).toEqual({ kind: 'schedule-rebuilt', roundsFrom: 3 });
    expect(t(after).rounds.slice(0, 3)).toEqual(frozen); // ids and scores intact
    expect(t(after).rounds).toHaveLength(7);

    // the leaver never appears again
    for (const round of t(after).rounds.slice(3)) {
      const involved = [...round.matches.flatMap((m) => [...m.teamA, ...m.teamB]), ...round.resting];
      expect(involved).not.toContain(leaver);
      expect(involved).toHaveLength(7);
    }
  });

  it('rebuilds the current round too when nobody has scored it yet', () => {
    const { state, run, scoreAll } = harness();
    let s = scoreAll(state, 0, 14, 10);
    s = run(s, { type: 'ADVANCE_ROUND' }); // round 1, untouched

    const leaver = t(s).players[5]!.id;
    const after = run(s, { type: 'SET_PLAYER_ACTIVE', playerId: leaver, active: false });

    expect(after.notice).toEqual({ kind: 'schedule-rebuilt', roundsFrom: 1 });
    const involved = t(after).rounds[1]!.matches.flatMap((m) => [...m.teamA, ...m.teamB]);
    expect(involved).not.toContain(leaver);
  });

  it('slots a late arrival into the remaining rounds', () => {
    const { state, run, scoreAll } = harness();
    let s = scoreAll(state, 0, 14, 10);
    s = run(s, { type: 'ADVANCE_ROUND' }, { type: 'ADD_PLAYER', name: 'Latecomer' });

    expect(t(s).players).toHaveLength(9);
    const added = t(s).players.at(-1)!;
    const laterRounds = t(s).rounds.slice(1);
    const appears = laterRounds.some((r) =>
      r.matches.some((m) => [...m.teamA, ...m.teamB].includes(added.id)),
    );
    expect(appears).toBe(true);
    // and they are not retro-fitted into the round already played
    const round0 = t(s).rounds[0]!;
    expect(round0.matches.flatMap((m) => [...m.teamA, ...m.teamB])).not.toContain(added.id);
  });

  it('leaves mexicano alone — the next round is built from the live roster anyway', () => {
    const { state, run, scoreAll } = harness({ format: 'mexicano' });
    let s = scoreAll(state, 0, 14, 10);
    const leaver = t(s).players[2]!.id;
    s = run(s, { type: 'SET_PLAYER_ACTIVE', playerId: leaver, active: false });

    expect(s.notice).toBeNull();
    expect(t(s).rounds).toHaveLength(1);
  });
});

describe('planned round count', () => {
  it('shrinking truncates and clamps the current round', () => {
    const { state, run, scoreAll } = harness();
    let s = state;
    for (let r = 0; r < 5; r++) {
      s = scoreAll(s, r, 14, 10);
      s = run(s, { type: 'ADVANCE_ROUND' });
    }
    const after = run(s, { type: 'SET_PLANNED_ROUNDS', rounds: 3 });
    expect(t(after).rounds).toHaveLength(3);
    expect(t(after).currentRound).toBe(2);
  });

  it('growing appends rounds and leaves the existing ones identical', () => {
    const { state, run } = harness({ plannedRounds: 4 });
    const after = run(state, { type: 'SET_PLANNED_ROUNDS', rounds: 6 });
    expect(t(after).rounds).toHaveLength(6);
    expect(t(after).rounds.slice(0, 4)).toEqual(t(state).rounds);
  });
});

describe('the timer', () => {
  it('stamps each court once and banks time across pause', () => {
    let clock = 1_000;
    const reducer = createReducer({ newId: counterIds('id'), now: () => clock });
    let s = reducer(initialState, {
      type: 'CREATE',
      input: {
        name: 'Timed',
        format: 'americano',
        scoring: { mode: 'time', minutes: 15 },
        courts: 2,
        plannedRounds: 3,
        playerNames: Array.from({ length: 8 }, (_, i) => `P${i}`),
      },
    });

    s = reducer(s, { type: 'START_TIMER', roundIndex: 0 });
    expect(t(s).rounds[0]!.timer).toEqual({ startedAt: 1_000, accumulatedMs: 0, running: true });
    expect(t(s).rounds[0]!.matches.every((m) => m.startedAt === 1_000)).toBe(true);

    clock = 61_000;
    s = reducer(s, { type: 'PAUSE_TIMER', roundIndex: 0 });
    expect(t(s).rounds[0]!.timer).toEqual({ startedAt: null, accumulatedMs: 60_000, running: false });

    clock = 200_000;
    s = reducer(s, { type: 'START_TIMER', roundIndex: 0 });
    expect(t(s).rounds[0]!.timer!.accumulatedMs).toBe(60_000); // paused time is not counted

    // restarting does not re-stamp the courts
    expect(t(s).rounds[0]!.matches.every((m) => m.startedAt === 1_000)).toBe(true);
  });
});

describe('invalid actions are inert', () => {
  it('returns the identical state object rather than throwing', () => {
    const { state, reducer, run, scoreAll } = harness();

    expect(reducer(state, { type: 'SET_SCORE', roundIndex: 0, matchId: 'nope', scoreA: 1, scoreB: 2 })).toBe(state);
    expect(reducer(state, { type: 'SET_SCORE', roundIndex: 99, matchId: 'x', scoreA: 1, scoreB: 2 })).toBe(state);
    expect(reducer(state, { type: 'ADVANCE_ROUND' })).toBe(state); // nothing scored
    expect(reducer(state, { type: 'UNDO_ADVANCE' })).toBe(state); // already at round 0
    expect(reducer(state, { type: 'SET_PLAYER_ACTIVE', playerId: 'ghost', active: false })).toBe(state);
    expect(reducer(state, { type: 'REOPEN' })).toBe(state); // already live
    expect(reducer(state, { type: 'DISMISS_NOTICE' })).toBe(state); // no notice
    expect(reducer(state, { type: 'START_TIMER', roundIndex: 42 })).toBe(state);
    expect(reducer(state, { type: 'SET_PLANNED_ROUNDS', rounds: 7 })).toBe(state); // unchanged

    // writing the same score twice is a no-op
    const scored = scoreAll(state, 0, 14, 10);
    const m = t(scored).rounds[0]!.matches[0]!;
    expect(reducer(scored, { type: 'SET_SCORE', roundIndex: 0, matchId: m.id, scoreA: 14, scoreB: 10 })).toBe(scored);

    // and the roster floor holds: 8 players, 4 already out, the fifth is refused
    let s = state;
    for (const p of t(state).players.slice(0, 4)) {
      s = run(s, { type: 'SET_PLAYER_ACTIVE', playerId: p.id, active: false });
    }
    const fifth = t(s).players[4]!.id;
    expect(reducer(s, { type: 'SET_PLAYER_ACTIVE', playerId: fifth, active: false })).toBe(s);
  });

  it('ignores everything when there is no tournament loaded', () => {
    const { reducer } = harness();
    expect(reducer(initialState, { type: 'ADVANCE_ROUND' })).toBe(initialState);
  });
});
