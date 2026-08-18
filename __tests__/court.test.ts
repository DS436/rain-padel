import { describe, expect, it } from 'vitest';
import {
  courtFit,
  epochToTimeString,
  roundsToFit,
  timeStringToEpoch,
} from '@/lib/court';
import { makeTournament } from './fixtures';

const MIN = 60_000;
// a 24-point race is estimated at 10 minutes a round
const NOW = Date.UTC(2026, 7, 18, 18, 0, 0);

const session = (over: Parameters<typeof makeTournament>[0] = {}) =>
  makeTournament({ scoring: { mode: 'points', target: 24 }, plannedRounds: 7, ...over });

describe('court fit', () => {
  it('is null when nobody said when the court ends', () => {
    expect(courtFit(session(), NOW)).toBeNull();
  });

  it('reports a comfortable fit', () => {
    // 7 rounds to play = 70 min, booking has 120 min left
    const fit = courtFit(session({ courtEndsAt: NOW + 120 * MIN }), NOW)!;
    expect(fit.roundsLeft).toBe(7);
    expect(fit.roundsThatFit).toBe(12);
    expect(fit.overrunMs).toBe(-50 * MIN);
    expect(fit.status).toBe('fits');
  });

  it('flags an overrun with the amount', () => {
    // 7 rounds = 70 min, only 45 min left
    const fit = courtFit(session({ courtEndsAt: NOW + 45 * MIN }), NOW)!;
    expect(fit.status).toBe('over');
    expect(fit.overrunMs).toBe(25 * MIN);
    expect(fit.roundsThatFit).toBe(4);
    expect(fit.projectedFinish).toBe(NOW + 70 * MIN);
  });

  it('calls it tight when it lands within a round of the buzzer', () => {
    const fit = courtFit(session({ courtEndsAt: NOW + 75 * MIN }), NOW)!;
    expect(fit.status).toBe('tight');
  });

  it('counts only the rounds still to play', () => {
    const t = session({ courtEndsAt: NOW + 60 * MIN, currentRound: 4 });
    expect(courtFit(t, NOW)!.roundsLeft).toBe(3);
  });

  it('goes negative once the booking has run out', () => {
    const fit = courtFit(session({ courtEndsAt: NOW - 10 * MIN }), NOW)!;
    expect(fit.remainingMs).toBe(-10 * MIN);
    expect(fit.roundsThatFit).toBe(0);
    expect(fit.status).toBe('over');
  });

  it('scales with the scoring mode', () => {
    // 15-minute rounds plus 2 minutes changeover = 17 min each
    const t = session({ scoring: { mode: 'time', minutes: 15 }, courtEndsAt: NOW + 60 * MIN });
    expect(courtFit(t, NOW)!.roundsThatFit).toBe(3);
  });
});

describe('roundsToFit', () => {
  it('proposes a round count the booking can actually take', () => {
    const t = session({ courtEndsAt: NOW + 45 * MIN, currentRound: 1 });
    // 45 min holds 4 more rounds, and one is already behind us
    expect(roundsToFit(t, NOW)).toBe(5);
  });

  it('never proposes deleting a round already played', () => {
    const t = session({ courtEndsAt: NOW - 30 * MIN, currentRound: 3 });
    expect(roundsToFit(t, NOW)).toBe(4); // finish the round in progress, then stop
  });

  it('leaves the plan alone when there is no booking time set', () => {
    expect(roundsToFit(session(), NOW)).toBe(7);
  });
});

describe('time-of-day parsing', () => {
  it('round-trips a wall-clock time', () => {
    const at = timeStringToEpoch('21:30', NOW)!;
    expect(epochToTimeString(at)).toBe('21:30');
    expect(at).toBeGreaterThan(NOW);
  });

  it('rolls past midnight to the next day', () => {
    const lateNight = new Date(NOW);
    lateNight.setHours(23, 30, 0, 0);
    const at = timeStringToEpoch('00:30', lateNight.getTime())!;
    expect(at - lateNight.getTime()).toBe(60 * MIN);
  });

  it('rejects nonsense rather than guessing', () => {
    expect(timeStringToEpoch('', NOW)).toBeNull();
    expect(timeStringToEpoch('25:00', NOW)).toBeNull();
    expect(timeStringToEpoch('9pm', NOW)).toBeNull();
    expect(timeStringToEpoch('21:75', NOW)).toBeNull();
  });
});
