import type { Id, Tournament } from '@/lib/types';
import { computeStandings } from '@/lib/standings';

/**
 * The squad — players that outlive a single night.
 *
 * A `Player` is a name on one session's roster. A `PlayerProfile` is a person,
 * saved once and picked from every week, which is what makes a career record
 * possible at all. The link is `Player.profileId`; matching on name alone is
 * only a fallback for sessions recorded before the squad existed.
 */
export interface PlayerProfile {
  id: Id;
  name: string;
  createdAt: number;
  /** kept, not deleted — their past sessions still reference them */
  archived: boolean;
}

export interface CareerStats {
  profileId: Id;
  sessions: number;
  games: number;
  points: number;
  conceded: number;
  wins: number;
  draws: number;
  losses: number;
  /** sessions finished in first place on points */
  titles: number;
  podiums: number;
  /** points per game, the only cross-session comparable number */
  average: number;
  lastPlayed: number | null;
  /** newest first, one entry per session played */
  form: SessionResult[];
}

export interface SessionResult {
  tournamentId: Id;
  name: string;
  playedAt: number;
  position: number;
  of: number;
  points: number;
  games: number;
}

export function emptyCareer(profileId: Id): CareerStats {
  return {
    profileId,
    sessions: 0,
    games: 0,
    points: 0,
    conceded: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    titles: 0,
    podiums: 0,
    average: 0,
    lastPlayed: null,
    form: [],
  };
}

/** Normalised name, the fallback join key for pre-squad sessions. */
function key(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Fold every session into one career record per profile.
 *
 * Sessions with no scores at all are skipped rather than counted as a played
 * session with zero points — an abandoned night should not drag an average
 * down. A session where the player appears but never got on court still counts
 * as attendance, which is why `games` and `sessions` are tracked separately.
 */
export function careerStats(
  profiles: PlayerProfile[],
  tournaments: Tournament[],
): Map<Id, CareerStats> {
  const byId = new Map(profiles.map((p) => [p.id, p.id] as const));
  const byName = new Map(profiles.map((p) => [key(p.name), p.id] as const));
  const out = new Map<Id, CareerStats>(profiles.map((p) => [p.id, emptyCareer(p.id)] as const));

  const ordered = [...tournaments].sort((a, b) => b.createdAt - a.createdAt);

  for (const t of ordered) {
    const rows = computeStandings(t);
    const scored = rows.filter((r) => r.played > 0);
    if (scored.length === 0) continue;

    for (const row of rows) {
      const player = t.players.find((p) => p.id === row.playerId);
      if (!player) continue;
      const profileId =
        (player.profileId && byId.get(player.profileId)) ?? byName.get(key(player.name));
      if (!profileId) continue;

      const c = out.get(profileId)!;
      c.sessions += 1;
      c.games += row.played;
      c.points += row.points;
      c.conceded += row.conceded;
      c.wins += row.wins;
      c.draws += row.draws;
      c.losses += row.losses;
      if (row.played > 0) {
        if (row.position === 1) c.titles += 1;
        if (row.position <= 3) c.podiums += 1;
      }
      c.lastPlayed = Math.max(c.lastPlayed ?? 0, t.createdAt);
      c.form.push({
        tournamentId: t.id,
        name: t.name,
        playedAt: t.createdAt,
        position: row.position,
        of: rows.length,
        points: row.points,
        games: row.played,
      });
    }
  }

  for (const c of out.values()) {
    c.average = c.games === 0 ? 0 : Math.round((c.points / c.games) * 10) / 10;
  }
  return out;
}

/** Squad list ordered the way the page shows it: most active first. */
export function rankSquad(
  profiles: PlayerProfile[],
  stats: Map<Id, CareerStats>,
): { profile: PlayerProfile; stats: CareerStats }[] {
  return profiles
    .map((profile) => ({ profile, stats: stats.get(profile.id) ?? emptyCareer(profile.id) }))
    .sort(
      (a, b) =>
        Number(a.profile.archived) - Number(b.profile.archived) ||
        b.stats.average - a.stats.average ||
        b.stats.games - a.stats.games ||
        a.profile.name.localeCompare(b.profile.name),
    );
}
