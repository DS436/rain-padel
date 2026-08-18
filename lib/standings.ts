import type { Id, StandingRow, Tournament } from '@/lib/types';

/**
 * Spec section 5. Derived from `rounds` on every call — never cached, which is
 * what makes editing a past score trivially correct.
 *
 * The rule that defines the format: a 24-point match ending 14-10 gives BOTH
 * winners 14 and BOTH losers 10. We accumulate points, not wins.
 */
export function computeStandings(t: Tournament): StandingRow[] {
  const acc = new Map<Id, Tally>();
  for (const p of t.players) acc.set(p.id, { points: 0, conceded: 0, played: 0, wins: 0, draws: 0, losses: 0 });

  for (const round of t.rounds) {
    for (const m of round.matches) {
      if (m.scoreA === null || m.scoreB === null) continue; // not yet entered
      credit(acc, m.teamA, m.scoreA, m.scoreB);
      credit(acc, m.teamB, m.scoreB, m.scoreA);
    }
  }

  const entryOrder = new Map(t.players.map((p, i) => [p.id, i] as const));

  return t.players
    .map((p) => {
      const a = acc.get(p.id)!;
      return { position: 0, playerId: p.id, name: p.name, active: p.active, ...a };
    })
    .sort((a, b) => {
      // 1. total points — the headline number
      if (b.points !== a.points) return b.points - a.points;
      // 2. points per match — protects anyone who sat out more rounds
      const perA = a.played === 0 ? 0 : a.points / a.played;
      const perB = b.played === 0 ? 0 : b.points / b.played;
      if (perB !== perA) return perB - perA;
      // 3. point differential
      const diffA = a.points - a.conceded;
      const diffB = b.points - b.conceded;
      if (diffB !== diffA) return diffB - diffA;
      // 4. entry order — stable, deterministic final tiebreak
      return entryOrder.get(a.playerId)! - entryOrder.get(b.playerId)!;
    })
    .map((row, i) => ({ ...row, position: i + 1 }));
}

interface Tally {
  points: number;
  conceded: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
}

function credit(
  acc: Map<Id, Tally>,
  team: readonly [Id, Id],
  own: number,
  other: number,
): void {
  for (const id of team) {
    const a = acc.get(id);
    if (!a) continue; // a score referencing a player who was never registered
    a.points += own;
    a.conceded += other;
    a.played += 1;
    // W/D/L are for the scoreboard only — ranking is on points, never on wins
    if (own > other) a.wins += 1;
    else if (own === other) a.draws += 1;
    else a.losses += 1;
  }
}
