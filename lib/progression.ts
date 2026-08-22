import type { Id, Match, Tournament } from '@/lib/types';
import { computeStandings } from '@/lib/standings';
import { displayNames } from '@/lib/format';

/**
 * The shape of the night, per player.
 *
 * The standings table answers "who is winning". It cannot answer "who is
 * climbing", which is the question people actually ask each other between
 * games — so this walks the games in order and keeps every intermediate
 * position. Derived on every call like everything else here: edit a score from
 * game two and the whole curve redraws.
 */

export interface GamePoint {
  /** 0-based game index */
  game: number;
  /** points banked in this game; null when the player was resting */
  scored: number | null;
  conceded: number | null;
  /** running total after this game */
  total: number;
  /** 1-based position after this game */
  rank: number;
  result: 'win' | 'draw' | 'loss' | 'rest';
  /** the other three on court, for the spotlight */
  partner: Id | null;
  opponents: Id[];
}

export interface PlayerSeries {
  playerId: Id;
  name: string;
  points: GamePoint[];
  /** signed places gained since the halfway game — the "up/down" arrow */
  drift: number;
  /** consecutive wins (positive) or losses (negative), most recent run */
  streak: number;
  best: number;
  worst: number;
}

export interface Progression {
  /** games that have at least one score entered */
  playedGames: number;
  series: PlayerSeries[];
  /** highest running total anyone reached, for scaling the chart */
  peak: number;
}

export function buildProgression(t: Tournament): Progression {
  const names = displayNames(t.players);
  const ids = t.players.map((p) => p.id);
  const totals = new Map<Id, number>(ids.map((id) => [id, 0] as const));
  const series = new Map<Id, GamePoint[]>(ids.map((id) => [id, []] as const));

  let playedGames = 0;

  for (const round of t.rounds) {
    const scored = round.matches.filter((m) => m.scoreA !== null && m.scoreB !== null);
    if (scored.length === 0) continue;
    const game = playedGames;
    playedGames += 1;

    const seen = new Set<Id>();
    for (const m of scored) {
      recordSide(m, 'A', totals, series, game, seen);
      recordSide(m, 'B', totals, series, game, seen);
    }

    // everyone else sat this one out — carry their total forward flat, so the
    // chart shows a plateau rather than a gap
    for (const id of ids) {
      if (seen.has(id)) continue;
      series.get(id)!.push({
        game,
        scored: null,
        conceded: null,
        total: totals.get(id) ?? 0,
        rank: 0,
        result: 'rest',
        partner: null,
        opponents: [],
      });
    }

    // rank everyone on the running total, highest first
    const order = [...ids].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
    order.forEach((id, i) => {
      const points = series.get(id)!;
      const last = points[points.length - 1];
      if (last) last.rank = i + 1;
    });
  }

  const standing = computeStandings(t);
  const finalRank = new Map(standing.map((r) => [r.playerId, r.position] as const));
  const peak = Math.max(1, ...ids.map((id) => totals.get(id) ?? 0));

  const out: PlayerSeries[] = t.players.map((p) => {
    const points = series.get(p.id)!;
    const half = points[Math.floor((points.length - 1) / 2)];
    const now = finalRank.get(p.id) ?? points[points.length - 1]?.rank ?? 0;
    return {
      playerId: p.id,
      name: names.get(p.id) ?? p.name,
      points,
      // positive = climbed (a smaller rank number is better)
      drift: half && now ? half.rank - now : 0,
      streak: streakOf(points),
      best: Math.max(0, ...points.map((g) => g.scored ?? 0)),
      worst: Math.min(Infinity, ...points.filter((g) => g.scored !== null).map((g) => g.scored!)),
    };
  });

  return { playedGames, series: out, peak };
}

function recordSide(
  m: Match,
  side: 'A' | 'B',
  totals: Map<Id, number>,
  series: Map<Id, GamePoint[]>,
  game: number,
  seen: Set<Id>,
): void {
  const own = side === 'A' ? m.scoreA! : m.scoreB!;
  const other = side === 'A' ? m.scoreB! : m.scoreA!;
  const team = side === 'A' ? m.teamA : m.teamB;
  const rivals = side === 'A' ? m.teamB : m.teamA;

  for (const id of team) {
    if (!series.has(id)) continue; // a score referencing someone off the roster
    totals.set(id, (totals.get(id) ?? 0) + own);
    series.get(id)!.push({
      game,
      scored: own,
      conceded: other,
      total: totals.get(id)!,
      rank: 0,
      result: own > other ? 'win' : own === other ? 'draw' : 'loss',
      partner: team.find((x) => x !== id) ?? null,
      opponents: [...rivals],
    });
    seen.add(id);
  }
}

/** Most recent run of the same result. Rests do not break a streak. */
function streakOf(points: GamePoint[]): number {
  let streak = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    const r = points[i]!.result;
    if (r === 'rest') continue;
    if (r === 'draw') break;
    if (streak === 0) streak = r === 'win' ? 1 : -1;
    else if ((streak > 0 && r === 'win') || (streak < 0 && r === 'loss')) streak += Math.sign(streak);
    else break;
  }
  return streak;
}

/** Who this player scores most with, and who they lose to. */
export function chemistry(
  s: PlayerSeries,
): { bestPartner: Id | null; nemesis: Id | null } {
  const withPartner = new Map<Id, { points: number; games: number }>();
  const against = new Map<Id, { lost: number; games: number }>();

  for (const g of s.points) {
    if (g.result === 'rest' || g.scored === null) continue;
    if (g.partner) {
      const cur = withPartner.get(g.partner) ?? { points: 0, games: 0 };
      withPartner.set(g.partner, { points: cur.points + g.scored, games: cur.games + 1 });
    }
    for (const o of g.opponents) {
      const cur = against.get(o) ?? { lost: 0, games: 0 };
      against.set(o, { lost: cur.lost + (g.result === 'loss' ? 1 : 0), games: cur.games + 1 });
    }
  }

  const bestPartner =
    [...withPartner.entries()].sort(
      (a, b) => b[1].points / b[1].games - a[1].points / a[1].games,
    )[0]?.[0] ?? null;

  const nemesis =
    [...against.entries()]
      .filter(([, v]) => v.lost > 0)
      .sort((a, b) => b[1].lost / b[1].games - a[1].lost / a[1].games)[0]?.[0] ?? null;

  return { bestPartner, nemesis };
}

/* ----------------------------- consistency ----------------------------- */

/**
 * How steady a player's night was.
 *
 * `deviation` is the population standard deviation of the points they scored
 * per game — the smaller it is, the more every game looked like the last one.
 * Population rather than sample because this is the whole night, not a draw
 * from a larger one, and because the sample form is undefined at one game.
 *
 * Two games is not a shape, so `rated` gates the leaderboard: three games is
 * the fewest that can tell "steady" apart from "one good one and one bad one".
 */
export interface Spread {
  playerId: Id;
  name: string;
  games: number;
  mean: number;
  deviation: number;
  low: number;
  high: number;
  /** enough games for the number to mean anything */
  rated: boolean;
}

export function spreadOf(s: PlayerSeries): Spread {
  const scores = s.points.filter((p) => p.scored !== null).map((p) => p.scored!);
  const games = scores.length;
  if (games === 0) {
    return {
      playerId: s.playerId,
      name: s.name,
      games: 0,
      mean: 0,
      deviation: 0,
      low: 0,
      high: 0,
      rated: false,
    };
  }
  const mean = scores.reduce((a, b) => a + b, 0) / games;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / games;
  return {
    playerId: s.playerId,
    name: s.name,
    games,
    mean: Math.round(mean * 10) / 10,
    deviation: Math.round(Math.sqrt(variance) * 100) / 100,
    low: Math.min(...scores),
    high: Math.max(...scores),
    rated: games >= 3,
  };
}

/**
 * Every player's spread, steadiest first.
 *
 * Unrated players sort behind every rated one, and among themselves by games
 * played rather than by deviation — otherwise somebody who played once sits at
 * the top of a steadiness chart on a deviation of zero, which is true and
 * completely misleading.
 */
export function spreads(p: Progression): Spread[] {
  return p.series
    .map(spreadOf)
    .filter((s) => s.games > 0)
    .sort(
      (a, b) =>
        Number(b.rated) - Number(a.rated) ||
        (a.rated ? a.deviation - b.deviation : b.games - a.games) ||
        b.mean - a.mean ||
        a.name.localeCompare(b.name),
    );
}
