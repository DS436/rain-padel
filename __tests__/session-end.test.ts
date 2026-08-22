import { describe, expect, it } from 'vitest';
import {
  createReducer,
  gamesDroppedByFinishingNow,
  initialState,
  lastScoredGame,
  type Action,
  type CreateInput,
  type State,
} from '@/lib/tournamentReducer';
import { plannedRoundCount } from '@/lib/cycles';
import { counterIds } from './fixtures';
import type { Tournament } from '@/lib/types';

/**
 * Ending a padel night early and carrying one on past its planned end are the
 * same gesture from opposite directions, so they are tested together: both have
 * to leave every score that was actually entered exactly where it was.
 */

function harness(overrides: Partial<CreateInput> = {}) {
  const reducer = createReducer({ newId: counterIds('id'), now: () => 1_700_000_000_000 });
  const input: CreateInput = {
    name: 'Tuesday',
    format: 'americano',
    scoring: { mode: 'points', target: 24 },
    courts: 2,
    plannedRounds: 9,
    gamesPerRound: 3,
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

  /** Score game `i` and step onto game `i + 1`. */
  const playThrough = (s: State, upTo: number): State => {
    let acc = s;
    for (let i = 0; i <= upTo; i++) {
      acc = scoreAll(acc, i);
      if (i < upTo) acc = reducer(acc, { type: 'ADVANCE_ROUND' });
    }
    return acc;
  };

  return { reducer, state, run, scoreAll, playThrough };
}

const t = (s: State): Tournament => s.tournament!;

describe('FINISH_NOW', () => {
  it('drops the unplayed games and finishes on what was actually played', () => {
    const { state, run, playThrough } = harness();
    // three rounds of three games planned; two games played
    const played = playThrough(state, 1);
    expect(gamesDroppedByFinishingNow(t(played))).toBe(7);

    const done = run(played, { type: 'FINISH_NOW' });
    expect(t(done).status).toBe('finished');
    expect(t(done).rounds).toHaveLength(2);
    expect(t(done).plannedRounds).toBe(2);
    expect(t(done).currentRound).toBe(1);
  });

  it('never bins a score that was already entered', () => {
    const { state, reducer, playThrough } = harness();
    // two games done, then a single court of the third scored
    const partial = playThrough(state, 1);
    const stepped = reducer(partial, { type: 'ADVANCE_ROUND' });
    const half = reducer(stepped, {
      type: 'SET_SCORE',
      roundIndex: 2,
      matchId: t(stepped).rounds[2]!.matches[0]!.id,
      scoreA: 20,
      scoreB: 4,
    });

    const done = reducer(half, { type: 'FINISH_NOW' });
    expect(t(done).rounds).toHaveLength(3);
    expect(t(done).rounds[2]!.matches[0]!.scoreA).toBe(20);
    // the court that never played keeps its empty scores rather than a fake draw
    expect(t(done).rounds[2]!.matches[1]!.scoreA).toBeNull();
  });

  it('keeps one game even when nothing at all was scored', () => {
    const { state, run } = harness();
    expect(lastScoredGame(t(state))).toBe(-1);
    const done = run(state, { type: 'FINISH_NOW' });
    expect(t(done).rounds).toHaveLength(1);
    expect(t(done).plannedRounds).toBe(1);
    expect(t(done).status).toBe('finished');
  });
});

describe('ADD_ROUND', () => {
  it('adds a whole cycle, not a single game', () => {
    const { state, run } = harness();
    expect(plannedRoundCount(t(state))).toBe(3);
    const more = run(state, { type: 'ADD_ROUND' });
    expect(t(more).plannedRounds).toBe(12);
    expect(plannedRoundCount(t(more))).toBe(4);
  });

  it('reopens a finished session and steps onto a fresh court', () => {
    // one round of three games, all played out to the finish
    const { state, run, playThrough } = harness({ plannedRounds: 3, gamesPerRound: 3 });
    const played = playThrough(state, 2);
    const finished = run(played, { type: 'ADVANCE_ROUND' });
    expect(t(finished).status).toBe('finished');

    const again = run(finished, { type: 'ADD_ROUND' });
    expect(t(again).status).toBe('live');
    expect(t(again).currentRound).toBe(3);
    expect(t(again).rounds[3]!.matches.every((m) => m.scoreA === null)).toBe(true);
    // and the three games already played are untouched
    expect(t(again).rounds[0]!.matches[0]!.scoreA).toBe(14);
  });

  it('stays on a half-scored game rather than skipping past it', () => {
    const { state, run } = harness();
    const more = run(state, { type: 'ADD_ROUND' });
    expect(t(more).currentRound).toBe(0);
  });

  it('generates the extra round on demand for mexicano', () => {
    const { state, run, playThrough } = harness({
      format: 'mexicano',
      plannedRounds: 1,
      gamesPerRound: 1,
    });
    const played = playThrough(state, 0);
    const finished = run(played, { type: 'ADVANCE_ROUND' });
    expect(t(finished).status).toBe('finished');

    const again = run(finished, { type: 'ADD_ROUND' });
    expect(t(again).status).toBe('live');
    expect(t(again).rounds).toHaveLength(2);
    expect(t(again).currentRound).toBe(1);
  });
});
