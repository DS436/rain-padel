import { describe, expect, it } from 'vitest';
import { buildAmericanoSchedule } from '@/lib/scheduler';
import { assertRoundStructure, maxPartnerRepeat, restSpread } from './helpers';

/** Every row of spec section 12. Numbers are measured, not aspirational. */
const PERFECT = [
  { n: 4, courts: 1, rounds: 3 },
  { n: 8, courts: 2, rounds: 7 },
  { n: 12, courts: 3, rounds: 11 },
  { n: 16, courts: 4, rounds: 15 },
  { n: 20, courts: 5, rounds: 19 },
  { n: 24, courts: 6, rounds: 23 },
];

const SIT_OUTS = [
  { n: 6, courts: 1, rounds: 5, spread: 1 },
  { n: 9, courts: 2, rounds: 8, spread: 1 },
  { n: 10, courts: 2, rounds: 9, spread: 1 },
  { n: 11, courts: 2, rounds: 10, spread: 2 },
  { n: 13, courts: 3, rounds: 12, spread: 1 },
  { n: 14, courts: 3, rounds: 10, spread: 1 },
  { n: 15, courts: 3, rounds: 14, spread: 2 },
  { n: 7, courts: 1, rounds: 6, spread: 2 },
];

const COURT_LIMITED = [
  { n: 12, courts: 1, rounds: 11, spread: 1 },
  { n: 16, courts: 2, rounds: 15, spread: 2 },
  { n: 24, courts: 3, rounds: 23, spread: 2 },
];

describe('americano — perfect rotations', () => {
  it.each(PERFECT)('$n players / $courts courts / $rounds rounds', ({ n, courts, rounds }) => {
    const res = buildAmericanoSchedule(n, courts, rounds);

    expect(res.schedule).toHaveLength(rounds);
    expect(maxPartnerRepeat(res), 'nobody partners the same person twice').toBe(1);
    expect(restSpread(res, n), 'nobody rests more than anyone else').toBe(0);
    // everyone partnered everyone exactly once
    expect(res.stats.partnered.size).toBe((n * (n - 1)) / 2);

    for (const round of res.schedule) assertRoundStructure(round, n, courts);
  });

  it('produces the three canonical pairings for 4 players', () => {
    const { schedule } = buildAmericanoSchedule(4, 1, 3);
    const seen = schedule.map((r) => {
      const m = r.matches[0]!;
      return [[...m.teamA].sort(), [...m.teamB].sort()]
        .sort((a, b) => a[0]! - b[0]!)
        .map((t) => t.join(''))
        .join('v');
    });
    expect(seen.sort()).toEqual(['01v23', '02v13', '03v12']);
  });
});

describe('americano — sit-out fairness', () => {
  it.each(SIT_OUTS)('$n players / $courts courts / $rounds rounds', ({ n, courts, rounds, spread }) => {
    const res = buildAmericanoSchedule(n, courts, rounds);

    expect(maxPartnerRepeat(res)).toBe(1);
    expect(restSpread(res, n)).toBeLessThanOrEqual(spread);
    for (const round of res.schedule) assertRoundStructure(round, n, courts);
  });
});

describe('americano — court limited', () => {
  it.each(COURT_LIMITED)('$n players / $courts courts / $rounds rounds', ({ n, courts, rounds, spread }) => {
    const res = buildAmericanoSchedule(n, courts, rounds);

    expect(maxPartnerRepeat(res)).toBe(1);
    expect(restSpread(res, n)).toBeLessThanOrEqual(spread);
    for (const round of res.schedule) assertRoundStructure(round, n, courts);
  });
});

describe('americano — beyond the cycle length', () => {
  it('repeats each partnership exactly twice, never three times', () => {
    // 5 players have 10 distinct pairs; 8 rounds demand 16 partnerships.
    const res = buildAmericanoSchedule(5, 1, 8);
    expect(maxPartnerRepeat(res)).toBe(2);
    expect(res.stats.partnered.size).toBe(10);
    for (const round of res.schedule) assertRoundStructure(round, 5, 1);
  });
});
