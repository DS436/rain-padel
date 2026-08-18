import { describe, expect, it } from 'vitest';
import {
  elapsedMs,
  formatClock,
  IDLE_TIMER,
  pauseTimer,
  remainingMs,
  resetTimer,
  startTimer,
} from '@/lib/timer';
import type { Scoring } from '@/lib/types';

const TIME: Scoring = { mode: 'time', minutes: 15 };
const POINTS: Scoring = { mode: 'points', target: 24 };

describe('elapsed time', () => {
  it('is zero before anything starts', () => {
    expect(elapsedMs(undefined, 5_000)).toBe(0);
    expect(elapsedMs(IDLE_TIMER, 5_000)).toBe(0);
  });

  it('accrues from the wall clock while running', () => {
    const t = startTimer(undefined, 1_000);
    expect(elapsedMs(t, 1_000)).toBe(0);
    expect(elapsedMs(t, 91_000)).toBe(90_000);
  });

  it('freezes on pause and resumes without counting the gap', () => {
    let t = startTimer(undefined, 0);
    t = pauseTimer(t, 60_000);
    expect(elapsedMs(t, 60_000)).toBe(60_000);
    // an hour passes with the phone locked and the timer paused
    expect(elapsedMs(t, 3_660_000)).toBe(60_000);

    t = startTimer(t, 3_660_000);
    expect(elapsedMs(t, 3_690_000)).toBe(90_000);
  });

  it('survives a serialise/restore round trip, which is the phone-lock case', () => {
    const started = startTimer(undefined, 10_000);
    const restored = JSON.parse(JSON.stringify(started));
    // the timer was never ticking in JS; the clock did the work
    expect(elapsedMs(restored, 310_000)).toBe(300_000);
  });

  it('is idempotent — starting a running timer does not reset it', () => {
    const t = startTimer(undefined, 1_000);
    expect(startTimer(t, 50_000)).toBe(t);
    const paused = pauseTimer(t, 50_000);
    expect(pauseTimer(paused, 90_000)).toBe(paused);
  });

  it('resets to idle', () => {
    const t = pauseTimer(startTimer(undefined, 0), 60_000);
    expect(elapsedMs(resetTimer(), 999_999)).toBe(0);
    expect(t.accumulatedMs).toBe(60_000); // reset does not mutate
  });
});

describe('remaining time', () => {
  it('is null in points mode', () => {
    expect(remainingMs(POINTS, startTimer(undefined, 0), 60_000)).toBeNull();
  });

  it('counts down from the configured minutes', () => {
    const t = startTimer(undefined, 0);
    expect(remainingMs(TIME, t, 0)).toBe(15 * 60_000);
    expect(remainingMs(TIME, t, 5 * 60_000)).toBe(10 * 60_000);
  });

  it('goes negative rather than clamping, because matches run over', () => {
    const t = startTimer(undefined, 0);
    expect(remainingMs(TIME, t, 16 * 60_000)).toBe(-60_000);
  });
});

describe('formatClock', () => {
  it('renders minutes and padded seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9_000)).toBe('0:09');
    expect(formatClock(90_000)).toBe('1:30');
    expect(formatClock(15 * 60_000)).toBe('15:00');
  });

  it('marks overtime with a leading minus', () => {
    expect(formatClock(-83_000)).toBe('-1:23');
  });
});
