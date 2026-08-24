import type { Format, Tournament } from '@/lib/types';
import type { CareerStats, PlayerProfile } from '@/lib/players';
import { computeStandings } from '@/lib/standings';
import { formatSpec } from '@/lib/formats';

/**
 * The numbers on the screen you land on after signing in.
 *
 * Everything here is folded out of the stored sessions on every call, for the
 * same reason standings are (`lib/standings.ts`): a score corrected three weeks
 * later has to move the totals, and derived-every-time is the only version of
 * that which cannot go stale. There is no counter to keep in sync and nothing
 * to backfill.
 *
 * A session with no scores at all is not counted as a night played. Somebody
 * who opened the form, typed four names and went home would otherwise show up
 * as an evening of padel with zero points in it, which drags every average on
 * the page down and is not a thing that happened.
 */

export interface DashboardStats {
  /** sessions with at least one score in them */
  nights: number;
  /** sessions still open, scored or not — these are the ones to resume */
  live: number;
  /** matches with a result */
  games: number;
  /** every point every player scored, added up */
  points: number;
  /** distinct people who have been on a roster, by name */
  people: number;
  lastPlayed: number | null;
  /** the format run most often, or null before anything is scored */
  favourite: Format | null;
  /** longest run of consecutive calendar weeks with a night in them */
  streakWeeks: number;
}

export function emptyDashboard(): DashboardStats {
  return {
    nights: 0,
    live: 0,
    games: 0,
    points: 0,
    people: 0,
    lastPlayed: null,
    favourite: null,
    streakWeeks: 0,
  };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function dashboardStats(tournaments: Tournament[]): DashboardStats {
  const out = emptyDashboard();
  const names = new Set<string>();
  const formats = new Map<Format, number>();
  const weeks = new Set<number>();

  for (const t of tournaments) {
    if (t.status === 'live') out.live += 1;
    for (const p of t.players) names.add(p.name.trim().toLowerCase());

    let scored = 0;
    for (const round of t.rounds) {
      for (const m of round.matches) {
        if (m.scoreA === null || m.scoreB === null) continue;
        scored += 1;
        // Both sides bank their own score, and both players on a side bank the
        // whole team score — so a 14-10 game puts 48 points into the evening.
        out.points += (m.scoreA + m.scoreB) * 2;
      }
    }
    if (scored === 0) continue;

    out.games += scored;
    out.nights += 1;
    out.lastPlayed = Math.max(out.lastPlayed ?? 0, t.createdAt);
    formats.set(t.format, (formats.get(t.format) ?? 0) + 1);
    weeks.add(Math.floor(t.createdAt / WEEK_MS));
  }

  out.people = names.size;
  out.streakWeeks = longestRun([...weeks]);

  let best: [Format, number] | null = null;
  for (const entry of formats) {
    // ties go to the format run first, which is stable across reloads
    if (!best || entry[1] > best[1]) best = entry;
  }
  out.favourite = best?.[0] ?? null;

  return out;
}

/** Longest run of consecutive integers in a set of week numbers. */
function longestRun(weeks: number[]): number {
  if (weeks.length === 0) return 0;
  const sorted = [...weeks].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1]! + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

export function favouriteFormatName(stats: DashboardStats): string | null {
  return stats.favourite === null ? null : formatSpec(stats.favourite).name;
}

/* ------------------------------------------------------------------ */

/**
 * Who is currently top of the pile.
 *
 * Ranked on points per game, not on total points — total points only measures
 * who turns up most, and the person who has played every week since March
 * would hold the crown forever regardless of how they played. A minimum of
 * two nights keeps somebody's one lucky evening off the top.
 */
export interface Standout {
  profileId: string;
  name: string;
  average: number;
  titles: number;
  sessions: number;
}

export const MIN_NIGHTS_FOR_CROWN = 2;

export function currentLeader(
  profiles: PlayerProfile[],
  stats: Map<string, CareerStats>,
): Standout | null {
  let best: Standout | null = null;
  for (const p of profiles) {
    if (p.archived) continue;
    const c = stats.get(p.id);
    if (!c || c.sessions < MIN_NIGHTS_FOR_CROWN || c.games === 0) continue;
    const row: Standout = {
      profileId: p.id,
      name: p.name,
      average: c.average,
      titles: c.titles,
      sessions: c.sessions,
    };
    if (
      !best ||
      row.average > best.average ||
      (row.average === best.average && row.titles > best.titles)
    ) {
      best = row;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */

/** A finished session's headline, for the "last night" card. */
export interface LastNight {
  id: string;
  name: string;
  playedAt: number;
  format: Format;
  winner: string | null;
  winnerPoints: number;
  players: number;
}

export function lastNight(tournaments: Tournament[]): LastNight | null {
  const played = tournaments
    .filter((t) => t.rounds.some((r) => r.matches.some((m) => m.scoreA !== null)))
    .sort((a, b) => b.createdAt - a.createdAt);
  const t = played[0];
  if (!t) return null;

  const top = computeStandings(t).find((r) => r.played > 0) ?? null;
  return {
    id: t.id,
    name: t.name,
    playedAt: t.createdAt,
    format: t.format,
    winner: top?.name ?? null,
    winnerPoints: top?.points ?? 0,
    players: t.players.length,
  };
}
