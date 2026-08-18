import { describe, expect, it } from 'vitest';
import { buildAmericanoSchedule } from '@/lib/scheduler';
import { emptyHistory } from '@/lib/history';
import type { IndexHistory, PlayerIndex } from '@/lib/types';
import { restCounts } from './helpers';

const seedWith = (rested: [PlayerIndex, number][]): IndexHistory => ({
  ...emptyHistory<PlayerIndex>(),
  rested: new Map(rested),
});

describe('schedule seeding', () => {
  it('an empty seed is identical to passing no options', () => {
    const plain = buildAmericanoSchedule(10, 2, 9);
    const seeded = buildAmericanoSchedule(10, 2, 9, { seed: emptyHistory<PlayerIndex>() });
    expect(seeded.schedule).toEqual(plain.schedule);
  });

  it('does not mutate the seed it was handed', () => {
    const seed = seedWith([[0, 3]]);
    buildAmericanoSchedule(10, 2, 4, { seed });
    expect(seed.rested.get(0)).toBe(3);
    expect(seed.partnered.size).toBe(0);
  });

  it('spares a player who has already rested far more than the rest', () => {
    // 10 players, 2 courts -> 2 rest per round. Player 0 arrives with a big
    // rest debt, so the sum-of-squares objective should route around them.
    const withoutSeed = buildAmericanoSchedule(10, 2, 3);
    const withSeed = buildAmericanoSchedule(10, 2, 3, { seed: seedWith([[0, 6]]) });

    const restsFor = (res: ReturnType<typeof buildAmericanoSchedule>, p: number) =>
      res.schedule.filter((r) => r.resting.includes(p)).length;

    expect(restsFor(withSeed, 0)).toBe(0);
    expect(restsFor(withSeed, 0)).toBeLessThanOrEqual(restsFor(withoutSeed, 0));
    // and the load still lands somewhere
    expect(withSeed.schedule.flatMap((r) => r.resting)).toHaveLength(6);
  });

  it('rotationOffset continues the circle instead of replaying row 0', () => {
    const full = buildAmericanoSchedule(8, 2, 7);
    const tail = buildAmericanoSchedule(8, 2, 4, { rotationOffset: 3, startIndex: 3 });

    expect(tail.schedule.map((r) => r.index)).toEqual([3, 4, 5, 6]);

    // Same partnerships as rounds 3..6 of the uninterrupted schedule. Only the
    // teams are asserted here: which team faces which is decided by `opposed`,
    // and this call starts with no history, so the court matching legitimately
    // differs. The seeded case below is the one that reproduces exactly.
    const teamsOf = (r: { matches: { teamA: number[]; teamB: number[] }[] }) =>
      r.matches
        .flatMap((m) => [m.teamA, m.teamB])
        .map((t) => [...t].sort((a, b) => a - b).join('|'))
        .sort();

    expect(tail.schedule.map(teamsOf)).toEqual(full.schedule.slice(3).map(teamsOf));
  });

  it('reproduces the tail exactly when seeded with the prefix history', () => {
    // This is the regeneration path from spec 9.5: freeze rounds [0, from),
    // then rebuild the rest from that point with the history carried over.
    const full = buildAmericanoSchedule(8, 2, 7);
    const prefix = buildAmericanoSchedule(8, 2, 3);
    const tail = buildAmericanoSchedule(8, 2, 4, {
      seed: prefix.stats,
      rotationOffset: 3,
      startIndex: 3,
    });

    expect(tail.schedule).toEqual(full.schedule.slice(3));
  });

  it('without rotationOffset a regeneration would replay round 0', () => {
    const full = buildAmericanoSchedule(8, 2, 7);
    const naive = buildAmericanoSchedule(8, 2, 4, { startIndex: 3 });
    // documents why the option exists
    expect(naive.schedule[0]!.matches).toEqual(full.schedule[0]!.matches);
  });

  it('is prefix-deterministic, so extending a tournament is safe', () => {
    const short = buildAmericanoSchedule(12, 3, 5);
    const long = buildAmericanoSchedule(12, 3, 8);
    expect(long.schedule.slice(0, 5)).toEqual(short.schedule);
  });

  it('startIndex only labels rounds, it does not change them', () => {
    const a = buildAmericanoSchedule(9, 2, 4);
    const b = buildAmericanoSchedule(9, 2, 4, { startIndex: 10 });
    expect(b.schedule.map((r) => r.index)).toEqual([10, 11, 12, 13]);
    expect(b.schedule.map((r) => r.matches)).toEqual(a.schedule.map((r) => r.matches));
    expect(restCounts(b, 9)).toEqual(restCounts(a, 9));
  });
});
