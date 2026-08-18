import type { Tournament } from '@/lib/types';
import { minutesPerRound } from '@/lib/format';

/**
 * Court time is the real constraint on a padel night — the booking ends whether
 * or not the rounds are finished. This works out whether the plan still fits,
 * so the organiser can add or drop rounds on purpose rather than discovering
 * the problem at 21:05 with two rounds left.
 */
export interface CourtFit {
  endsAt: number;
  /** ms of booking left; negative once the booking has run out */
  remainingMs: number;
  /** rounds still to play, including the one in progress */
  roundsLeft: number;
  /** how many rounds the remaining time actually allows */
  roundsThatFit: number;
  /** when the current plan would finish */
  projectedFinish: number;
  /** ms past the booking the plan would run; <= 0 means it fits */
  overrunMs: number;
  status: 'fits' | 'tight' | 'over';
}

export function perRoundMs(t: Tournament): number {
  return minutesPerRound(t.scoring) * 60_000;
}

export function courtFit(t: Tournament, now: number): CourtFit | null {
  if (t.courtEndsAt === null) return null;

  const per = perRoundMs(t);
  const remainingMs = t.courtEndsAt - now;
  const roundsLeft = Math.max(0, t.plannedRounds - t.currentRound);
  const projectedFinish = now + roundsLeft * per;
  const overrunMs = projectedFinish - t.courtEndsAt;

  return {
    endsAt: t.courtEndsAt,
    remainingMs,
    roundsLeft,
    roundsThatFit: Math.max(0, Math.floor(remainingMs / per)),
    projectedFinish,
    overrunMs,
    // within one round of the buzzer is "tight" — worth flagging, not alarming
    status: overrunMs > 0 ? 'over' : overrunMs > -per ? 'tight' : 'fits',
  };
}

/** The plannedRounds value that would just fit the remaining booking. */
export function roundsToFit(t: Tournament, now: number): number {
  const fit = courtFit(t, now);
  if (!fit) return t.plannedRounds;
  // never propose deleting a round that has already been played
  return Math.max(t.currentRound + 1, t.currentRound + fit.roundsThatFit);
}

export function formatTimeOfDay(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** "HH:MM" on the same day as `reference`, rolled to tomorrow if already past. */
export function timeStringToEpoch(value: string, reference: number): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const mins = Number(m[2]);
  if (hours > 23 || mins > 59) return null;

  const d = new Date(reference);
  d.setHours(hours, mins, 0, 0);
  // a session started at 23:30 and booked "until 00:30" means tomorrow
  if (d.getTime() < reference) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function epochToTimeString(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
