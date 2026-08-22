import type {
  Id,
  IndexHistory,
  PlayerIndex,
  RawRound,
  RawTeamRound,
  Round,
  Team,
  TeamIndex,
  Tournament,
} from '@/lib/types';
import { buildHistory, bump, count, emptyHistory, pairKey } from '@/lib/history';
import { computeStandings, computeTeamStandings } from '@/lib/standings';
import {
  buildAmericanoSchedule,
  buildMixicanoSchedule,
  buildTeamSchedule,
  generateKingRound,
  generateMexicanoRound,
  generateMexicanoTeamRound,
  generateMixicanoRound,
  generateWinnerStaysRound,
  type CourtResult,
  type HoldResult,
} from '@/lib/scheduler';
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

/* ------------------------------------------------------------------ *
 * Mixed draws
 * ------------------------------------------------------------------ */

/**
 * The two halves, as indices into `ids`.
 *
 * A player with no `group` is put in the first half. That is not a guess so
 * much as the only safe default: somebody added mid-session before anyone has
 * said which half they are in must still be schedulable, and half one is the
 * one that always exists.
 */
export function mixedIndexGroups(t: Tournament, ids: Id[]): [PlayerIndex[], PlayerIndex[]] {
  const groupOf = new Map(t.players.map((p) => [p.id, p.group === 1 ? 1 : 0] as const));
  const a: PlayerIndex[] = [];
  const b: PlayerIndex[] = [];
  ids.forEach((id, i) => (groupOf.get(id) === 1 ? b : a).push(i));
  return [a, b];
}

/** A mixed court needs two from each half, so the smaller half is the ceiling. */
export function canGenerateMixed(t: Tournament): boolean {
  const [a, b] = mixedIndexGroups(t, activeRoster(t));
  return a.length >= 2 && b.length >= 2;
}

export function buildMixicanoRounds(
  t: Tournament,
  rounds: number,
  startIndex: number,
  newId: () => Id,
): Round[] {
  const ids = activeRoster(t);
  const [a, b] = mixedIndexGroups(t, ids);
  if (a.length < 2 || b.length < 2 || rounds <= 0) return [];

  const seed = projectHistory(buildHistory(t, startIndex), ids);
  const { schedule } = buildMixicanoSchedule(a, b, ids.length, t.courts, rounds, {
    seed,
    startIndex,
    rotationOffset: startIndex,
  });
  return schedule.map((r) => materializeRound(r, ids, newId));
}

/** Each half ranked on its own — see `generateMixicanoRound` for why. */
function mixedRanking(t: Tournament, ids: Id[]): [PlayerIndex[], PlayerIndex[]] {
  const index = new Map(ids.map((id, i) => [id, i] as const));
  const groupOf = new Map(t.players.map((p) => [p.id, p.group === 1 ? 1 : 0] as const));
  const a: PlayerIndex[] = [];
  const b: PlayerIndex[] = [];
  for (const row of computeStandings(t)) {
    const i = index.get(row.playerId);
    if (i === undefined) continue;
    (groupOf.get(row.playerId) === 1 ? b : a).push(i);
  }
  return [a, b];
}

export function nextMixicanoRound(t: Tournament, roundIndex: number, newId: () => Id): Round | null {
  const ids = activeRoster(t);
  const history = projectHistory(buildHistory(t, roundIndex), ids);
  const [a, b] =
    roundIndex === 0 ? mixedIndexGroups(t, ids) : mixedRanking(t, ids);
  if (a.length < 2 || b.length < 2) return null;

  const raw = generateMixicanoRound(
    a,
    b,
    ids.length,
    t.courts,
    history,
    roundIndex,
    seededRng(t.id, roundIndex),
  );
  if (raw.matches.length === 0) return null;
  return materializeRound({ ...raw, index: roundIndex }, ids, newId);
}

export { count };

/* ------------------------------------------------------------------ *
 * Teams mode
 *
 * Same translation rule, one level up: the scheduler thinks in team indices,
 * and this is where a team index becomes the two player ids that go on court.
 * The persisted `Round` shape is identical in both modes, which is what lets
 * every screen, the standings and the export stay mode-agnostic.
 * ------------------------------------------------------------------ */

/** Teams still in the session, in entry order. Never persist an index. */
export function activeTeams(t: Tournament): Team[] {
  return t.teams.filter((tm) => tm.active);
}

export function teamCourtsInPlay(activeTeamCount: number, courts: number): number {
  return Math.min(Math.floor(activeTeamCount / 2), courts);
}

export function canGenerateTeams(activeTeamCount: number): boolean {
  return activeTeamCount >= 2;
}

/** Which team a match side belongs to, by the pair of players on it. */
function teamByPlayers(teams: Team[]): Map<string, Id> {
  return new Map(teams.map((tm) => [pairKey(tm.players[0], tm.players[1]), tm.id] as const));
}

/**
 * Rest/oppose counts in the CURRENT team index space, folded from the games
 * already played. A side whose pair no longer exists (a team that was edited)
 * simply does not contribute, exactly as a departed player does not.
 */
export function projectTeamHistory(t: Tournament, ids: Id[], upToExclusive: number): IndexHistory {
  const index = new Map(ids.map((id, i) => [id, i] as const));
  const byPlayers = teamByPlayers(t.teams);
  const out = emptyHistory<TeamIndex>();

  for (const round of t.rounds.slice(0, upToExclusive)) {
    const playedThisGame = new Set<TeamIndex>();
    for (const m of round.matches) {
      const a = index.get(byPlayers.get(pairKey(m.teamA[0], m.teamA[1])) ?? '');
      const b = index.get(byPlayers.get(pairKey(m.teamB[0], m.teamB[1])) ?? '');
      if (a === undefined || b === undefined) continue;
      bump(out.opposed, pairKey(a, b));
      bump(out.played, a);
      bump(out.played, b);
      playedThisGame.add(a);
      playedThisGame.add(b);
    }
    // A team rests as a unit, so derive it rather than trusting round.resting,
    // which is a flat list of players and cannot distinguish a split pair.
    for (let i = 0; i < ids.length; i++) if (!playedThisGame.has(i)) bump(out.rested, i);
  }
  return out;
}

export function materializeTeamRound(raw: RawTeamRound, teams: Team[], newId: () => Id): Round {
  return {
    index: raw.index,
    matches: raw.matches.map((m) => ({
      id: newId(),
      courtIndex: m.courtIndex,
      teamA: [...teams[m.teamA]!.players] as [Id, Id],
      teamB: [...teams[m.teamB]!.players] as [Id, Id],
      scoreA: null,
      scoreB: null,
      startedAt: null,
    })),
    resting: raw.resting.flatMap((i) => [...teams[i]!.players]),
  };
}

/** Active teams as indices, ordered by team standings, strongest first. */
export function mexicanoTeamRanking(t: Tournament, teams: Team[]): TeamIndex[] {
  const index = new Map(teams.map((tm, i) => [tm.id, i] as const));
  return computeTeamStandings(t)
    .filter((row) => index.has(row.teamId))
    .map((row) => index.get(row.teamId)!);
}

export function buildTeamRounds(
  t: Tournament,
  games: number,
  startIndex: number,
  newId: () => Id,
): Round[] {
  const teams = activeTeams(t);
  if (!canGenerateTeams(teams.length) || games <= 0) return [];

  const seed = projectTeamHistory(t, teams.map((tm) => tm.id), startIndex);
  const { schedule } = buildTeamSchedule(teams.length, t.courts, games, {
    seed,
    startIndex,
    rotationOffset: startIndex,
  });
  return schedule.map((r) => materializeTeamRound(r, teams, newId));
}

export function nextMexicanoTeamRound(t: Tournament, gameIndex: number, newId: () => Id): Round | null {
  const teams = activeTeams(t);
  if (!canGenerateTeams(teams.length)) return null;

  const history = projectTeamHistory(t, teams.map((tm) => tm.id), gameIndex);
  const ranking = gameIndex === 0 ? teams.map((_, i) => i) : mexicanoTeamRanking(t, teams);

  const raw = generateMexicanoTeamRound(
    ranking,
    t.courts,
    history,
    gameIndex,
    seededRng(t.id, gameIndex),
  );
  return materializeTeamRound({ ...raw, index: gameIndex }, teams, newId);
}

/* ------------------------- mode-agnostic entry ------------------------- */

/** How many units (players or pairs) are still in. */
export function activeUnits(t: Tournament): number {
  return t.mode === 'teams' ? activeTeams(t).length : activeRoster(t).length;
}

export function canGenerateAny(t: Tournament): boolean {
  // The ladders are individual-only and court-driven, so four people is the
  // whole requirement — there is no cycle or split to satisfy.
  if (t.format === 'kingofcourt' || t.format === 'winnerstays') {
    return canGenerate(activeRoster(t).length);
  }
  if (t.mode === 'teams') return canGenerateTeams(activeTeams(t).length);
  if (t.mixed) return canGenerateMixed(t);
  return canGenerate(activeRoster(t).length);
}

/** Americano in whichever mode and draw the session is in. */
export function buildScheduledRounds(
  t: Tournament,
  games: number,
  startIndex: number,
  newId: () => Id,
): Round[] {
  if (t.mode === 'teams') return buildTeamRounds(t, games, startIndex, newId);
  if (t.mixed) return buildMixicanoRounds(t, games, startIndex, newId);
  return buildAmericanoRounds(t, games, startIndex, newId);
}

/* ------------------------------------------------------------------ *
 * Ladder formats — the next game is read off the last one's scoreline
 * rather than off a table, so these need the previous ROUND, not the
 * standings. Everything below translates that round into indices.
 * ------------------------------------------------------------------ */

/**
 * Who won and who lost on each court, top court first.
 *
 * Null when the round cannot be read in the current index space — which
 * happens when somebody who was on court has since left. The callers treat
 * that as "rebuild the ladder from the table" rather than as an error.
 *
 * A DRAW counts as a hold for the side on the top line of the card. Something
 * has to break the tie to decide who climbs, and inventing a countback would
 * be a rule nobody could predict from looking at the court.
 */
function courtResults(round: Round, index: Map<Id, PlayerIndex>): CourtResult[] | null {
  const out: CourtResult[] = [];
  for (const m of round.matches) {
    const a = m.teamA.map((id) => index.get(id));
    const b = m.teamB.map((id) => index.get(id));
    if (a.some((x) => x === undefined) || b.some((x) => x === undefined)) return null;
    const topHeld = (m.scoreA ?? 0) >= (m.scoreB ?? 0);
    const teamA = [a[0]!, a[1]!] as [PlayerIndex, PlayerIndex];
    const teamB = [b[0]!, b[1]!] as [PlayerIndex, PlayerIndex];
    out.push(topHeld ? { winners: teamA, losers: teamB } : { winners: teamB, losers: teamA });
  }
  return out;
}

/** The bench in the order it was last written, dropping anyone who has left. */
function benchIndices(round: Round, index: Map<Id, PlayerIndex>): PlayerIndex[] {
  return round.resting.map((id) => index.get(id)).filter((i): i is PlayerIndex => i !== undefined);
}

export function nextKingRound(t: Tournament, gameIndex: number, newId: () => Id): Round | null {
  const ids = activeRoster(t);
  if (!canGenerate(ids.length)) return null;

  const index = new Map(ids.map((id, i) => [id, i] as const));
  const history = projectHistory(buildHistory(t, gameIndex), ids);
  const previousRound = gameIndex > 0 ? t.rounds[gameIndex - 1] : undefined;

  // The fallback order is the standings, so a ladder that has to be rebuilt
  // mid-session puts the people who have been winning back near court one.
  const roster = gameIndex === 0 ? ids.map((_, i) => i) : mexicanoRanking(t, ids);
  const previous = previousRound ? courtResults(previousRound, index) : null;
  const bench = previousRound ? benchIndices(previousRound, index) : [];

  const raw = generateKingRound(roster, previous, bench, t.courts, history, gameIndex);
  if (raw.matches.length === 0) return null;
  return materializeRound({ ...raw, index: gameIndex }, ids, newId);
}

export function nextWinnerStaysRound(
  t: Tournament,
  gameIndex: number,
  newId: () => Id,
): Round | null {
  const ids = activeRoster(t);
  if (!canGenerate(ids.length)) return null;

  const index = new Map(ids.map((id, i) => [id, i] as const));
  const history = projectHistory(buildHistory(t, gameIndex), ids);
  const previousRound = gameIndex > 0 ? t.rounds[gameIndex - 1] : undefined;
  const match = previousRound?.matches[0];

  let previous: HoldResult | null = null;
  if (match) {
    const holders = match.teamA.map((id) => index.get(id));
    const challengers = match.teamB.map((id) => index.get(id));
    if (holders.every((x) => x !== undefined) && challengers.every((x) => x !== undefined)) {
      previous = {
        holders: [holders[0]!, holders[1]!],
        challengers: [challengers[0]!, challengers[1]!],
        // A draw is not a win — you have to beat the pair holding the court.
        held: (match.scoreA ?? 0) >= (match.scoreB ?? 0),
      };
    }
  }

  const raw = generateWinnerStaysRound(
    ids.map((_, i) => i),
    previous,
    previousRound ? benchIndices(previousRound, index) : [],
    history,
    gameIndex,
  );
  if (raw.matches.length === 0) return null;
  return materializeRound({ ...raw, index: gameIndex }, ids, newId);
}

/** The next game, for whichever format generates one at a time. */
export function nextAdaptiveRound(t: Tournament, gameIndex: number, newId: () => Id): Round | null {
  if (t.format === 'kingofcourt') return nextKingRound(t, gameIndex, newId);
  if (t.format === 'winnerstays') return nextWinnerStaysRound(t, gameIndex, newId);
  if (t.mode === 'teams') return nextMexicanoTeamRound(t, gameIndex, newId);
  if (t.mixed) return nextMixicanoRound(t, gameIndex, newId);
  return nextMexicanoRound(t, gameIndex, newId);
}
