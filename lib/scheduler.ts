import type {
  IndexHistory,
  PlayerIndex,
  RawMatch,
  RawRound,
  RawTeamMatch,
  RawTeamRound,
  ScheduleOptions,
  ScheduleResult,
  TeamIndex,
  TeamScheduleResult,
} from '@/lib/types';
import { bump, cloneHistory, count, emptyHistory, pairKey } from '@/lib/history';

type Team = [PlayerIndex, PlayerIndex];

/**
 * Standard round-robin ("circle method") for M players, M even.
 * Returns M-1 rounds of M/2 pairs, in which every player is paired with every
 * other player exactly once. Here each pair is a TEAM, not a pair of opponents
 * — that reframing is what makes this a complete Americano schedule.
 */
function circleTeams(M: number): Team[][] {
  const rounds: Team[][] = [];
  const others = Array.from({ length: M - 1 }, (_, i) => i + 1);
  for (let r = 0; r < M - 1; r++) {
    const rotated = [...others.slice(r), ...others.slice(0, r)];
    const row = [0, ...rotated];
    const teams: Team[] = [];
    // row has exactly M entries, so both indices are always in range
    for (let i = 0; i < M / 2; i++) teams.push([row[i]!, row[M - 1 - i]!]);
    rounds.push(teams);
  }
  return rounds;
}

/** All combinations of k indices drawn from 0..n-1. */
function combinations(n: number, k: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  (function rec(start: number) {
    if (cur.length === k) {
      out.push([...cur]);
      return;
    }
    for (let i = start; i < n; i++) {
      cur.push(i);
      rec(i + 1);
      cur.pop();
    }
  })(0);
  return out;
}

/**
 * Build an Americano schedule.
 *
 * `opts.seed` carries counts forward from rounds already played, which is what
 * spec 9.5 needs when the roster changes mid-session. Be precise about what it
 * buys: `rested` drives the team-drop objective and `opposed` drives court
 * matching, so seeding fixes REST FAIRNESS and opponent variety. It cannot
 * reduce repeat partnerships — `partnered` is written but never read, because
 * repeat-free pairing is a property of the circle construction, not of a search.
 *
 * `opts.rotationOffset` must be the number of rounds already generated for this
 * roster. Without it a regeneration restarts the circle at row 0 and replays
 * pairings the group has already played.
 */
export function buildAmericanoSchedule(
  n: number,
  courts: number,
  rounds: number,
  opts: ScheduleOptions = {},
): ScheduleResult {
  const M = n % 2 === 0 ? n : n + 1; // pad odd counts with a ghost
  const GHOST = n; // sentinel, only present when n is odd
  const base = circleTeams(M);

  const startIndex = opts.startIndex ?? 0;
  const rotationOffset = opts.rotationOffset ?? 0;
  const history: IndexHistory = opts.seed ? cloneHistory(opts.seed) : emptyHistory<PlayerIndex>();
  const { rested, opposed } = history;
  const schedule: RawRound[] = [];

  for (let r = 0; r < rounds; r++) {
    // Wrapping past M-1 necessarily repeats partnerships. Expected, see spec 9.4.
    let teams: Team[] = base[(rotationOffset + r) % (M - 1)]!.map((t) => [...t] as Team);
    const resters: PlayerIndex[] = [];

    // 1. the ghost's partner has nobody to play with, so they rest
    teams = teams.filter((t) => {
      if (t.includes(GHOST)) {
        resters.push(t.find((p) => p !== GHOST)!);
        return false;
      }
      return true;
    });

    // 2. drop surplus teams when there are more teams than the courts can hold
    const courtsInPlay = Math.min(Math.floor(teams.length / 2), courts);
    const surplus = teams.length - courtsInPlay * 2;
    if (surplus > 0) {
      const candidates = combinations(teams.length, surplus);
      const score = (idx: number[]): [number, number] => {
        const sim = new Map(rested);
        for (const p of resters) sim.set(p, count(sim, p) + 1);
        for (const i of idx) for (const p of teams[i]!) sim.set(p, count(sim, p) + 1);
        const counts = Array.from({ length: n }, (_, i) => count(sim, i));
        // minimise sum of squares first (levels the tail), then raw spread
        return [
          counts.reduce((s, x) => s + x * x, 0),
          Math.max(...counts) - Math.min(...counts),
        ];
      };

      let best: number[] = [];
      let bestScore: [number, number] | null = null;
      if (candidates.length <= 5000) {
        for (const idx of candidates) {
          const s = score(idx);
          if (!bestScore || s[0] < bestScore[0] || (s[0] === bestScore[0] && s[1] < bestScore[1])) {
            bestScore = s;
            best = idx;
          }
        }
      } else {
        // fallback for very large rosters; see plan risk 1
        teams.sort(
          (a, b) =>
            count(rested, a[0]) + count(rested, a[1]) - (count(rested, b[0]) + count(rested, b[1])),
        );
        best = Array.from({ length: surplus }, (_, i) => i);
      }
      const drop = new Set(best);
      for (const i of best) resters.push(...teams[i]!);
      teams = teams.filter((_, i) => !drop.has(i));
    }

    // 3. match teams into courts, greedily minimising repeat opponents
    const matches: RawMatch[] = [];
    const pool = [...teams];
    while (pool.length) {
      const A = pool.shift()!;
      let bestIdx = 0;
      let bestCost = Infinity;
      for (let i = 0; i < pool.length; i++) {
        let c = 0;
        for (const p of A) for (const q of pool[i]!) c += count(opposed, pairKey(p, q)) ** 2;
        if (c < bestCost) {
          bestCost = c;
          bestIdx = i;
        }
      }
      const B = pool.splice(bestIdx, 1)[0]!;
      matches.push({ courtIndex: matches.length, teamA: A, teamB: B });
    }

    // 4. fold this round into history
    applyIndexRound(history, matches, resters);
    schedule.push({ index: startIndex + r, matches, resting: resters });
  }

  return { schedule, stats: history };
}

function applyIndexRound(h: IndexHistory, matches: RawMatch[], resters: PlayerIndex[]): void {
  for (const { teamA, teamB } of matches) {
    bump(h.partnered, pairKey(teamA[0], teamA[1]));
    bump(h.partnered, pairKey(teamB[0], teamB[1]));
    for (const p of teamA) for (const q of teamB) bump(h.opposed, pairKey(p, q));
    for (const p of [...teamA, ...teamB]) bump(h.played, p);
  }
  for (const p of resters) bump(h.rested, p);
}

/**
 * Mexicano round generation. Called after each round's scores are in; there is
 * no precomputed schedule because pairings depend on results.
 *
 * `ranking` is the list of active player indices ALREADY sorted by standings
 * (section 5), strongest first. Everything returned is expressed in those same
 * player indices.
 */
export function generateMexicanoRound(
  ranking: PlayerIndex[],
  courts: number,
  history: IndexHistory,
  roundIndex: number,
  rng: () => number = () => 0,
): RawRound {
  if (roundIndex === 0) {
    // The reference returned this raw. Its matches hold POSITIONS 0..len-1,
    // whereas every other path holds entries of `ranking` — identical only when
    // `ranking` is the identity permutation. With any inactive player the wrong
    // people get put on court, silently, because the indices are still in range.
    const raw = buildAmericanoSchedule(ranking.length, courts, 1).schedule[0]!;
    return {
      index: 0,
      matches: raw.matches.map((m) => ({
        courtIndex: m.courtIndex,
        teamA: [ranking[m.teamA[0]]!, ranking[m.teamA[1]]!] as [PlayerIndex, PlayerIndex],
        teamB: [ranking[m.teamB[0]]!, ranking[m.teamB[1]]!] as [PlayerIndex, PlayerIndex],
      })),
      resting: raw.resting.map((i) => ranking[i]!),
    };
  }

  const courtsInPlay = Math.min(Math.floor(ranking.length / 4), courts);
  const restingCount = ranking.length - courtsInPlay * 4;

  // Spec 7.4's third sort key, which the reference omitted. Without it, ties
  // fall back to input order under a stable sort — and input order IS standings
  // order, so every tie benches whoever is currently winning. Assign the jitter
  // by player index so it does not itself depend on the ranking.
  const jitter = new Map<PlayerIndex, number>();
  for (const p of [...ranking].sort((a, b) => a - b)) jitter.set(p, rng());

  const resters = [...ranking]
    .sort(
      (a, b) =>
        count(history.rested, a) - count(history.rested, b) ||
        count(history.played, b) - count(history.played, a) ||
        jitter.get(a)! - jitter.get(b)!,
    )
    .slice(0, restingCount);

  const rest = new Set(resters);
  const rank = ranking.filter((p) => !rest.has(p));

  const matches: RawMatch[] = [];
  for (let c = 0; c < courtsInPlay; c++) {
    // 1+4 vs 2+3 balances the two sides of the court. Not configurable in v1.
    const [p1, p2, p3, p4] = rank.slice(c * 4, c * 4 + 4);
    matches.push({ courtIndex: c, teamA: [p1!, p4!], teamB: [p2!, p3!] });
  }
  return { index: roundIndex, matches, resting: resters };
}

/* ------------------------------------------------------------------ *
 * Teams mode — the unit is a fixed pair, so a match is two indices.
 * ------------------------------------------------------------------ */

/**
 * Build a teams Americano: every pair meets every other pair.
 *
 * The circle method again, read differently. In individual mode a circle pair
 * is a TEAM; here it is a FIXTURE, which is the textbook reading and gives a
 * complete round robin in `M - 1` games. Odd fields pad with a ghost, and
 * whoever draws the ghost sits that game out.
 *
 * Rest fairness, the court cap and `opts.rotationOffset` behave exactly as they
 * do in `buildAmericanoSchedule` — deliberately, so a session that switches
 * mode is not switching engines.
 */
export function buildTeamSchedule(
  nTeams: number,
  courts: number,
  games: number,
  opts: ScheduleOptions = {},
): TeamScheduleResult {
  const M = nTeams % 2 === 0 ? nTeams : nTeams + 1;
  const GHOST = nTeams;
  const base = circleTeams(M); // here each entry is a FIXTURE, not a partnership

  const startIndex = opts.startIndex ?? 0;
  const rotationOffset = opts.rotationOffset ?? 0;
  const history: IndexHistory = opts.seed ? cloneHistory(opts.seed) : emptyHistory<PlayerIndex>();
  const { rested, opposed } = history;
  const schedule: RawTeamRound[] = [];

  for (let g = 0; g < games; g++) {
    let fixtures = base[(rotationOffset + g) % (M - 1)]!.map((t) => [...t] as Team);
    const resters: TeamIndex[] = [];

    // the ghost's opponent has nobody to play, so they get the bye
    fixtures = fixtures.filter((f) => {
      if (f.includes(GHOST)) {
        resters.push(f.find((x) => x !== GHOST)!);
        return false;
      }
      return true;
    });

    // more fixtures than courts: drop whole fixtures, levelling the byes
    const surplus = Math.max(0, fixtures.length - Math.min(fixtures.length, courts));
    if (surplus > 0) {
      const candidates = combinations(fixtures.length, surplus);
      const score = (idx: number[]): [number, number] => {
        const sim = new Map(rested);
        for (const p of resters) sim.set(p, count(sim, p) + 1);
        for (const i of idx) for (const p of fixtures[i]!) sim.set(p, count(sim, p) + 1);
        const counts = Array.from({ length: nTeams }, (_, i) => count(sim, i));
        return [
          counts.reduce((s, x) => s + x * x, 0),
          Math.max(...counts) - Math.min(...counts),
        ];
      };

      let best: number[] = [];
      let bestScore: [number, number] | null = null;
      if (candidates.length <= 5000) {
        for (const idx of candidates) {
          const s = score(idx);
          if (!bestScore || s[0] < bestScore[0] || (s[0] === bestScore[0] && s[1] < bestScore[1])) {
            bestScore = s;
            best = idx;
          }
        }
      } else {
        fixtures.sort(
          (a, b) =>
            count(rested, a[0]) + count(rested, a[1]) - (count(rested, b[0]) + count(rested, b[1])),
        );
        best = Array.from({ length: surplus }, (_, i) => i);
      }
      const drop = new Set(best);
      for (const i of best) resters.push(...fixtures[i]!);
      fixtures = fixtures.filter((_, i) => !drop.has(i));
    }

    const matches: RawTeamMatch[] = fixtures.map((f, i) => ({
      courtIndex: i,
      teamA: f[0],
      teamB: f[1],
    }));

    for (const m of matches) {
      bump(opposed, pairKey(m.teamA, m.teamB));
      bump(history.played, m.teamA);
      bump(history.played, m.teamB);
    }
    for (const p of resters) bump(rested, p);

    schedule.push({ index: startIndex + g, matches, resting: resters });
  }

  return { schedule, stats: history };
}

/**
 * Mexicano for pairs. `ranking` is the active team indices in standings order,
 * strongest first; court 1 gets the top two teams, court 2 the next two, and so
 * on, which is the pairs reading of Mexicano's 1+4 v 2+3.
 *
 * Rest selection is the same three-key sort as the individual path, for the
 * same reason: without the third key a stable sort benches the leaders on every
 * tie.
 */
export function generateMexicanoTeamRound(
  ranking: TeamIndex[],
  courts: number,
  history: IndexHistory,
  roundIndex: number,
  rng: () => number = () => 0,
): RawTeamRound {
  if (roundIndex === 0) {
    const raw = buildTeamSchedule(ranking.length, courts, 1).schedule[0]!;
    return {
      index: 0,
      matches: raw.matches.map((m) => ({
        courtIndex: m.courtIndex,
        teamA: ranking[m.teamA]!,
        teamB: ranking[m.teamB]!,
      })),
      resting: raw.resting.map((i) => ranking[i]!),
    };
  }

  const courtsInPlay = Math.min(Math.floor(ranking.length / 2), courts);
  const restingCount = ranking.length - courtsInPlay * 2;

  const jitter = new Map<TeamIndex, number>();
  for (const p of [...ranking].sort((a, b) => a - b)) jitter.set(p, rng());

  const resters = [...ranking]
    .sort(
      (a, b) =>
        count(history.rested, a) - count(history.rested, b) ||
        count(history.played, b) - count(history.played, a) ||
        jitter.get(a)! - jitter.get(b)!,
    )
    .slice(0, restingCount);

  const rest = new Set(resters);
  const rank = ranking.filter((p) => !rest.has(p));

  const matches: RawTeamMatch[] = [];
  for (let c = 0; c < courtsInPlay; c++) {
    matches.push({ courtIndex: c, teamA: rank[c * 2]!, teamB: rank[c * 2 + 1]! });
  }
  return { index: roundIndex, matches, resting: resters };
}
