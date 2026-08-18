import { expect } from 'vitest';
import type { PlayerIndex, RawRound, ScheduleResult } from '@/lib/types';
import { count } from '@/lib/history';

export function maxPartnerRepeat(res: ScheduleResult): number {
  return Math.max(0, ...res.stats.partnered.values());
}

export function restCounts(res: ScheduleResult, n: number): number[] {
  return Array.from({ length: n }, (_, i) => count(res.stats.rested, i));
}

export function restSpread(res: ScheduleResult, n: number): number {
  const r = restCounts(res, n);
  return Math.max(...r) - Math.min(...r);
}

export function playersOf(round: RawRound): PlayerIndex[] {
  return round.matches.flatMap((m) => [...m.teamA, ...m.teamB]);
}

/**
 * The four structural invariants from spec section 12, asserted separately.
 *
 * The reference harness collapsed the last two into `new Set([...]).size === N`,
 * which cannot distinguish "a player appears twice" from "a player is missing" —
 * two different bugs that happen to cancel out in that check.
 */
export function assertRoundStructure(round: RawRound, n: number, courts: number): void {
  const expectCourts = Math.min(Math.floor(n / 4), courts);
  const playing = playersOf(round);

  expect(round.matches.length, 'courts in play').toBe(expectCourts);
  expect(round.resting.length, 'resting count').toBe(n - expectCourts * 4);

  // no player in two matches at once
  expect(new Set(playing).size, 'duplicate player across courts').toBe(playing.length);

  // no player both playing and resting
  const resting = new Set(round.resting);
  expect(new Set(round.resting).size, 'duplicate player in resting').toBe(round.resting.length);
  for (const p of playing) {
    expect(resting.has(p), `player ${p} both playing and resting`).toBe(false);
  }

  // everyone is accounted for exactly once
  expect(new Set([...playing, ...round.resting]).size, 'players accounted for').toBe(n);

  // court indices are 0..k-1 in order
  expect(round.matches.map((m) => m.courtIndex)).toEqual(
    Array.from({ length: expectCourts }, (_, i) => i),
  );
}
