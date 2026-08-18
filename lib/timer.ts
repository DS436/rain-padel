import type { RoundTimer, Scoring } from '@/lib/types';

/**
 * Time-mode countdown.
 *
 * The one rule: never store a countdown and never decrement a counter. Remaining
 * time is always derived from the wall clock. iOS Safari throttles background
 * intervals to roughly once a minute, so anything that ticks drifts badly the
 * moment the organiser's phone locks — which it will, every round.
 */

export const IDLE_TIMER: RoundTimer = { startedAt: null, accumulatedMs: 0, running: false };

export function elapsedMs(timer: RoundTimer | undefined, now: number): number {
  if (!timer) return 0;
  const live = timer.running && timer.startedAt !== null ? now - timer.startedAt : 0;
  return timer.accumulatedMs + Math.max(0, live);
}

/** Null in points mode. Goes NEGATIVE when a match runs over — do not clamp. */
export function remainingMs(
  scoring: Scoring,
  timer: RoundTimer | undefined,
  now: number,
): number | null {
  if (scoring.mode !== 'time') return null;
  return scoring.minutes * 60_000 - elapsedMs(timer, now);
}

export function startTimer(timer: RoundTimer | undefined, now: number): RoundTimer {
  const t = timer ?? IDLE_TIMER;
  if (t.running) return t;
  return { startedAt: now, accumulatedMs: t.accumulatedMs, running: true };
}

export function pauseTimer(timer: RoundTimer | undefined, now: number): RoundTimer {
  const t = timer ?? IDLE_TIMER;
  if (!t.running) return t;
  return { startedAt: null, accumulatedMs: elapsedMs(t, now), running: false };
}

export function resetTimer(): RoundTimer {
  return { ...IDLE_TIMER };
}

/** "12:30", or "-1:23" once the round has overrun. */
export function formatClock(ms: number): string {
  const negative = ms < 0;
  const total = Math.floor(Math.abs(ms) / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${negative ? '-' : ''}${mins}:${String(secs).padStart(2, '0')}`;
}
