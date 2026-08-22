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

/* ------------------------------------------------------------------ *
 * Repeat avoidance.
 *
 * Four people on a court can be split into two pairs three different ways, and
 * a format that always picks the same one replays the same fixture every time
 * those four meet. Mexicano is where this bites hardest: if the top four hold
 * their places, 1+4 v 2+3 is literally the same game every round.
 *
 * So the split is CHOSEN rather than fixed. The three shapes are listed
 * best-balanced first and the comparison is strictly-less, which means an
 * unplayed quad still gets the textbook 1+4 v 2+3 — balance is only given up
 * once keeping it would mean replaying a partnership or a fixture.
 * ------------------------------------------------------------------ */

export type Quad = [PlayerIndex, PlayerIndex, PlayerIndex, PlayerIndex];

/**
 * The three pairings of four ranked players, most balanced first:
 * 1+4 v 2+3, then 1+3 v 2+4, then 1+2 v 3+4.
 *
 * The order matters twice over. For Mexicano it is the balance ranking. For
 * King of the Court, where a quad arrives as two pairs `[x, x, y, y]`, the
 * first shape is also the only one that splits BOTH arriving pairs — which is
 * the rule that hands everyone a new partner each game.
 */
const SPLIT_SHAPES: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
  [[0, 3], [1, 2]],
  [[0, 2], [1, 3]],
  [[0, 1], [2, 3]],
];

/**
 * Partnering the same person again is the repeat people actually complain
 * about; facing them again is mild by comparison. Four is enough that no
 * amount of opponent repetition can outvote one repeated partnership on a
 * single court.
 */
const PARTNER_REPEAT_WEIGHT = 4;

/** Pick the least-repetitive way to split four players into two pairs. */
export function chooseSplit(
  quad: Quad,
  history: IndexHistory,
): { teamA: [PlayerIndex, PlayerIndex]; teamB: [PlayerIndex, PlayerIndex] } {
  let best = { teamA: [quad[0], quad[3]] as Team, teamB: [quad[1], quad[2]] as Team };
  let bestCost = Infinity;

  for (const [sa, sb] of SPLIT_SHAPES) {
    const teamA: Team = [quad[sa[0]]!, quad[sa[1]]!];
    const teamB: Team = [quad[sb[0]]!, quad[sb[1]]!];
    let cost =
      PARTNER_REPEAT_WEIGHT *
      (count(history.partnered, pairKey(teamA[0], teamA[1])) +
        count(history.partnered, pairKey(teamB[0], teamB[1])));
    for (const x of teamA) for (const y of teamB) cost += count(history.opposed, pairKey(x, y));
    if (cost < bestCost) {
      bestCost = cost;
      best = { teamA, teamB };
    }
  }
  return best;
}

/**
 * A mixed court has only TWO legal splits, not three — the third would put two
 * players from the same half on one side. `a` and `b` are the two from each
 * half, and the default is the cross pairing the open format already used.
 */
function chooseMixedSplit(
  a: [PlayerIndex, PlayerIndex],
  b: [PlayerIndex, PlayerIndex],
  history: IndexHistory,
): { teamA: Team; teamB: Team } {
  const options: { teamA: Team; teamB: Team }[] = [
    { teamA: [a[0], b[1]], teamB: [a[1], b[0]] },
    { teamA: [a[0], b[0]], teamB: [a[1], b[1]] },
  ];
  let best = options[0]!;
  let bestCost = Infinity;
  for (const o of options) {
    let cost =
      PARTNER_REPEAT_WEIGHT *
      (count(history.partnered, pairKey(o.teamA[0], o.teamA[1])) +
        count(history.partnered, pairKey(o.teamB[0], o.teamB[1])));
    for (const x of o.teamA) for (const y of o.teamB) cost += count(history.opposed, pairKey(x, y));
    if (cost < bestCost) {
      bestCost = cost;
      best = o;
    }
  }
  return best;
}

/**
 * Which circle row to play next.
 *
 * Inside the first cycle the answer is always "the next one" — the circle
 * already guarantees no repeats, and reordering it would only make the
 * schedule harder to read. Past the cycle the rows start coming round again,
 * and they are NOT equally stale: whenever courts are scarce whole teams get
 * dropped and never play, so some rows are still completely unplayed. This
 * picks the cheapest row instead of blindly wrapping to row 0, with the
 * natural row winning every tie so a full-participation session is unchanged.
 */
function pickRow(
  base: Team[][],
  turn: number,
  ghost: number,
  partnered: Map<string, number>,
  /**
   * What the rest distribution would come to if this row were played, or
   * undefined when working that out is not affordable — see the call site.
   */
  restCost: ((teams: Team[]) => number) | undefined,
  opposed?: Map<string, number>,
): number {
  const rows = base.length;
  const natural = turn % rows;
  if (turn < rows) return natural;

  /**
   * Three keys, in the order they matter to somebody standing on the court.
   *
   *  1. WHO SITS OUT — the rest distribution this row leads to, played
   *     forward through the same objective `assignCourts` uses. It outranks
   *     variety, because an uneven number of games is a worse complaint than
   *     seeing the same four names again, and because rest fairness is the
   *     thing this app promises out loud.
   *  2. Repeated partnerships.
   *  3. Repeated opponents.
   *
   * Keys 2 and 3 are what stop a five-player night looping. Past the cycle
   * every row ties on partnerships — with five players all ten pairs have
   * happened exactly once — so without them the natural wrap wins and round six
   * is round one, rester and all.
   */
  const costOf = (i: number): [number, number, number] => {
    const row = base[i]!;
    let repeats = 0;
    let faced = 0;
    const playing: PlayerIndex[] = [];
    for (const t of row) {
      if (t[0] === ghost || t[1] === ghost) continue;
      repeats += count(partnered, pairKey(t[0], t[1])) ** 2;
      playing.push(t[0], t[1]);
    }
    if (opposed) {
      for (let a = 0; a < playing.length; a++) {
        for (let b = a + 1; b < playing.length; b++) {
          faced += count(opposed, pairKey(playing[a]!, playing[b]!));
        }
      }
    }
    return [restCost ? restCost(row) : 0, repeats, faced];
  };

  const better = (a: [number, number, number], b: [number, number, number]) =>
    a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];

  let bestRow = natural;
  let bestCost = costOf(natural);
  for (let k = 1; k < rows; k++) {
    const i = (natural + k) % rows;
    const c = costOf(i);
    if (better(c, bestCost)) {
      bestCost = c;
      bestRow = i;
    }
  }
  return bestRow;
}

/**
 * Past the end of the circle, re-split each court.
 *
 * Inside the first cycle the circle's teams ARE the format — everyone partners
 * everyone exactly once — and nothing may touch them. After that the guarantee
 * is spent and partnerships have to repeat, so the only question left is which
 * repeat, and the circle's answer is the worst one available: it replays whole
 * rounds in order, same four people, same sides, same person resting.
 *
 * Four players can be split three ways, so re-splitting turns one cycle's worth
 * of distinct fixtures into three. A five-player night goes from five before it
 * loops to fifteen.
 */
function resplitPastCycle(matches: RawMatch[], history: IndexHistory): RawMatch[] {
  return matches.map((m) => {
    const quad: Quad = [m.teamA[0], m.teamA[1], m.teamB[0], m.teamB[1]];
    const { teamA, teamB } = chooseSplit(quad, history);
    return { courtIndex: m.courtIndex, teamA, teamB };
  });
}

/** How many ways to draw k from n. Used to decide what is affordable to search. */
function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let out = 1;
  for (let i = 1; i <= k; i++) out = (out * (n - k + i)) / i;
  return Math.round(out);
}

/**
 * The best rest distribution this circle row can lead to.
 *
 * `pickRow` cannot judge rest fairness from the row alone once courts are
 * scarce: the row forces one rester (the ghost's partner) but `assignCourts`
 * then drops whole teams on top of that, and the drop it will choose depends on
 * which teams the row offers. Guessing from the ghost alone measurably made
 * things worse — seven players on one court went from a perfectly level six
 * rests each to a spread of two.
 *
 * So this plays the row forward and returns the sum of squares `assignCourts`
 * would end up with, which is the same objective it optimises. Same number,
 * same ordering, no drift.
 */
function bestRestCost(
  teams: Team[],
  n: number,
  courts: number,
  ghost: number,
  rested: Map<PlayerIndex, number>,
): number {
  const forced: PlayerIndex[] = [];
  const pool = teams.filter((t) => {
    if (t[0] === ghost || t[1] === ghost) {
      forced.push(t[0] === ghost ? t[1]! : t[0]!);
      return false;
    }
    return true;
  });

  const base = new Map(rested);
  for (const p of forced) base.set(p, count(base, p) + 1);

  const sumSquares = (m: Map<PlayerIndex, number>): number => {
    let total = 0;
    for (let i = 0; i < n; i++) total += count(m, i) ** 2;
    return total;
  };

  const surplus = pool.length - Math.min(Math.floor(pool.length / 2), courts) * 2;
  if (surplus <= 0) return sumSquares(base);

  let best = Infinity;
  for (const idx of combinations(pool.length, surplus)) {
    const sim = new Map(base);
    for (const i of idx) for (const p of pool[i]!) sim.set(p, count(sim, p) + 1);
    best = Math.min(best, sumSquares(sim));
  }
  return best;
}

/**
 * The teams-mode twin of `bestRestCost`. A fixture is the unit here, so a
 * dropped fixture benches both its teams and the ghost's opponent takes a bye.
 */
function bestTeamRestCost(
  fixtures: Team[],
  nTeams: number,
  courts: number,
  ghost: number,
  rested: Map<TeamIndex, number>,
): number {
  const forced: TeamIndex[] = [];
  const pool = fixtures.filter((f) => {
    if (f[0] === ghost || f[1] === ghost) {
      forced.push(f[0] === ghost ? f[1]! : f[0]!);
      return false;
    }
    return true;
  });

  const base = new Map(rested);
  for (const t of forced) base.set(t, count(base, t) + 1);

  const sumSquares = (m: Map<TeamIndex, number>): number => {
    let total = 0;
    for (let i = 0; i < nTeams; i++) total += count(m, i) ** 2;
    return total;
  };

  const surplus = Math.max(0, pool.length - courts);
  if (surplus === 0) return sumSquares(base);

  let best = Infinity;
  for (const idx of combinations(pool.length, surplus)) {
    const sim = new Map(base);
    for (const i of idx) for (const t of pool[i]!) sim.set(t, count(sim, t) + 1);
    best = Math.min(best, sumSquares(sim));
  }
  return best;
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

  /**
   * Playing every candidate row forward costs `rows x C(teams, surplus)`
   * simulations. That is nothing for the field sizes where rest fairness is
   * actually delicate — seven players on one court is 21 — and unaffordable
   * for a thirty-player field, which is also the size where `assignCourts`
   * has already given up on brute force. So it is bounded, and above the
   * bound `pickRow` optimises for variety alone exactly as it did before.
   */
  const teamsAfterGhost = M / 2 - (n === M ? 0 : 1);
  const surplus = teamsAfterGhost - Math.min(Math.floor(teamsAfterGhost / 2), courts) * 2;
  const probes = (M - 1) * Math.max(1, binomial(teamsAfterGhost, surplus));
  const restProbe =
    probes <= 4000
      ? (teams: Team[]) => bestRestCost(teams, n, courts, GHOST, rested)
      : undefined;

  for (let r = 0; r < rounds; r++) {
    // Wrapping past M-1 necessarily repeats SOME partnerships (spec 9.4), but
    // not necessarily this row's — see `pickRow`.
    const turn = rotationOffset + r;
    const row = pickRow(base, turn, GHOST, history.partnered, restProbe, opposed);
    let teams: Team[] = base[row]!.map((t) => [...t] as Team);
    const resters: PlayerIndex[] = [];

    // 1. the ghost's partner has nobody to play with, so they rest
    teams = teams.filter((t) => {
      if (t.includes(GHOST)) {
        resters.push(t.find((p) => p !== GHOST)!);
        return false;
      }
      return true;
    });

    // 2 & 3. fit the slate onto the courts and fold it into history
    const fitted = assignCourts(teams, resters, n, courts, rested, opposed);
    const matches =
      turn < M - 1 ? fitted.matches : resplitPastCycle(fitted.matches, history);
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
 * Fit a slate of teams onto the courts available.
 *
 * Two jobs that always travel together, pulled out because Americano and
 * Mixicano build their slates completely differently and then need exactly the
 * same thing done to them:
 *
 *   - **Drop the surplus.** More teams than courts means somebody sits. The
 *     choice minimises the sum of squares of the resulting rest counts, which
 *     levels the tail better than minimising raw spread; above a brute-force
 *     cap it falls back to "rest whoever has rested least".
 *   - **Match the rest into courts**, greedily minimising repeat opponents.
 *
 * `resters` is appended to in place — the caller has usually already put the
 * ghost-drawn players in it before calling.
 */
function assignCourts(
  teams: Team[],
  resters: PlayerIndex[],
  n: number,
  courts: number,
  rested: Map<PlayerIndex, number>,
  opposed: Map<string, number>,
): { matches: RawMatch[] } {
  let pool = [...teams];

  const courtsInPlay = Math.min(Math.floor(pool.length / 2), courts);
  const surplus = pool.length - courtsInPlay * 2;
  if (surplus > 0) {
    const candidates = combinations(pool.length, surplus);
    const score = (idx: number[]): [number, number] => {
      const sim = new Map(rested);
      for (const p of resters) sim.set(p, count(sim, p) + 1);
      for (const i of idx) for (const p of pool[i]!) sim.set(p, count(sim, p) + 1);
      const counts = Array.from({ length: n }, (_, i) => count(sim, i));
      return [
        counts.reduce((s, x) => s + x * x, 0),
        Math.max(...counts) - Math.min(...counts),
      ];
    };

    let best: number[] = [];
    let bestScore: [number, number] | null = null;
    if (candidates.length <= 5000) {
      for (const idx of candidates) {
        const sc = score(idx);
        if (!bestScore || sc[0] < bestScore[0] || (sc[0] === bestScore[0] && sc[1] < bestScore[1])) {
          bestScore = sc;
          best = idx;
        }
      }
    } else {
      // fallback for very large rosters; see plan risk 1
      pool.sort(
        (a, b) =>
          count(rested, a[0]) + count(rested, a[1]) - (count(rested, b[0]) + count(rested, b[1])),
      );
      best = Array.from({ length: surplus }, (_, i) => i);
    }
    const drop = new Set(best);
    for (const i of best) resters.push(...pool[i]!);
    pool = pool.filter((_, i) => !drop.has(i));
  }

  const matches: RawMatch[] = [];
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

  return { matches };
}

/* ------------------------------------------------------------------ *
 * Mixicano — every team is one player from each half of the roster.
 *
 * The constraint is traditionally men-with-women, but it is the same
 * arithmetic for any two-way split, so the halves arrive here as two lists of
 * indices and the scheduler never learns what they are called.
 * ------------------------------------------------------------------ */

/**
 * Build a mixed Americano.
 *
 * A BIPARTITE circle rather than the ordinary one. Round r pairs `a[i]` with
 * `b[(i + m) % m]`, so over `m = max(|A|, |B|)` rounds every player in one half
 * partners every player in the other exactly once — which is the mixed
 * equivalent of "everyone partners everyone" and, note, a shorter cycle than an
 * open draw: eight players split 4/4 is four games, not seven.
 *
 * Both halves are padded to `m`. Drawing a pad means there is nobody to partner
 * with, so that player rests — which is also how an uneven split levels itself
 * out, since the larger half rests `m - min` times over the cycle.
 */
export function buildMixicanoSchedule(
  groupA: PlayerIndex[],
  groupB: PlayerIndex[],
  n: number,
  courts: number,
  rounds: number,
  opts: ScheduleOptions = {},
): ScheduleResult {
  const m = Math.max(groupA.length, groupB.length);
  const startIndex = opts.startIndex ?? 0;
  const rotationOffset = opts.rotationOffset ?? 0;
  const history: IndexHistory = opts.seed ? cloneHistory(opts.seed) : emptyHistory<PlayerIndex>();
  const { rested, opposed } = history;
  const schedule: RawRound[] = [];

  if (m === 0) return { schedule, stats: history };

  const inA = new Set(groupA);

  for (let r = 0; r < rounds; r++) {
    const turn = rotationOffset + r;
    const row = turn % m;
    const teams: Team[] = [];
    const resters: PlayerIndex[] = [];

    for (let i = 0; i < m; i++) {
      const a = groupA[i];
      const b = groupB[(i + row) % m];
      if (a === undefined && b === undefined) continue;
      if (a === undefined) resters.push(b!);
      else if (b === undefined) resters.push(a);
      else teams.push([a, b]);
    }

    const fitted = assignCourts(teams, resters, n, courts, rested, opposed);
    // Same reasoning as the open draw: once the bipartite cycle is spent the
    // pairings repeat anyway, and a mixed court has a second legal split that
    // the circle never reaches. Only two, not three — the third would put two
    // players from the same half on one side.
    const matches =
      turn < m
        ? fitted.matches
        : fitted.matches.map((match) => {
            const quad = [...match.teamA, ...match.teamB];
            const a = quad.filter((p) => inA.has(p));
            const b = quad.filter((p) => !inA.has(p));
            if (a.length !== 2 || b.length !== 2) return match;
            const { teamA, teamB } = chooseMixedSplit(
              [a[0]!, a[1]!],
              [b[0]!, b[1]!],
              history,
            );
            return { courtIndex: match.courtIndex, teamA, teamB };
          });
    applyIndexRound(history, matches, resters);
    schedule.push({ index: startIndex + r, matches, resting: resters });
  }

  return { schedule, stats: history };
}

/**
 * Mixed Mexicano: re-ranked every game, still one from each half per team.
 *
 * Each half is ranked on its own, because ranking the whole field together
 * would put the four strongest players on court one and there is no guarantee
 * they split two and two. Court `c` therefore takes the next two from each
 * half, and pairs them across — strongest A with weaker B against weaker A with
 * stronger B, which is the mixed reading of Mexicano's 1+4 v 2+3.
 */
export function generateMixicanoRound(
  rankedA: PlayerIndex[],
  rankedB: PlayerIndex[],
  n: number,
  courts: number,
  history: IndexHistory,
  roundIndex: number,
  rng: () => number = () => 0,
): RawRound {
  if (roundIndex === 0) {
    const raw = buildMixicanoSchedule(rankedA, rankedB, n, courts, 1).schedule[0];
    return raw ? { ...raw, index: 0 } : { index: 0, matches: [], resting: [] };
  }

  // A court needs two from each half, so the smaller half sets the ceiling.
  const courtsInPlay = Math.min(
    Math.floor(rankedA.length / 2),
    Math.floor(rankedB.length / 2),
    courts,
  );

  const jitter = new Map<PlayerIndex, number>();
  for (const p of [...rankedA, ...rankedB].sort((a, b) => a - b)) jitter.set(p, rng());

  /** Who sits, chosen within a half: least-rested plays, as in the open draw. */
  const benchFrom = (ranked: PlayerIndex[]): PlayerIndex[] =>
    [...ranked]
      .sort(
        (a, b) =>
          count(history.rested, a) - count(history.rested, b) ||
          count(history.played, b) - count(history.played, a) ||
          jitter.get(a)! - jitter.get(b)!,
      )
      .slice(0, ranked.length - courtsInPlay * 2);

  const resters = [...benchFrom(rankedA), ...benchFrom(rankedB)];
  const out = new Set(resters);
  const a = rankedA.filter((p) => !out.has(p));
  const b = rankedB.filter((p) => !out.has(p));

  const matches: RawMatch[] = [];
  for (let c = 0; c < courtsInPlay; c++) {
    const [a1, a2] = [a[c * 2]!, a[c * 2 + 1]!];
    const [b1, b2] = [b[c * 2]!, b[c * 2 + 1]!];
    const { teamA, teamB } = chooseMixedSplit([a1, a2], [b1, b2], history);
    matches.push({ courtIndex: c, teamA, teamB });
  }
  return { index: roundIndex, matches, resting: resters };
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
    // 1+4 vs 2+3 balances the two sides of the court, and is what `chooseSplit`
    // returns unless these four have already played it — a stable top four
    // otherwise replays the identical fixture every single round.
    const [p1, p2, p3, p4] = rank.slice(c * 4, c * 4 + 4);
    const { teamA, teamB } = chooseSplit([p1!, p2!, p3!, p4!], history);
    matches.push({ courtIndex: c, teamA, teamB });
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

  // Same idea one level up, and cheaper: a fixture is one unit, so the bye and
  // any dropped fixtures are the whole story.
  const fixturesAfterGhost = M / 2 - (nTeams === M ? 0 : 1);
  const teamSurplus = Math.max(0, fixturesAfterGhost - courts);
  const teamProbes = (M - 1) * Math.max(1, binomial(fixturesAfterGhost, teamSurplus));
  const restProbe =
    teamProbes <= 4000
      ? (fixtures: Team[]) => bestTeamRestCost(fixtures, nTeams, courts, GHOST, rested)
      : undefined;

  for (let g = 0; g < games; g++) {
    // `opposed` rather than `partnered`: a circle entry here is a FIXTURE, so
    // the thing that would repeat on a wrap is two pairs meeting again.
    const row = pickRow(base, rotationOffset + g, GHOST, history.opposed, restProbe, history.opposed);
    let fixtures = base[row]!.map((t) => [...t] as Team);
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

  // Strict rank adjacency means the top two pairs meet every single round for
  // as long as they hold their places. The opponent is therefore drawn from a
  // three-deep window: close enough that winners still play winners, wide
  // enough that a fixture already played can be stepped over. `+ i` is the
  // tiebreak, so an unrepeated draw is always the adjacent one.
  const OPPONENT_WINDOW = 3;
  const waiting = [...rank];
  const matches: RawTeamMatch[] = [];
  for (let c = 0; c < courtsInPlay; c++) {
    const A = waiting.shift()!;
    let bestIdx = 0;
    let bestCost = Infinity;
    for (let i = 0; i < Math.min(waiting.length, OPPONENT_WINDOW); i++) {
      const cost = count(history.opposed, pairKey(A, waiting[i]!)) * OPPONENT_WINDOW + i;
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }
    const B = waiting.splice(bestIdx, 1)[0]!;
    matches.push({ courtIndex: c, teamA: A, teamB: B });
  }
  return { index: roundIndex, matches, resting: resters };
}

/* ------------------------------------------------------------------ *
 * King of the Court — the ladder.
 *
 * Courts are ranked: court 1 is the king's court, the last court is the
 * bottom. Win and your pair climbs a court, lose and you drop one. Nobody is
 * ranked, nothing is re-sorted, and the strongest four players end up on court
 * one within a few games purely by winning their way there.
 *
 * The rule that makes it fun is what happens on arrival. A court receives two
 * pairs — the losers dropping in from above and the winners climbing up from
 * below — and both pairs are SPLIT, so the person you just beat is now your
 * partner. That is `SPLIT_SHAPES[0]`, which is also what `chooseSplit` returns
 * unless those exact four have already played that exact fixture.
 * ------------------------------------------------------------------ */

/** One court's result, top court first. Produced from the previous round. */
export interface CourtResult {
  winners: [PlayerIndex, PlayerIndex];
  losers: [PlayerIndex, PlayerIndex];
}

/** How many people the bench swaps in at the bottom court each game. */
const KING_SWAP = 2;

export function generateKingRound(
  roster: PlayerIndex[],
  previous: CourtResult[] | null,
  benched: PlayerIndex[],
  courts: number,
  history: IndexHistory,
  roundIndex: number,
): RawRound {
  const courtsInPlay = Math.min(Math.floor(roster.length / 4), courts);
  if (courtsInPlay === 0) return { index: roundIndex, matches: [], resting: [...roster] };

  // Opening game, or a rebuild after the previous round stopped being usable
  // (somebody left, so one of its pairs no longer exists). Fill the ladder from
  // the roster order given — which the caller makes the standings when there is
  // a table to read, so a rebuild drops people back onto a sensible court.
  const usable =
    previous !== null &&
    previous.length === courtsInPlay &&
    previous.every((c) =>
      [...c.winners, ...c.losers].every((p) => roster.includes(p)),
    );

  if (!usable) {
    const matches: RawMatch[] = [];
    for (let c = 0; c < courtsInPlay; c++) {
      const [p1, p2, p3, p4] = roster.slice(c * 4, c * 4 + 4);
      const { teamA, teamB } = chooseSplit([p1!, p2!, p3!, p4!], history);
      matches.push({ courtIndex: c, teamA, teamB });
    }
    return { index: roundIndex, matches, resting: roster.slice(courtsInPlay * 4) };
  }

  const C = previous.length;
  const climb = previous.map((c) => c.winners);
  const fall = previous.map((c) => c.losers);

  // Court 0 keeps its winners and takes the winners climbing from court 1.
  // Court c takes the losers dropping from c-1 and the winners climbing from
  // c+1. The bottom court keeps its losers and takes the losers from above.
  // With a single court there is nowhere to climb, so the four stay and only
  // the bench rotation moves anybody.
  const quads: PlayerIndex[][] = [];
  for (let c = 0; c < C; c++) {
    if (C === 1) quads.push([...climb[0]!, ...fall[0]!]);
    else if (c === 0) quads.push([...climb[0]!, ...climb[1]!]);
    else if (c === C - 1) quads.push([...fall[C - 2]!, ...fall[C - 1]!]);
    else quads.push([...fall[c - 1]!, ...climb[c + 1]!]);
  }

  // The bench. Whoever has waited longest comes on at the bottom court, and
  // the players they replace are the ones who just lost down there — losing on
  // the bottom court is what puts you in the queue, which is the rule everyone
  // already expects from a ladder.
  const resting: PlayerIndex[] = [];
  const bench = benched.filter((p) => roster.includes(p));
  const swap = Math.min(bench.length, KING_SWAP);
  if (swap > 0) {
    const incoming = [...bench]
      .sort(
        (a, b) =>
          count(history.rested, b) - count(history.rested, a) ||
          count(history.played, a) - count(history.played, b) ||
          a - b,
      )
      .slice(0, swap);
    const bottom = quads[C - 1]!;
    const pushed = bottom.splice(bottom.length - swap, swap, ...incoming);
    resting.push(...bench.filter((p) => !incoming.includes(p)), ...pushed);
  } else {
    resting.push(...bench);
  }

  const matches: RawMatch[] = quads.map((q, c) => {
    const { teamA, teamB } = chooseSplit([q[0]!, q[1]!, q[2]!, q[3]!], history);
    return { courtIndex: c, teamA, teamB };
  });

  return { index: roundIndex, matches, resting };
}

/* ------------------------------------------------------------------ *
 * Winner Stays On — one court, one queue.
 *
 * The holders keep the court until they are beaten. The losing pair walks to
 * the back of the queue and the next two waiting come on together, so your
 * partner is whoever happens to be next to you in the line rather than anything
 * the app decided.
 *
 * A draw is NOT a win: you have to actually beat the pair holding the court,
 * which is the reading of the format's own name and the only rule that does not
 * need a coin toss.
 * ------------------------------------------------------------------ */

export interface HoldResult {
  holders: [PlayerIndex, PlayerIndex];
  challengers: [PlayerIndex, PlayerIndex];
  /** false only when the challengers actually outscored the holders. */
  held: boolean;
}

export function generateWinnerStaysRound(
  roster: PlayerIndex[],
  previous: HoldResult | null,
  queue: PlayerIndex[],
  history: IndexHistory,
  roundIndex: number,
): RawRound {
  if (roster.length < 4) return { index: roundIndex, matches: [], resting: [...roster] };

  const onCourt = previous
    ? [...previous.holders, ...previous.challengers].filter((p) => roster.includes(p))
    : [];

  if (!previous || onCourt.length < 4) {
    // Opening game, or the court no longer has four players on it because
    // somebody went home. Take the front four and split them the balanced way.
    const [p1, p2, p3, p4] = roster.slice(0, 4);
    const { teamA, teamB } = chooseSplit([p1!, p2!, p3!, p4!], history);
    return {
      index: roundIndex,
      matches: [{ courtIndex: 0, teamA, teamB }],
      resting: roster.slice(4),
    };
  }

  const winners = previous.held ? previous.holders : previous.challengers;
  const losers = previous.held ? previous.challengers : previous.holders;

  // Losers go to the BACK, behind everybody who was already waiting. That is
  // the whole fairness guarantee of the format and it needs no counters.
  const waiting = [...queue.filter((p) => roster.includes(p)), ...losers];
  const challengers = waiting.slice(0, 2);

  // Fewer than two waiting means the losers are the only challengers there are
  // — a four-player session, where they simply come straight back on.
  if (challengers.length < 2) {
    return {
      index: roundIndex,
      matches: [{ courtIndex: 0, teamA: winners, teamB: losers }],
      resting: [],
    };
  }

  return {
    index: roundIndex,
    matches: [
      {
        courtIndex: 0,
        teamA: winners,
        teamB: [challengers[0]!, challengers[1]!],
      },
    ],
    resting: waiting.slice(2),
  };
}
