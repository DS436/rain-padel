import type { PlayMode, Tournament } from '@/lib/types';
import { formatSpec } from '@/lib/formats';

/**
 * Rounds are cycles, games are slates.
 *
 * v1 called one slate of courts a "round", which is what the persisted
 * `Tournament.rounds` array still holds. It made the round counter meaningless:
 * "round 5 of 12" told you nothing about whether you had been through the
 * group yet. Since v2 a ROUND is a full cycle — everybody has partnered
 * everybody (individual) or played everybody (teams) — and the slates inside it
 * are GAMES. Four players is three games to a round, five is four.
 *
 * Nothing about the schedule changed. This module is purely the grouping, and
 * it is the only place that arithmetic lives.
 */

/**
 * Games needed for one full cycle. Four players → 3, five → 4, six → 5.
 *
 * `mixedSplit` is the size of each half of a mixed draw. That cycle is shorter,
 * and by a lot: with four and four, every team is one from each half, so four
 * games exhaust all sixteen pairings — where an open draw of the same eight
 * people needs seven. Counting it as `units - 1` would wrap the circle twice
 * and replay partnerships before the round was declared finished.
 */
export function defaultGamesPerRound(
  units: number,
  mode: PlayMode,
  mixedSplit?: [number, number],
): number {
  if (mixedSplit) return Math.max(1, mixedSplit[0], mixedSplit[1]);
  if (units < 2) return 1;
  // Teams meet head-to-head, so an odd field needs one extra slate for the bye.
  if (mode === 'teams') return units % 2 === 0 ? units - 1 : units;
  return units - 1;
}

export function gamesPerRound(t: Tournament): number {
  return Math.max(1, Math.floor(t.gamesPerRound) || 1);
}

/** 0-based round a given 0-based game sits in. */
export function roundOfGame(gameIndex: number, perRound: number): number {
  return Math.floor(gameIndex / Math.max(1, perRound));
}

/** 0-based position of a game inside its round. */
export function gameInRound(gameIndex: number, perRound: number): number {
  return gameIndex % Math.max(1, perRound);
}

export function gamesToRounds(games: number, perRound: number): number {
  return Math.ceil(games / Math.max(1, perRound));
}

export function roundsToGames(rounds: number, perRound: number): number {
  return Math.max(1, Math.floor(rounds)) * Math.max(1, perRound);
}

/** Total rounds the session is aiming for. */
export function plannedRoundCount(t: Tournament): number {
  return gamesToRounds(t.plannedRounds, gamesPerRound(t));
}

/**
 * What one slate of courts is called here.
 *
 * A slate is a ROUND in Mexicano and a GAME in the ladders even though neither
 * format has cycles, so the word cannot be derived from `gamesPerRound` alone —
 * it comes from the format table.
 *
 * A format that HAS cycles is always talking about games at this level, and
 * that holds even when its `gamesPerRound` is 1: a v1 Americano row is pinned
 * to one game per round by `migrate`, and it printed "Game 5" at the time. The
 * cyclic check is what keeps it printing that.
 */
export function slateNoun(t: Tournament): 'round' | 'game' {
  const spec = formatSpec(t.format);
  if (spec.cyclic || gamesPerRound(t) > 1) return 'game';
  return spec.roundNoun;
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "Round 2 · game 1 of 3", or just "Round 4" / "Game 4" when a slate stands alone. */
export function gameLabel(t: Tournament, gameIndex: number): string {
  const per = gamesPerRound(t);
  if (per === 1) return `${capitalise(slateNoun(t))} ${gameIndex + 1}`;
  return `Round ${roundOfGame(gameIndex, per) + 1} · game ${gameInRound(gameIndex, per) + 1} of ${per}`;
}

/** Short form for tight headers: "R2 G1/3". */
export function shortGameLabel(t: Tournament, gameIndex: number): string {
  const per = gamesPerRound(t);
  if (per === 1) return `${slateNoun(t) === 'round' ? 'R' : 'G'}${gameIndex + 1}`;
  return `R${roundOfGame(gameIndex, per) + 1} G${gameInRound(gameIndex, per) + 1}/${per}`;
}
