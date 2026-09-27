'use client';

import { useEffect, useRef } from 'react';
import type { RoundTimer as TimerState, Scoring } from '@/lib/types';
import { elapsedMs, formatClock, remainingMs } from '@/lib/timer';
import { useNow } from '@/components/useNow';

/**
 * Countdown for time mode. The number is always derived from the wall clock, so
 * a locked phone or a throttled background tab cannot make it drift.
 */
export function RoundTimer({
  scoring,
  timer,
  onStart,
  onPause,
  onReset,
}: {
  scoring: Scoring;
  timer: TimerState | undefined;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}) {
  const running = timer?.running ?? false;
  const now = useNow(250, running);
  const remaining = remainingMs(scoring, timer, now);
  // narrows `scoring` for the overtime readout below; points mode has no clock
  const timed = scoring.mode === 'time' ? scoring : null;
  const crossed = useRef(false);

  useEffect(() => {
    if (remaining === null) return;
    if (remaining > 0) {
      crossed.current = false;
      return;
    }
    if (!crossed.current && running) {
      crossed.current = true;
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [remaining, running]);

  if (remaining === null || !timed) return null;
  const over = remaining < 0;
  const started = (timer?.accumulatedMs ?? 0) > 0 || running;

  return (
    <section className="card mt-5 flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className={`nums text-[44px] font-semibold leading-none tracking-[-0.02em] ${
            over ? 'text-warn' : 'text-ink'
          }`}
        >
          {formatClock(remaining)}
        </span>
        {over ? (
          <span className="nums text-xs text-warn">
            Over by {formatClock(elapsedMs(timer, now) - timed.minutes * 60_000)}
          </span>
        ) : (
          <span className="text-xs text-ink-faint">{timed.minutes} minute round</span>
        )}
      </div>

      {/* Tinted, not solid: the one solid button on this screen is Next game
          at the bottom, and the clock is the card's only tinted thing. */}
      <div className="flex flex-none items-center gap-1">
        {started ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-ink-dim active:opacity-60"
          >
            Reset
          </button>
        ) : null}
        <button
          type="button"
          onClick={running ? onPause : onStart}
          className="inline-flex h-11 min-w-[88px] items-center justify-center rounded-[12px] bg-accent-soft px-5 text-[15px] font-semibold text-accent-text active:opacity-70"
        >
          {running ? 'Pause' : started ? 'Resume' : 'Start'}
        </button>
      </div>
    </section>
  );
}
