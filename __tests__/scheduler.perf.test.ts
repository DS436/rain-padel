import { describe, expect, it } from 'vitest';
import { buildAmericanoSchedule } from '@/lib/scheduler';

/**
 * Spec section 12 performance budgets.
 *
 * Median of 5 after a discarded warm-up: a single cold run on a loaded machine
 * flakes, and the budgets are meant to catch "someone replaced the circle
 * construction with a search", not millisecond noise.
 */
function medianMs(n: number, courts: number, rounds: number): number {
  buildAmericanoSchedule(n, courts, rounds); // warm up, discarded
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    buildAmericanoSchedule(n, courts, rounds);
    runs.push(performance.now() - t0);
  }
  return runs.sort((a, b) => a - b)[2]!;
}

describe('performance', () => {
  it('24 players / 6 courts / 23 rounds under 50ms', () => {
    expect(medianMs(24, 6, 23)).toBeLessThan(50);
  });

  it('40 players / 10 courts / 39 rounds under 100ms', () => {
    expect(medianMs(40, 10, 39)).toBeLessThan(100);
  });

  it('24 players / 3 courts / 23 rounds under 300ms (the court-limited path)', () => {
    // Slowest case: brute-forces team-drop combinations every round.
    expect(medianMs(24, 3, 23)).toBeLessThan(300);
  });

  it('characterises the >5000-candidate fallback at 32 players / 4 courts', () => {
    // C(16,8) = 12870 exceeds the brute-force cap, so this silently takes the
    // cheaper path that ignores the sum-of-squares objective. Not asserted as a
    // pass/fail budget — recorded so the degradation is documented rather than
    // discovered by a club on a Tuesday night. See plan risk 1.
    const res = buildAmericanoSchedule(32, 4, 31);
    const rests = Array.from({ length: 32 }, (_, i) => res.stats.rested.get(i) ?? 0);
    const spread = Math.max(...rests) - Math.min(...rests);
    console.log(`  [characterisation] 32p/4ct/31rd rest spread = ${spread}`);
    expect(spread).toBeGreaterThanOrEqual(0);
  });
});
