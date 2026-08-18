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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="flex flex-col">
        <span
          className={`nums text-4xl font-semibold tabular-nums ${over ? 'text-warn' : 'text-ink'}`}
        >
          {formatClock(remaining)}
        </span>
        {over ? (
          <span className="text-xs text-warn">
            over by {formatClock(elapsedMs(timer, now) - timed.minutes * 60_000)}
          </span>
        ) : (
          <span className="text-xs text-ink-faint">{timed.minutes} minute round</span>
        )}
      </div>

      <div className="flex gap-2">
        {started ? (
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 min-w-11 rounded-xl border border-line px-4 text-sm text-ink-dim active:bg-surface-2"
          >
            Reset
          </button>
        ) : null}
        <button
          type="button"
          onClick={running ? onPause : onStart}
          className="min-h-11 rounded-xl bg-accent px-6 text-sm font-semibold text-accent-ink active:opacity-70"
        >
          {running ? 'Pause' : started ? 'Resume' : 'Start'}
        </button>
      </div>
    </div>
  );
}
