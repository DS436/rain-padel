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

/**
 * Who the scheduling unit is.
 *   - individual: partners rotate, everyone is ranked on their own points.
 *   - teams:      fixed pairs. The pair is the unit that is drawn against
 *                 other pairs, and both members always score the same.
 */
export type PlayMode = 'individual' | 'teams';

export type Scoring =
  | { mode: 'points'; target: number }
  | { mode: 'time'; minutes: number };

export interface Player {
  id: Id;
  name: string;
  /** false = dropped out mid-session (spec 9.5). Never remove players. */
  active: boolean;
  /**
   * The saved player this row was picked from, if any. Set only when the
   * organiser chose someone from the squad rather than typing a name, and it is
   * what joins a night's scores to a career record. Absent is normal.
   */
  profileId?: Id;
}

/** A name on the way in, plus the squad member it came from if it was picked. */
export interface RosterEntry {
  name: string;
  profileId?: Id;
}

/** A fixed pair, used only when `Tournament.mode === 'teams'`. */
export interface Team {
  id: Id;
  name: string;
  players: [Id, Id];
  /** false = this pair dropped out. Mirrors Player.active for both members. */
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

/**
 * One GAME: every court playing at the same time.
 *
 * Named `Round` since v1, and kept that way because it is the persisted shape.
 * Since v2 a round is a CYCLE of `Tournament.gamesPerRound` of these — see
 * `lib/cycles.ts`, which is the only place that grouping is expressed.
 */
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
  /** individual or fixed pairs. Absent on v1 rows; `migrate` fills it in. */
  mode: PlayMode;
  scoring: Scoring;
  /** courts physically available; the engine caps usage at floor(active/4). */
  courts: number;
  plannedRounds: number;
  /**
   * Epoch ms the court booking ends, or null if nobody said. Used to work out
   * whether the planned rounds actually fit in the time that is left.
   */
  courtEndsAt: number | null;
  players: Player[];
  /** Fixed pairs. Empty in individual mode. */
  teams: Team[];
  /**
   * How many games make one round — a round is finished when every unit has
   * partnered (individual) or faced (teams) every other one. Defaults to
   * unitCount - 1, so four players play three games per round.
   */
  gamesPerRound: number;
  rounds: Round[];
  currentRound: number;
  status: TournamentStatus;
  schemaVersion: number;
}

export const SCHEMA_VERSION = 2;

/* ------------------------------------------------------------------ *
 * Index space — the scheduler never sees an Id.
 * Indices address `activeRoster(t)` and are valid only for the duration
 * of a single scheduler call. Never persist one.
 * ------------------------------------------------------------------ */

export type PlayerIndex = number;
/** Index into the ACTIVE team list, same one-call-only lifetime as PlayerIndex. */
export type TeamIndex = number;

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

/** Teams mode: a match is two team indices, not four player indices. */
export interface RawTeamMatch {
  courtIndex: number;
  teamA: TeamIndex;
  teamB: TeamIndex;
}

export interface RawTeamRound {
  index: number;
  matches: RawTeamMatch[];
  resting: TeamIndex[];
}

export interface TeamScheduleResult {
  schedule: RawTeamRound[];
  stats: IndexHistory;
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

/** A pair's line on the scoreboard. Both members always hold these numbers. */
export interface TeamStandingRow {
  position: number;
  teamId: Id;
  name: string;
  players: [Id, Id];
  active: boolean;
  points: number;
  conceded: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
}

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
  draws: number;
  losses: number;
}
