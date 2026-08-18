import type { History, HistoryOf, Id, PlayerIndex, Round, Tournament } from '@/lib/types';

/**
 * Order-independent key for an unordered pair.
 *
 * Written out explicitly rather than as `[a, b].sort().join('|')`. The sort
 * version is correct — Array#sort is lexicographic, which is symmetric — but it
 * reads like a bug waiting to be "fixed" into a numeric comparator by someone
 * who assumes indices. Both index space and id space use this one function.
 */
export function pairKey(a: Id | PlayerIndex, b: Id | PlayerIndex): string {
  const x = String(a);
  const y = String(b);
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

export function emptyHistory<K>(): HistoryOf<K> {
  return { partnered: new Map(), opposed: new Map(), rested: new Map(), played: new Map() };
}

export function cloneHistory<K>(h: HistoryOf<K>): HistoryOf<K> {
  return {
    partnered: new Map(h.partnered),
    opposed: new Map(h.opposed),
    rested: new Map(h.rested),
    played: new Map(h.played),
  };
}

/** Read a counter that may be absent. */
export function count<K>(m: Map<K, number>, k: K): number {
  return m.get(k) ?? 0;
}

export function bump<K>(m: Map<K, number>, k: K, by = 1): void {
  m.set(k, count(m, k) + by);
}

/** Fold one round's pairings into a history in place. */
export function applyRound<K>(h: HistoryOf<K>, matches: { teamA: [K, K]; teamB: [K, K] }[], resting: K[]): void {
  for (const { teamA, teamB } of matches) {
    bump(h.partnered, pairKey(teamA[0] as Id, teamA[1] as Id));
    bump(h.partnered, pairKey(teamB[0] as Id, teamB[1] as Id));
    for (const p of teamA) {
      for (const q of teamB) bump(h.opposed, pairKey(p as Id, q as Id));
    }
    for (const p of [...teamA, ...teamB]) bump(h.played, p);
  }
  for (const p of resting) bump(h.rested, p);
}

/**
 * Rebuild history from the rounds. Always derived, never stored (spec section 4).
 *
 * `upToExclusive` bounds the fold, which is what lets a mid-session roster
 * change seed the regenerator with only the immutable prefix.
 *
 * Note `played` counts SCHEDULED appearances, not scored ones — it feeds rest
 * fairness, where a match that happened but was not typed in still counts.
 * `StandingRow.played` is the scored count and is deliberately different.
 */
export function buildHistory(t: Tournament, upToExclusive?: number): History {
  const h = emptyHistory<Id>();
  const limit = upToExclusive ?? t.rounds.length;
  for (const round of t.rounds.slice(0, limit)) applyRound(h, round.matches, round.resting);
  return h;
}

export function isRoundComplete(r: Round): boolean {
  return r.matches.length > 0 && r.matches.every((m) => m.scoreA !== null && m.scoreB !== null);
}
