import type {
  Id,
  Knockout,
  KnockoutSize,
  Round,
  SeededPair,
  Tournament,
} from '@/lib/types';
import { pairKey } from '@/lib/history';
import { computeStandings, computeTeamStandings } from '@/lib/standings';
import { displayNames } from '@/lib/format';

/**
 * The finals.
 *
 * A night scored on points has no ending — the table simply stops, and the
 * person who happened to draw the strongest partners is on top of it. A
 * knockout gives the evening a last game that everybody watches, without
 * throwing the group stage away: the games already played decide the seeding,
 * and only then does sudden death take over.
 *
 * Both stages share one `rounds` array, so scoring, the CSV, the charts and
 * every screen carry on working without knowing a bracket exists.
 * `Knockout.fromGame` is the line between the two.
 */

export const KNOCKOUT_SIZES: KnockoutSize[] = [2, 4, 8];

/** Games in the bracket: 2 pairs is one game, 4 is two, 8 is three. */
export function bracketRounds(size: KnockoutSize): number {
  return Math.log2(size);
}

/** Pairs needed on the roster before a bracket of this size can be seeded. */
export function unitsNeeded(t: Tournament, size: KnockoutSize): number {
  return t.mode === 'teams' ? size : size * 2;
}

/**
 * Standard bracket order, so the top two seeds can only meet in the final.
 *
 * Naive 1v2, 3v4 pairing puts the best two on court together in the first
 * game, which is the one thing a bracket exists to prevent. Built by repeated
 * doubling: [1,2] becomes [1,4,2,3] becomes [1,8,4,5,2,7,3,6].
 */
export function seedOrder(size: KnockoutSize): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const span = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, span - seed]);
  }
  return order;
}

export function roundName(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 1) return 'Final';
  if (fromEnd === 2) return 'Semi-finals';
  if (fromEnd === 3) return 'Quarter-finals';
  return `Round ${round + 1}`;
}

export interface KnockoutStage {
  /** 0-based round within the bracket */
  round: number;
  rounds: number;
  name: string;
  /** one label per match, in match order */
  labels: string[];
  isFinal: boolean;
}

/** What, if anything, the given game is in bracket terms. */
export function knockoutStageOf(t: Tournament, gameIndex: number): KnockoutStage | null {
  const k = t.knockout;
  if (!k || gameIndex < k.fromGame) return null;

  const round = gameIndex - k.fromGame;
  const rounds = bracketRounds(k.size);
  if (round >= rounds) return null;

  const isFinal = round === rounds - 1;
  const name = roundName(round, rounds);
  const games = k.size / 2 ** (round + 1);

  const labels = isFinal
    ? ['Final', ...(k.thirdPlace && k.size >= 4 ? ['Third place'] : [])]
    : Array.from({ length: games }, (_, i) => `${singular(name)} ${i + 1}`);

  return { round, rounds, name, labels, isFinal };
}

function singular(name: string): string {
  return name.endsWith('s') ? name.slice(0, -1) : name;
}

/* ------------------------------ seeding ------------------------------ */

/**
 * Who goes into the bracket, strongest first.
 *
 * Teams mode is the easy case — the pairs already exist, so the top `size` of
 * them walk in. Individual mode has to MAKE pairs, and pairing the top two
 * together would decide the final before it was played; so the qualifying
 * players are folded, strongest with weakest, which is the same balancing every
 * social night does out loud when it picks finals partners.
 *
 * A mixed draw folds the two halves against each other instead, because the one
 * rule that cannot bend is that every team is one from each.
 */
export function seedPairs(t: Tournament, size: KnockoutSize): SeededPair[] | null {
  if (t.mode === 'teams') {
    const rows = computeTeamStandings(t).filter((r) => r.active);
    if (rows.length < size) return null;
    return rows.slice(0, size).map((r, i) => ({
      seed: i + 1,
      name: r.name,
      players: [...r.players] as [Id, Id],
    }));
  }

  const names = displayNames(t.players);
  const rows = computeStandings(t).filter((r) => r.active);
  const label = (a: Id, b: Id) => `${names.get(a) ?? '?'} & ${names.get(b) ?? '?'}`;

  if (t.mixed) {
    const groupOf = new Map(t.players.map((p) => [p.id, p.group === 1 ? 1 : 0] as const));
    const a = rows.filter((r) => groupOf.get(r.playerId) !== 1).slice(0, size);
    const b = rows.filter((r) => groupOf.get(r.playerId) === 1).slice(0, size);
    if (a.length < size || b.length < size) return null;
    return a.map((row, i) => {
      const partner = b[size - 1 - i]!;
      return {
        seed: i + 1,
        name: label(row.playerId, partner.playerId),
        players: [row.playerId, partner.playerId] as [Id, Id],
      };
    });
  }

  const need = size * 2;
  if (rows.length < need) return null;
  const qualifying = rows.slice(0, need);
  return Array.from({ length: size }, (_, i) => {
    const top = qualifying[i]!;
    const bottom = qualifying[need - 1 - i]!;
    return {
      seed: i + 1,
      name: label(top.playerId, bottom.playerId),
      players: [top.playerId, bottom.playerId] as [Id, Id],
    };
  });
}

/** The whole bracket declaration, or null when the roster cannot fill it. */
export function seedKnockout(
  t: Tournament,
  size: KnockoutSize,
  thirdPlace: boolean,
  fromGame: number,
): Knockout | null {
  const pairs = seedPairs(t, size);
  if (!pairs) return null;
  return { size, pairs, fromGame, thirdPlace: thirdPlace && size >= 4 };
}

/* ---------------------------- progression ---------------------------- */

/** The seeded pair on a given side of a match, by the two ids on it. */
function pairOf(k: Knockout, side: readonly [Id, Id]): SeededPair | null {
  const key = pairKey(side[0], side[1]);
  return k.pairs.find((p) => pairKey(p.players[0], p.players[1]) === key) ?? null;
}

/**
 * Who goes through.
 *
 * A drawn knockout game is not a result, so the better seed advances — the
 * group stage is the tiebreak, which is exactly what a seeding is for and means
 * a night never stalls waiting for somebody to win a decider.
 */
export function winnerOf(
  k: Knockout,
  match: { teamA: [Id, Id]; teamB: [Id, Id]; scoreA: number | null; scoreB: number | null },
): SeededPair | null {
  const a = pairOf(k, match.teamA);
  const b = pairOf(k, match.teamB);
  if (!a || !b) return null;
  if (match.scoreA === null || match.scoreB === null) return null;
  if (match.scoreA > match.scoreB) return a;
  if (match.scoreB > match.scoreA) return b;
  return a.seed <= b.seed ? a : b;
}

export function loserOf(
  k: Knockout,
  match: { teamA: [Id, Id]; teamB: [Id, Id]; scoreA: number | null; scoreB: number | null },
): SeededPair | null {
  const winner = winnerOf(k, match);
  if (!winner) return null;
  const a = pairOf(k, match.teamA)!;
  return winner === a ? pairOf(k, match.teamB) : a;
}

/**
 * Build the bracket game at `gameIndex`.
 *
 * The first one comes from the seeding; every one after it comes from the
 * winners of the game before, which is why nothing about the bracket beyond the
 * entrants is stored — a corrected score in the semi-final re-derives the final,
 * for the same reason the standings are never cached.
 */
export function buildKnockoutRound(
  t: Tournament,
  gameIndex: number,
  newId: () => Id,
): Round | null {
  const k = t.knockout;
  if (!k) return null;
  const stage = knockoutStageOf(t, gameIndex);
  if (!stage) return null;

  const match = (a: SeededPair, b: SeededPair, courtIndex: number) => ({
    id: newId(),
    courtIndex,
    teamA: [...a.players] as [Id, Id],
    teamB: [...b.players] as [Id, Id],
    scoreA: null,
    scoreB: null,
    startedAt: null,
  });

  if (stage.round === 0) {
    const order = seedOrder(k.size);
    const bySeed = new Map(k.pairs.map((p) => [p.seed, p] as const));
    const matches = [];
    for (let i = 0; i < order.length; i += 2) {
      const a = bySeed.get(order[i]!);
      const b = bySeed.get(order[i + 1]!);
      if (!a || !b) return null;
      matches.push(match(a, b, matches.length));
    }
    return { index: gameIndex, matches, resting: sittingOut(t, matches) };
  }

  const previous = t.rounds[gameIndex - 1];
  if (!previous) return null;
  // Only the bracket games count as feeders — the third-place match is appended
  // after the final, so it can never be one.
  const feeders = previous.matches.slice(0, k.size / 2 ** stage.round);
  const winners = feeders.map((m) => winnerOf(k, m));
  if (winners.some((w) => w === null)) return null;

  const matches = [];
  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i]!;
    const b = winners[i + 1];
    if (!b) return null;
    matches.push(match(a, b, matches.length));
  }

  // The two beaten semi-finalists play for third alongside the final.
  if (stage.isFinal && k.thirdPlace && feeders.length === 2) {
    const losers = feeders.map((m) => loserOf(k, m));
    if (losers[0] && losers[1]) matches.push(match(losers[0], losers[1], matches.length));
  }

  return { index: gameIndex, matches, resting: sittingOut(t, matches) };
}

/** Everyone still in the session who is not on a bracket court this game. */
function sittingOut(t: Tournament, matches: { teamA: [Id, Id]; teamB: [Id, Id] }[]): Id[] {
  const on = new Set(matches.flatMap((m) => [...m.teamA, ...m.teamB]));
  return t.players.filter((p) => p.active && !on.has(p.id)).map((p) => p.id);
}

/** The pair that won the final, once the final has a score. */
export function champion(t: Tournament): SeededPair | null {
  const k = t.knockout;
  if (!k) return null;
  const finalGame = k.fromGame + bracketRounds(k.size) - 1;
  const round = t.rounds[finalGame];
  if (!round?.matches[0]) return null;
  return winnerOf(k, round.matches[0]);
}

/** Runner-up, third and fourth where the bracket actually decided them. */
export function podiumPairs(t: Tournament): { place: number; pair: SeededPair }[] {
  const k = t.knockout;
  if (!k) return [];
  const finalGame = k.fromGame + bracketRounds(k.size) - 1;
  const round = t.rounds[finalGame];
  if (!round) return [];

  const out: { place: number; pair: SeededPair }[] = [];
  const decider = round.matches[0];
  if (decider) {
    const w = winnerOf(k, decider);
    const l = loserOf(k, decider);
    if (w) out.push({ place: 1, pair: w });
    if (l) out.push({ place: 2, pair: l });
  }
  const third = k.thirdPlace ? round.matches[1] : undefined;
  if (third) {
    const w = winnerOf(k, third);
    const l = loserOf(k, third);
    if (w) out.push({ place: 3, pair: w });
    if (l) out.push({ place: 4, pair: l });
  }
  return out;
}
