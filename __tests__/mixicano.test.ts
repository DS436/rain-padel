import { describe, expect, it } from 'vitest';
import { buildMixicanoSchedule, generateMixicanoRound } from '@/lib/scheduler';
import { emptyHistory, pairKey } from '@/lib/history';
import type { PlayerIndex, RawRound } from '@/lib/types';
import { assertRoundStructure } from './helpers';

/**
 * The whole point of a mixed draw is one rule that must never bend: every team
 * is one player from each half. Everything else here is the ordinary schedule
 * invariants, re-asserted because the bipartite circle is a different
 * construction and shares none of the open draw's proof.
 */

const range = (n: number, from = 0): PlayerIndex[] =>
  Array.from({ length: n }, (_, i) => i + from);

function everyTeamIsMixed(rounds: RawRound[], groupB: Set<PlayerIndex>): boolean {
  return rounds.every((r) =>
    r.matches.every((m) =>
      [m.teamA, m.teamB].every(([x, y]) => groupB.has(x) !== groupB.has(y)),
    ),
  );
}

describe('mixed Americano', () => {
  it('never puts two from the same half on the same team', () => {
    const a = range(4);
    const b = range(4, 4);
    const { schedule } = buildMixicanoSchedule(a, b, 8, 2, 4);
    expect(everyTeamIsMixed(schedule, new Set(b))).toBe(true);
  });

  it('exhausts every cross-half pairing in one cycle, and no more', () => {
    const a = range(4);
    const b = range(4, 4);
    // the cycle is max(|A|,|B|) games, not |players| - 1
    const { schedule, stats } = buildMixicanoSchedule(a, b, 8, 2, 4);

    // 4 games x 2 courts x 2 teams = 16 teams = every A-B pair exactly once
    const pairings = schedule.flatMap((r) => r.matches.flatMap((m) => [m.teamA, m.teamB]));
    expect(pairings).toHaveLength(16);
    expect(new Set(pairings.map(([x, y]) => pairKey(x, y))).size).toBe(16);
    expect(Math.max(...stats.partnered.values())).toBe(1);
  });

  it('holds the ordinary round structure', () => {
    const { schedule } = buildMixicanoSchedule(range(4), range(4, 4), 8, 2, 4);
    for (const round of schedule) assertRoundStructure(round, 8, 2);
  });

  it('rests the surplus half evenly when the split is uneven', () => {
    // six in one half, four in the other: two of the six must sit every game
    const a = range(6);
    const b = range(4, 6);
    const { schedule } = buildMixicanoSchedule(a, b, 10, 2, 6);
    expect(everyTeamIsMixed(schedule, new Set(b))).toBe(true);

    const rests = new Map<PlayerIndex, number>();
    for (const r of schedule) for (const p of r.resting) rests.set(p, (rests.get(p) ?? 0) + 1);

    const bigHalf = a.map((p) => rests.get(p) ?? 0);
    // over the cycle the larger half shares the sit-outs rather than one person
    // carrying them all
    expect(Math.max(...bigHalf) - Math.min(...bigHalf)).toBeLessThanOrEqual(1);
  });

  it('caps at the courts available and rests the rest', () => {
    const { schedule } = buildMixicanoSchedule(range(4), range(4, 4), 8, 1, 4);
    for (const round of schedule) {
      expect(round.matches).toHaveLength(1);
      expect(round.resting).toHaveLength(4);
    }
  });

  it('continues the circle rather than replaying it after a rebuild', () => {
    const first = buildMixicanoSchedule(range(4), range(4, 4), 8, 2, 2);
    const rest = buildMixicanoSchedule(range(4), range(4, 4), 8, 2, 2, {
      startIndex: 2,
      rotationOffset: 2,
      seed: first.stats,
    });
    const all = [...first.schedule, ...rest.schedule].flatMap((r) =>
      r.matches.flatMap((m) => [m.teamA, m.teamB]),
    );
    expect(new Set(all.map(([x, y]) => pairKey(x, y))).size).toBe(all.length);
  });

  it('returns nothing rather than guessing when a half is empty', () => {
    const { schedule } = buildMixicanoSchedule([], [], 0, 2, 3);
    expect(schedule).toEqual([]);
  });
});

describe('mixed Mexicano', () => {
  it('puts two from each half on every court', () => {
    const a = range(4);
    const b = range(4, 4);
    const round = generateMixicanoRound(a, b, 8, 2, emptyHistory(), 1);
    expect(round.matches).toHaveLength(2);
    for (const m of round.matches) {
      const four = [...m.teamA, ...m.teamB];
      expect(four.filter((p) => p < 4)).toHaveLength(2);
      expect(four.filter((p) => p >= 4)).toHaveLength(2);
    }
  });

  it('keeps every team mixed', () => {
    const round = generateMixicanoRound(range(4), range(4, 4), 8, 2, emptyHistory(), 1);
    expect(everyTeamIsMixed([round], new Set(range(4, 4)))).toBe(true);
  });

  it('pairs the strongest of one half with the weaker of the other', () => {
    // court one takes A ranks 1-2 and B ranks 1-2; the balance is A1+B2 v A2+B1,
    // which is the mixed reading of Mexicano's 1+4 against 2+3
    const round = generateMixicanoRound([0, 1, 2, 3], [4, 5, 6, 7], 8, 2, emptyHistory(), 1);
    expect(round.matches[0]!.teamA).toEqual([0, 5]);
    expect(round.matches[0]!.teamB).toEqual([1, 4]);
    // and court two takes the next two from each half, the same way round
    expect(round.matches[1]!.teamA).toEqual([2, 7]);
    expect(round.matches[1]!.teamB).toEqual([3, 6]);
  });

  it('falls back to the bipartite circle for the first game', () => {
    const round = generateMixicanoRound(range(4), range(4, 4), 8, 2, emptyHistory(), 0);
    expect(round.index).toBe(0);
    expect(everyTeamIsMixed([round], new Set(range(4, 4)))).toBe(true);
  });

  it('sits people out from their own half, so the court can still be filled', () => {
    // five and four: one from the larger half sits, nobody from the smaller
    const round = generateMixicanoRound(range(5), range(4, 5), 9, 2, emptyHistory(), 1);
    expect(round.matches).toHaveLength(2);
    expect(round.resting).toHaveLength(1);
    expect(round.resting[0]).toBeLessThan(5);
  });
});
