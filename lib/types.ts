/**
 * Domain model — spec section 4.
 *
 * Two deliberate deviations from the spec, both documented in the plan:
 *   - `Round.complete` is NOT here. The spec declared it and four lines later
 *     said derived values are never stored. Use `isRoundComplete()` instead.
 *   - `RoundTimer` is new. `Match.startedAt` alone cannot express a paused
 *     accumulation, so the start/pause control in spec 8.3 was unimplementable.
 */

export type Id = string;

export type Format = 'americano' | 'mexicano';

export type Scoring =
  | { mode: 'points'; target: number }
  | { mode: 'time'; minutes: number };

export interface Player {
  id: Id;
  name: string;
  /** false = dropped out mid-session (spec 9.5). Never remove players. */
  active: boolean;
}

export interface Match {
  id: Id;
  courtIndex: number;
  teamA: [Id, Id];
  teamB: [Id, Id];
  scoreA: number | null;
  scoreB: number | null;
  /** epoch ms, stamped once when a timed round first starts. Null in points mode. */
  startedAt: number | null;
}

export interface RoundTimer {
  /** epoch ms of the currently running segment; null while paused. */
  startedAt: number | null;
  /** milliseconds banked from previously completed segments. */
  accumulatedMs: number;
  running: boolean;
}

export interface Round {
  index: number;
  matches: Match[];
  resting: Id[];
  timer?: RoundTimer;
}

export type TournamentStatus = 'live' | 'finished';

export interface Tournament {
  id: Id;
  name: string;
  createdAt: number;
  format: Format;
  scoring: Scoring;
  /** courts physically available; the engine caps usage at floor(active/4). */
  courts: number;
  plannedRounds: number;
  players: Player[];
  rounds: Round[];
  currentRound: number;
  status: TournamentStatus;
  schemaVersion: number;
}

export const SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ *
 * Index space — the scheduler never sees an Id.
 * Indices address `activeRoster(t)` and are valid only for the duration
 * of a single scheduler call. Never persist one.
 * ------------------------------------------------------------------ */

export type PlayerIndex = number;

export interface HistoryOf<K> {
  /** pairKey -> times these two played as a team */
  partnered: Map<string, number>;
  /** pairKey -> times these two faced each other */
  opposed: Map<string, number>;
  rested: Map<K, number>;
  played: Map<K, number>;
}

export type History = HistoryOf<Id>;
export type IndexHistory = HistoryOf<PlayerIndex>;

export interface RawMatch {
  courtIndex: number;
  teamA: [PlayerIndex, PlayerIndex];
  teamB: [PlayerIndex, PlayerIndex];
}

export interface RawRound {
  index: number;
  matches: RawMatch[];
  resting: PlayerIndex[];
}

export interface ScheduleResult {
  schedule: RawRound[];
  stats: IndexHistory;
}

export interface ScheduleOptions {
  /** pre-existing counts, expressed in the CURRENT index space */
  seed?: IndexHistory;
  /** value for `round.index` of the first generated round (default 0) */
  startIndex?: number;
  /** start the circle at row (rotationOffset + r) % (M-1) (default 0) */
  rotationOffset?: number;
}

/* ------------------------------------------------------------------ */

export interface StandingRow {
  position: number;
  playerId: Id;
  name: string;
  active: boolean;
  /** sum of own team's score across played matches — this is the headline number */
  points: number;
  conceded: number;
  played: number;
  wins: number;
}
