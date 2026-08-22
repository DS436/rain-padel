import { describe, expect, it } from 'vitest';
import {
  bracketRounds,
  champion,
  knockoutStageOf,
  podiumPairs,
  seedKnockout,
  seedOrder,
  seedPairs,
  winnerOf,
} from '@/lib/knockout';
import {
  canStartKnockout,
  createReducer,
  inKnockout,
  initialState,
  type Action,
  type CreateInput,
  type State,
} from '@/lib/tournamentReducer';
import { counterIds } from './fixtures';
import type { Tournament } from '@/lib/types';

function harness(overrides: Partial<CreateInput> = {}) {
  const reducer = createReducer({ newId: counterIds('id'), now: () => 1_700_000_000_000 });
  const input: CreateInput = {
    name: 'Tuesday',
    format: 'americano',
    scoring: { mode: 'points', target: 24 },
    courts: 2,
    plannedRounds: 4,
    gamesPerRound: 1,
    playerNames: Array.from({ length: 8 }, (_, i) => `P${i}`),
    ...overrides,
  };
  const state = reducer(initialState, { type: 'CREATE', input });
  const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s);

  /** Score every court of game `i`, first side winning by `by`. */
  const scoreAll = (s: State, roundIndex: number, a = 14, b = 10): State =>
    s.tournament!.rounds[roundIndex]!.matches.reduce(
      (acc, m) => reducer(acc, { type: 'SET_SCORE', roundIndex, matchId: m.id, scoreA: a, scoreB: b }),
      s,
    );

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

describe('bracket shape', () => {
  it('keeps the top two seeds apart until the final', () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('counts its own games', () => {
    expect(bracketRounds(2)).toBe(1);
    expect(bracketRounds(4)).toBe(2);
    expect(bracketRounds(8)).toBe(3);
  });
});

describe('seeding', () => {
  it('folds individuals strongest-with-weakest so the final is not decided early', () => {
    const { state, playThrough } = harness();
    const played = playThrough(state, 0);
    const rows = t(played).players;
    const pairs = seedPairs(t(played), 4)!;

    expect(pairs).toHaveLength(4);
    // eight qualify; seed 1 is the top player with the eighth, seed 2 the
    // second with the seventh, and so on
    const flat = pairs.flatMap((p) => p.players);
    expect(new Set(flat).size).toBe(8);
    expect(pairs.map((p) => p.seed)).toEqual([1, 2, 3, 4]);
    expect(rows.some((p) => p.id === pairs[0]!.players[0])).toBe(true);
  });

  it('takes the top pairs as they are in teams mode', () => {
    const { state, playThrough } = harness({
      mode: 'teams',
      teams: Array.from({ length: 4 }, (_, i) => ({
        players: [{ name: `A${i}` }, { name: `B${i}` }] as [{ name: string }, { name: string }],
      })),
      playerNames: [],
    });
    const played = playThrough(state, 0);
    const pairs = seedPairs(t(played), 4)!;
    expect(pairs).toHaveLength(4);
    // a team's pair is the team, not a new fold
    expect(pairs.every((p) => p.players.length === 2)).toBe(true);
  });

  it('keeps every finals pair mixed in a mixed draw', () => {
    const { state, playThrough } = harness({
      mixed: { names: ['Left', 'Right'] },
      playerEntries: Array.from({ length: 8 }, (_, i) => ({
        name: `P${i}`,
        group: (i % 2) as 0 | 1,
      })),
    });
    const played = playThrough(state, 0);
    const tour = t(played);
    const groupOf = new Map(tour.players.map((p) => [p.id, p.group ?? 0] as const));
    const pairs = seedPairs(tour, 4)!;
    expect(pairs).toHaveLength(4);
    for (const p of pairs) {
      expect(groupOf.get(p.players[0])).not.toBe(groupOf.get(p.players[1]));
    }
  });

  it('refuses rather than half-filling a bracket the roster cannot fill', () => {
    const { state, playThrough } = harness({ playerNames: ['A', 'B', 'C', 'D'] });
    const played = playThrough(state, 0);
    expect(seedPairs(t(played), 4)).toBeNull();
    expect(seedPairs(t(played), 2)).not.toBeNull();
  });
});

describe('starting the knockout', () => {
  it('will not seed a bracket off a table nobody has played into', () => {
    const { state } = harness();
    expect(canStartKnockout(t(state))).toBe(false);
  });

  it('starts after everything already played and drops the unplayed plan', () => {
    const { state, run, playThrough } = harness();
    const played = playThrough(state, 1); // two games in
    expect(canStartKnockout(t(played))).toBe(true);

    const ko = run(played, { type: 'START_KNOCKOUT', size: 4, thirdPlace: false });
    const tour = t(ko);
    expect(tour.knockout!.fromGame).toBe(2);
    expect(tour.currentRound).toBe(2);
    expect(tour.plannedRounds).toBe(4); // 2 group games + semis + final
    expect(tour.rounds).toHaveLength(3);
    // semi-finals: two courts, four pairs, eight players
    expect(tour.rounds[2]!.matches).toHaveLength(2);
  });

  it('names the stage so the court card can say Semi-final rather than Court 1', () => {
    const { state, run, playThrough } = harness();
    const ko = run(playThrough(state, 1), { type: 'START_KNOCKOUT', size: 4, thirdPlace: false });
    expect(inKnockout(t(ko))).toBe(true);
    expect(knockoutStageOf(t(ko), 2)!.name).toBe('Semi-finals');
    expect(knockoutStageOf(t(ko), 2)!.labels).toEqual(['Semi-final 1', 'Semi-final 2']);
    expect(knockoutStageOf(t(ko), 3)!.name).toBe('Final');
    // and the group stage is not part of it
    expect(knockoutStageOf(t(ko), 1)).toBeNull();
  });

  it('gives the whole bracket back when cancelled', () => {
    const { state, run, playThrough } = harness();
    const ko = run(playThrough(state, 1), { type: 'START_KNOCKOUT', size: 4, thirdPlace: false });
    const back = run(ko, { type: 'CANCEL_KNOCKOUT' });
    expect(t(back).knockout).toBeNull();
    expect(t(back).rounds).toHaveLength(2);
    expect(t(back).rounds[0]!.matches[0]!.scoreA).toBe(14); // group scores survive
  });
});

describe('progressing through the bracket', () => {
  it('builds the final from the semi-final winners', () => {
    const { state, run, scoreAll, playThrough } = harness();
    const ko = run(playThrough(state, 1), { type: 'START_KNOCKOUT', size: 4, thirdPlace: false });

    const semisPlayed = scoreAll(ko, 2, 21, 9);
    const winners = t(semisPlayed).rounds[2]!.matches.map((m) => m.teamA);

    const final = run(semisPlayed, { type: 'ADVANCE_ROUND' });
    expect(t(final).currentRound).toBe(3);
    expect(t(final).rounds[3]!.matches).toHaveLength(1);

    const onCourt = new Set([
      ...t(final).rounds[3]!.matches[0]!.teamA,
      ...t(final).rounds[3]!.matches[0]!.teamB,
    ]);
    for (const id of winners.flat()) expect(onCourt.has(id)).toBe(true);
  });

  it('adds a third-place match beside the final when asked', () => {
    const { state, run, scoreAll, playThrough } = harness();
    const ko = run(playThrough(state, 1), { type: 'START_KNOCKOUT', size: 4, thirdPlace: true });
    const final = run(scoreAll(ko, 2, 21, 9), { type: 'ADVANCE_ROUND' });

    expect(t(final).rounds[3]!.matches).toHaveLength(2);
    expect(knockoutStageOf(t(final), 3)!.labels).toEqual(['Final', 'Third place']);
    // the losing semi-finalists, and nobody else
    const beaten = t(final).rounds[2]!.matches.flatMap((m) => m.teamB);
    const third = t(final).rounds[3]!.matches[1]!;
    expect(new Set([...third.teamA, ...third.teamB])).toEqual(new Set(beaten));
  });

  it('sends the better seed through on a draw rather than stalling', () => {
    const { state, run, playThrough } = harness();
    const ko = run(playThrough(state, 1), { type: 'START_KNOCKOUT', size: 4, thirdPlace: false });
    const k = t(ko).knockout!;
    const semi = t(ko).rounds[2]!.matches[0]!;
    const drawn = { ...semi, scoreA: 12, scoreB: 12 };

    const through = winnerOf(k, drawn)!;
    const sides = [semi.teamA, semi.teamB].map(
      (side) => k.pairs.find((p) => p.players.includes(side[0]))!,
    );
    expect(through.seed).toBe(Math.min(...sides.map((s) => s.seed)));
  });

  it('crowns the winner of the final and lines up the rest of the podium', () => {
    const { state, run, scoreAll, playThrough } = harness();
    const ko = run(playThrough(state, 1), { type: 'START_KNOCKOUT', size: 4, thirdPlace: true });
    const final = run(scoreAll(ko, 2, 21, 9), { type: 'ADVANCE_ROUND' });
    expect(champion(t(final))).toBeNull(); // not until the final is scored

    const done = scoreAll(final, 3, 24, 12);
    const winner = champion(t(done))!;
    expect(winner).not.toBeNull();
    expect(podiumPairs(t(done)).map((p) => p.place)).toEqual([1, 2, 3, 4]);
    expect(podiumPairs(t(done))[0]!.pair.name).toBe(winner.name);
  });

  it('finishes the session when the final is done', () => {
    const { state, run, scoreAll, playThrough } = harness();
    const ko = run(playThrough(state, 1), { type: 'START_KNOCKOUT', size: 4, thirdPlace: false });
    const final = run(scoreAll(ko, 2, 21, 9), { type: 'ADVANCE_ROUND' });
    const done = run(scoreAll(final, 3, 24, 12), { type: 'ADVANCE_ROUND' });
    expect(t(done).status).toBe('finished');
  });

  it('re-derives the final when a semi-final score is corrected', () => {
    const { state, reducer, run, scoreAll, playThrough } = harness();
    const ko = run(playThrough(state, 1), { type: 'START_KNOCKOUT', size: 4, thirdPlace: false });
    const semisPlayed = scoreAll(ko, 2, 21, 9);
    const final = run(semisPlayed, { type: 'ADVANCE_ROUND' });
    const before = new Set(final.tournament!.rounds[3]!.matches[0]!.teamA);

    // go back, flip the first semi the other way, and come forward again
    const back = reducer(final, { type: 'UNDO_ADVANCE' });
    const flipped = reducer(back, {
      type: 'SET_SCORE',
      roundIndex: 2,
      matchId: t(back).rounds[2]!.matches[0]!.id,
      scoreA: 9,
      scoreB: 21,
    });
    const again = reducer(flipped, { type: 'ADVANCE_ROUND' });
    const after = new Set(t(again).rounds[3]!.matches[0]!.teamA);
    expect(after).not.toEqual(before);
  });
});

describe('a bracket of two', () => {
  it('is just a final', () => {
    const { state, run, playThrough } = harness();
    const ko = run(playThrough(state, 1), { type: 'START_KNOCKOUT', size: 2, thirdPlace: true });
    expect(t(ko).plannedRounds).toBe(3);
    expect(knockoutStageOf(t(ko), 2)!.name).toBe('Final');
    // third place is meaningless with two pairs, so it is dropped
    expect(t(ko).knockout!.thirdPlace).toBe(false);
    expect(seedKnockout(t(ko), 2, true, 0)!.thirdPlace).toBe(false);
  });
});
