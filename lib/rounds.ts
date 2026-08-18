import type {
  Id,
  IndexHistory,
  PlayerIndex,
  RawRound,
  Round,
  Tournament,
} from '@/lib/types';
import { buildHistory, count, emptyHistory, pairKey } from '@/lib/history';
import { computeStandings } from '@/lib/standings';
import { buildAmericanoSchedule, generateMexicanoRound } from '@/lib/scheduler';
import { seededRng } from '@/lib/rng';

/**
 * The one place indices meet ids.
 *
 * `lib/scheduler.ts` is pure and integer-indexed so the acceptance table can be
 * asserted directly. Everything persisted uses ids. This module translates, and
 * nothing else may.
 *
 * Rule: an index is only valid for the duration of one scheduler call.
 * Deactivating a player renumbers every index above them, so an index held
 * across a roster change is a bug. That is why `Round` stores ids only.
 */

/** Active players in entry order. Recompute at every call site; never persist. */
export function activeRoster(t: Tournament): Id[] {
  return t.players.filter((p) => p.active).map((p) => p.id);
}

export function courtsInPlay(activeCount: number, courts: number): number {
  return Math.min(Math.floor(activeCount / 4), courts);
}

export function canGenerate(activeCount: number): boolean {
  return activeCount >= 4;
}

/**
 * Re-express an id-space history in the index space of `ids`, dropping anyone
 * who is no longer on the roster.
 *
 * Pair entries survive when BOTH members remain, so a match where three of four
 * players are still around still contributes what it can. Counts for departed
 * players simply vanish; a newly added player has no entries at all, which
 * reads as "never rested" — correct, since they have played fewer rounds and
 * should be the last one benched.
 */
export function projectHistory(h: ReturnType<typeof buildHistory>, ids: Id[]): IndexHistory {
  const index = new Map(ids.map((id, i) => [id, i] as const));
  const out = emptyHistory<PlayerIndex>();

  // Safe because ids are UUIDs and pairKey joins on '|'.
  const remapPairs = (from: Map<string, number>, to: Map<string, number>) => {
    for (const [key, n] of from) {
      const [a, b] = key.split('|');
      const ia = index.get(a!);
      const ib = index.get(b!);
      if (ia === undefined || ib === undefined) continue;
      to.set(pairKey(ia, ib), n);
    }
  };
  remapPairs(h.partnered, out.partnered);
  remapPairs(h.opposed, out.opposed);

  for (const [id, n] of h.rested) {
    const i = index.get(id);
    if (i !== undefined) out.rested.set(i, n);
  }
  for (const [id, n] of h.played) {
    const i = index.get(id);
    if (i !== undefined) out.played.set(i, n);
  }
  return out;
}

/** Lift a scheduler round into the persisted shape, minting match ids. */
export function materializeRound(raw: RawRound, ids: Id[], newId: () => Id): Round {
  return {
    index: raw.index,
    matches: raw.matches.map((m) => ({
      id: newId(),
      courtIndex: m.courtIndex,
      teamA: [ids[m.teamA[0]]!, ids[m.teamA[1]]!] as [Id, Id],
      teamB: [ids[m.teamB[0]]!, ids[m.teamB[1]]!] as [Id, Id],
      scoreA: null,
      scoreB: null,
      startedAt: null,
    })),
    resting: raw.resting.map((i) => ids[i]!),
  };
}

/** Active players as indices into `ids`, ordered by standings, strongest first. */
export function mexicanoRanking(t: Tournament, ids: Id[]): PlayerIndex[] {
  const index = new Map(ids.map((id, i) => [id, i] as const));
  return computeStandings(t)
    .filter((row) => index.has(row.playerId))
    .map((row) => index.get(row.playerId)!);
}

/** Generate `rounds` Americano rounds starting at `startIndex`. */
export function buildAmericanoRounds(
  t: Tournament,
  rounds: number,
  startIndex: number,
  newId: () => Id,
): Round[] {
  const ids = activeRoster(t);
  if (!canGenerate(ids.length) || rounds <= 0) return [];

  const seed = projectHistory(buildHistory(t, startIndex), ids);
  const { schedule } = buildAmericanoSchedule(ids.length, t.courts, rounds, {
    seed,
    startIndex,
    // continue the circle rather than replaying row 0
    rotationOffset: startIndex,
  });
  return schedule.map((r) => materializeRound(r, ids, newId));
}

/** Generate the next Mexicano round from the standings so far. */
export function nextMexicanoRound(t: Tournament, roundIndex: number, newId: () => Id): Round | null {
  const ids = activeRoster(t);
  if (!canGenerate(ids.length)) return null;

  const history = projectHistory(buildHistory(t, roundIndex), ids);
  const ranking =
    roundIndex === 0 ? ids.map((_, i) => i) : mexicanoRanking(t, ids);

  const raw = generateMexicanoRound(
    ranking,
    t.courts,
    history,
    roundIndex,
    seededRng(t.id, roundIndex),
  );
  return materializeRound({ ...raw, index: roundIndex }, ids, newId);
}

export { count };
