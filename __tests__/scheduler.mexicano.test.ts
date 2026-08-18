import { describe, expect, it } from 'vitest';
import { buildAmericanoSchedule, generateMexicanoRound } from '@/lib/scheduler';
import { emptyHistory } from '@/lib/history';
import { seededRng } from '@/lib/rng';
import type { IndexHistory, PlayerIndex } from '@/lib/types';
import { assertRoundStructure, playersOf } from './helpers';

const history = (over: Partial<IndexHistory> = {}): IndexHistory => ({
  ...emptyHistory<PlayerIndex>(),
  ...over,
});

describe('mexicano — round 0 index mapping (regression)', () => {
  it('returns players drawn from the ranking, not positions within it', () => {
    // Deliberately not the identity permutation.
    const ranking = [3, 1, 0, 2];
    const round = generateMexicanoRound(ranking, 1, history(), 0);

    const touched = [...playersOf(round), ...round.resting].sort((a, b) => a - b);
    expect(touched).toEqual([0, 1, 2, 3]);
  });

  it('never invents a player outside the active roster', () => {
    // The failing shape: 8 players registered, ids 0 and 3 have dropped out.
    const ranking = [1, 2, 4, 5, 6, 7];
    const round = generateMexicanoRound(ranking, 1, history(), 0);

    for (const p of [...playersOf(round), ...round.resting]) {
      expect(ranking, `player ${p} is not on the active roster`).toContain(p);
    }
    assertRoundStructure(round, 6, 1);
  });
});

describe('mexicano — ranked re-pairing', () => {
  it('puts the four highest ranked on court 0, paired 1+4 against 2+3', () => {
    const ranking = [5, 2, 7, 0, 1, 6, 3, 4]; // standings order, strongest first
    const round = generateMexicanoRound(ranking, 2, history(), 1);

    const top = round.matches[0]!;
    expect(top.courtIndex).toBe(0);
    expect(top.teamA).toEqual([5, 0]); // rank 1 + rank 4
    expect(top.teamB).toEqual([2, 7]); // rank 2 + rank 3

    // court 1 holds the next four, same split
    expect(round.matches[1]!.teamA).toEqual([1, 4]);
    expect(round.matches[1]!.teamB).toEqual([6, 3]);
  });

  it('rests the least-rested first, then whoever has played most', () => {
    const ranking = [0, 1, 2, 3, 4, 5];
    const h = history({
      rested: new Map([[0, 2], [1, 2], [2, 0], [3, 1], [4, 1], [5, 1]]),
      played: new Map([[3, 5], [4, 9], [5, 1]]),
    });
    // 6 players, 1 court -> 2 rest. Lowest rested is player 2 (0 rests);
    // then a three-way tie on 1 rest, broken by most played -> player 4.
    const round = generateMexicanoRound(ranking, 1, h, 1);
    expect(round.resting.sort((a, b) => a - b)).toEqual([2, 4]);
  });
});

describe('mexicano — tie-breaking does not punish the leaders', () => {
  it('spreads sit-outs across the field when everyone is tied', () => {
    // Round 2 of a 10-player, 2-court session: all eight who played have
    // rested=0, played=1. A stable sort with no third key would bench
    // ranking[0] and ranking[1] — the two leaders — every single time.
    const ranking = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const h = history({
      played: new Map(ranking.map((p) => [p, 1] as const)),
    });

    const benched = new Set<PlayerIndex>();
    let leaderBenched = 0;
    const SEEDS = 60;
    for (let s = 0; s < SEEDS; s++) {
      const round = generateMexicanoRound(ranking, 2, h, 1, seededRng('t', s));
      expect(round.resting).toHaveLength(2);
      for (const p of round.resting) benched.add(p);
      if (round.resting.includes(ranking[0]!)) leaderBenched++;
    }

    // every player takes a turn on the bench across the seed space
    expect(benched.size).toBe(10);
    // and the leader is not singled out — the unfixed version scored 60/60 here
    expect(leaderBenched).toBeGreaterThan(0);
    expect(leaderBenched).toBeLessThan(SEEDS / 2);
  });

  it('is reproducible for a given tournament and round', () => {
    const ranking = [0, 1, 2, 3, 4, 5];
    const h = history();
    const a = generateMexicanoRound(ranking, 1, h, 3, seededRng('tourn-1', 3));
    const b = generateMexicanoRound(ranking, 1, h, 3, seededRng('tourn-1', 3));
    expect(a).toEqual(b);
  });
});

describe('mexicano — structure', () => {
  it('holds the invariants across a simulated session', () => {
    let ranking = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let r = 0; r < 6; r++) {
      const round = generateMexicanoRound(ranking, 2, history(), r, seededRng('sim', r));
      assertRoundStructure(round, 10, 2);
      // pretend the standings reshuffled
      ranking = [...ranking].reverse();
    }
  });

  it('agrees with the americano generator on round 0 shape', () => {
    const viaAmericano = buildAmericanoSchedule(8, 2, 1).schedule[0]!;
    const viaMexicano = generateMexicanoRound([0, 1, 2, 3, 4, 5, 6, 7], 2, history(), 0);
    expect(viaMexicano.matches).toEqual(viaAmericano.matches);
  });
});
