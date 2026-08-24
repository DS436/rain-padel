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

  it('keeps the americano generator\u2019s court and rest shape on round 0', () => {
    // The DRAW is random now, but the shape it is laid into is not: same number
    // of courts, same number of sit-outs, everyone accounted for exactly once.
    const viaAmericano = buildAmericanoSchedule(10, 2, 1).schedule[0]!;
    const viaMexicano = generateMexicanoRound(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      2,
      history(),
      0,
      seededRng('shape', 0),
    );
    expect(viaMexicano.matches.length).toBe(viaAmericano.matches.length);
    expect(viaMexicano.resting.length).toBe(viaAmericano.resting.length);
    assertRoundStructure(viaMexicano, 10, 2);
  });
});

/**
 * Round one has no leaderboard to build from, so a deterministic opener is
 * really seeding by the order names were typed in \u2014 the organiser\u2019s mates,
 * entered first, would partner each other every week. The published format
 * says random draw, and this is that.
 */
describe('mexicano \u2014 round one is a random draw', () => {
  const ROSTER = [0, 1, 2, 3, 4, 5, 6, 7];

  it('does not simply replay the circle-method opener', () => {
    const circle = buildAmericanoSchedule(8, 2, 1).schedule[0]!;
    const key = (r: { matches: { teamA: PlayerIndex[]; teamB: PlayerIndex[] }[] }) =>
      JSON.stringify(r.matches);

    // Asserting on a single seed would only be asserting on mulberry32, so
    // this looks at the spread: the draw has to actually vary, and the fixed
    // opener must not be what almost every seed lands on.
    const SEEDS = 40;
    const drawn: string[] = [];
    for (let s = 0; s < SEEDS; s++) {
      drawn.push(key(generateMexicanoRound(ROSTER, 2, history(), 0, seededRng('draw', s))));
    }
    expect(new Set(drawn).size, 'the draw never varies').toBeGreaterThan(SEEDS / 2);
    const asBefore = drawn.filter((d) => d === key(circle)).length;
    expect(asBefore, 'the draw is still effectively fixed').toBeLessThan(SEEDS / 4);
  });

  it('gives different people the top court across seeds', () => {
    const firstCourt = new Set<PlayerIndex>();
    for (let s = 0; s < 40; s++) {
      const round = generateMexicanoRound(ROSTER, 2, history(), 0, seededRng('court', s));
      for (const p of round.matches[0]!.teamA) firstCourt.add(p);
    }
    // If the draw were fixed, only two players would ever open on court one.
    expect(firstCourt.size).toBeGreaterThan(2);
  });

  it('still puts every player on court exactly once, whatever the draw', () => {
    for (let s = 0; s < 40; s++) {
      const round = generateMexicanoRound([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 2, history(), 0, seededRng('safe', s));
      assertRoundStructure(round, 10, 2);
    }
  });

  it('draws only from the active roster', () => {
    // 8 registered, ids 0 and 3 dropped out before the first serve.
    const ranking = [1, 2, 4, 5, 6, 7];
    for (let s = 0; s < 20; s++) {
      const round = generateMexicanoRound(ranking, 1, history(), 0, seededRng('active', s));
      for (const p of [...playersOf(round), ...round.resting]) {
        expect(ranking, `player ${p} is not on the active roster`).toContain(p);
      }
      assertRoundStructure(round, 6, 1);
    }
  });

  it('is reproducible \u2014 a reload redraws the same first round', () => {
    // Nothing about a round is persisted beyond its result, so the draw has to
    // come back identical from the same tournament id or a refresh mid-round
    // would move people between courts.
    const a = generateMexicanoRound(ROSTER, 2, history(), 0, seededRng('tourn-9', 0));
    const b = generateMexicanoRound(ROSTER, 2, history(), 0, seededRng('tourn-9', 0));
    expect(a).toEqual(b);
  });
});
