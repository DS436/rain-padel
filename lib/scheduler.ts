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
import { shuffled } from '@/lib/rng';

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

/**
 * The circle for one cycle, drawn afresh.
 *
 * The plain circle is the same every night and every cycle: player 0 anchors
 * every row, the rest order is fixed, and cycle two walks the rows in cycle
 * one's order. Relabelling the M seats is an automorphism of the construction,
 * so a shuffled circle keeps every guarantee — everyone partners everyone once,
 * an odd field rests everyone once — while the order people actually meet in
 * is new each cycle. The ghost is one of the M labels, so who draws it moves
 * too.
 */
function drawnCircle(
  M: number,
  random: ScheduleOptions['random'],
  cycle: number,
  /** the cycle before, whose exact set of games this one must not repeat */
  before?: Team[][],
): Team[][] {
  const base = circleTeams(M);
  if (!random) return base;

  // A small field has few distinct cycles — five players have a handful — so
  // a fresh draw can land on the last one's games by chance, and the round
  // would then replay the round before it. Redraw; a few tries always escape.
  let rows = base;
  for (let attempt = 0; attempt < 8; attempt++) {
    const rng = random('cycle', cycle, attempt);
    const label = shuffled(Array.from({ length: M }, (_, i) => i), rng);
    rows = shuffled(
      base.map((row) => shuffled(row.map(([a, b]) => [label[a]!, label[b]!] as Team), rng)),
      rng,
    );
    if (!before || circleSignature(rows) !== circleSignature(before)) break;
  }
  return rows;
}

/** A circle as the set of games it contains, blind to order and sides. */
function circleSignature(rows: Team[][]): string {
  return rows
    .map((row) =>
      row
        .map((t) => [...t].sort((a, b) => a - b).join('+'))
        .sort()
        .join(' '),
    )
    .sort()
    .join(' / ');
}

/** The last game, as the sets the next one is checked against. */
interface RecentGame {
  partnered: Set<string>;
  opposed: Set<string>;
  rested: Set<PlayerIndex>;
}

function recentOf(matches: RawMatch[], resting: PlayerIndex[]): RecentGame {
  const recent: RecentGame = { partnered: new Set(), opposed: new Set(), rested: new Set(resting) };
  for (const { teamA, teamB } of matches) {
    recent.partnered.add(pairKey(teamA[0], teamA[1]));
    recent.partnered.add(pairKey(teamB[0], teamB[1]));
    for (const p of teamA) for (const q of teamB) recent.opposed.add(pairKey(p, q));
  }
  return recent;
}

/** Compare cost vectors key by key; the first key that differs decides. */
function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k]! < b[k]!;
  return false;
}

/** Keeping last game's partner outweighs any amount of facing its opponents. */
const ECHO_PARTNER = 4;

/* ------------------------------------------------------------------ *
 * Repeat avoidance.
 *
 * Four people on a court can be split into two pairs three different ways, and
 * a format that always picks the same one replays the same fixture every time
 * those four meet. Americano past its first cycle is where this bites: the
 * circle hands back whole rounds in order, same four, same sides.
 *
 * So for those formats the split is CHOSEN rather than fixed. The three shapes
 * are listed best-balanced first and the comparison is strictly-less, which
 * means an unplayed quad still gets the balanced 1+4 v 2+3 — balance is only
 * given up once keeping it would mean replaying a partnership or a fixture.
 *
 * Mexicano does NOT use this. Its pairing is dictated by the standings and
 * repeats are part of the format; see `rankedSplit`.
 * ------------------------------------------------------------------ */

export type Quad = [PlayerIndex, PlayerIndex, PlayerIndex, PlayerIndex];

/**
 * The three pairings of four ranked players, most balanced first:
 * 1+4 v 2+3, then 1+3 v 2+4, then 1+2 v 3+4.
 *
 * The order is the balance ranking, and it is also how a quad that arrives as
 * two pairs `[x, x, y, y]` gets read: the first two shapes both split BOTH
 * arriving pairs, the third puts them straight back together.
 */
const SPLIT_SHAPES: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
  [[0, 3], [1, 2]],
  [[0, 2], [1, 3]],
  [[0, 1], [2, 3]],
];

/**
 * The shapes that split a quad arriving as two intact pairs `[x, x, y, y]`.
 * Shape 2 is `[x,x] v [y,y]` — the pairs that just walked onto the court,
 * unchanged — so King of the Court, whose whole promise is a new partner every
 * game, is never allowed to pick it.
 */
const SPLITS_BOTH_PAIRS: readonly number[] = [0, 1];

/**
 * Mexicano's pairing rule, applied without argument: the top-ranked player
 * partners the bottom-ranked one against the two in the middle.
 *
 * This deliberately ignores history. Mexicano is SUPPOSED to repeat
 * partnerships — holding your place means landing on the same court with the
 * same three people, and there are only three ways to split four players. The
 * repeat-avoidance in `chooseSplit` belongs to Americano, whose rule is
 * "everyone partners everyone once"; letting it override the rank split here
 * produced 1+2 v 3+4 (the two best against the two worst), which is the exact
 * matchup Mexicano exists to prevent.
 *
 * The variant some organisers run is 1+3 v 2+4 — `SPLIT_SHAPES[1]`. Switching
 * is a one-line change to `MEXICANO_SHAPE`.
 */
const MEXICANO_SHAPE = SPLIT_SHAPES[0]!;

export function rankedSplit(quad: Quad): {
  teamA: [PlayerIndex, PlayerIndex];
  teamB: [PlayerIndex, PlayerIndex];
} {
  const [sa, sb] = MEXICANO_SHAPE;
  return {
    teamA: [quad[sa[0]]!, quad[sa[1]]!],
    teamB: [quad[sb[0]]!, quad[sb[1]]!],
  };
}

/**
 * Partnering the same person again is the repeat people actually complain
 * about; facing them again is mild by comparison. Four is enough that no
 * amount of opponent repetition can outvote one repeated partnership on a
 * single court.
 */
const PARTNER_REPEAT_WEIGHT = 4;

/**
 * Pick the least-repetitive way to split four players into two pairs.
 *
 * `allowed` restricts which of `SPLIT_SHAPES` may be chosen. Callers whose quad
 * is two intact pairs pass `SPLITS_BOTH_PAIRS`, because for them the third
 * shape is not a worse option but an illegal one.
 */
export function chooseSplit(
  quad: Quad,
  history: IndexHistory,
  allowed: readonly number[] = [0, 1, 2],
): { teamA: [PlayerIndex, PlayerIndex]; teamB: [PlayerIndex, PlayerIndex] } {
  let best = { teamA: [quad[0], quad[3]] as Team, teamB: [quad[1], quad[2]] as Team };
  let bestCost = Infinity;

  for (const shape of allowed) {
    const [sa, sb] = SPLIT_SHAPES[shape]!;
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
   * What the rest distribution would come to if this row were played — the
   * sum of squares, then how many of its resters sat out the game before — or
   * undefined when working that out is not affordable; see the call site.
   */
  restCost: ((teams: Team[]) => [number, number]) | undefined,
  opposed?: Map<string, number>,
  /** the game just played; rows that replay it lose ties on everything else */
  recent?: RecentGame,
  /** breaks what is left of a tie; without it the natural row wins */
  rng?: () => number,
): number {
  const rows = base.length;
  const natural = turn % rows;
  /**
   * Inside the first cycle the plain circle is taken in order. A DRAWN circle
   * is searched too, because its shuffled order is no longer the one that
   * happened to keep court-limited fields from sitting anyone out twice
   * running — but partnerships are put first there, so an unplayed row always
   * wins and the cycle still pairs everybody with everybody once.
   */
  const firstCycle = turn < rows;
  if (firstCycle && !rng) return natural;

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
   *
   * Then the ECHO of the game just played, which counts alone cannot see:
   * four players past their first cycle tie on every count, so the wrap used
   * to hand back the game that had just finished — same four, same sides,
   * twice in a row. Sitting out twice running and keeping a partner are
   * weighed above lifetime opponents; merely facing the same people again
   * only breaks what is left. Last comes a coin toss, so a remaining tie is
   * not settled by row order.
   */
  const toss = Array.from({ length: rows }, (_, k) => (rng ? rng() : k));
  const costOf = (i: number): number[] => {
    const row = base[i]!;
    let repeats = 0;
    let faced = 0;
    let echo = 0;
    let restEcho = 0;
    let faces = 0;
    const playing: PlayerIndex[] = [];
    for (const t of row) {
      if (t[0] === ghost || t[1] === ghost) {
        if (recent?.rested.has(t[0] === ghost ? t[1] : t[0])) restEcho += 1;
        continue;
      }
      repeats += count(partnered, pairKey(t[0], t[1])) ** 2;
      if (recent?.partnered.has(pairKey(t[0], t[1]))) echo += ECHO_PARTNER;
      playing.push(t[0], t[1]);
    }
    for (let a = 0; a < playing.length; a++) {
      for (let b = a + 1; b < playing.length; b++) {
        const key = pairKey(playing[a]!, playing[b]!);
        if (opposed) faced += count(opposed, key);
        if (recent?.opposed.has(key)) faces += 1;
      }
    }
    // the probe sees the teams `assignCourts` will drop as well as the ghost's
    const [squares, sitsAgain] = restCost ? restCost(row) : [0, restEcho];
    const coin = toss[(i - natural + rows) % rows]!;
    return firstCycle
      ? [repeats, squares, sitsAgain, echo, faced, faces, coin]
      : [squares, sitsAgain, repeats, echo, faced, faces, coin];
  };


  let bestRow = natural;
  let bestCost = costOf(natural);
  for (let k = 1; k < rows; k++) {
    const i = (natural + k) % rows;
    const c = costOf(i);
    if (lexLess(c, bestCost)) {
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
function resplitPastCycle(
  matches: RawMatch[],
  history: IndexHistory,
  recent: RecentGame | undefined,
  drawn: boolean,
): RawMatch[] {
  /**
   * The plain circle judges as `chooseSplit` does — partnerships and
   * opponents folded into one cost — and only refuses, on a tie, to hand back
   * the fixture just played. Four players past their first cycle tie on every
   * count, and that tie used to put them on court in the same sides twice
   * running.
   *
   * A drawn circle only reaches this when courts are scarce, and there rest
   * fairness can force the one row holding last game's partners. So keeping a
   * partner from the game before is the FIRST thing a drawn split avoids;
   * lifetime counts only choose between the splits that manage it.
   */
  return matches.map((m) => {
    const quad: Quad = [m.teamA[0], m.teamA[1], m.teamB[0], m.teamB[1]];
    let best: RawMatch = m;
    let bestCost: number[] | null = null;
    for (const shape of [0, 1, 2]) {
      const [sa, sb] = SPLIT_SHAPES[shape]!;
      const teamA: Team = [quad[sa[0]]!, quad[sa[1]]!];
      const teamB: Team = [quad[sb[0]]!, quad[sb[1]]!];
      let partners = 0;
      let kept = 0;
      let opponents = 0;
      for (const t of [teamA, teamB]) {
        const key = pairKey(t[0], t[1]);
        partners += count(history.partnered, key);
        if (recent?.partnered.has(key)) kept++;
      }
      for (const x of teamA) for (const y of teamB) opponents += count(history.opposed, pairKey(x, y));
      const cost = drawn
        ? [kept, partners, opponents]
        : [PARTNER_REPEAT_WEIGHT * partners + opponents, kept === 2 ? 1 : 0];
      if (!bestCost || lexLess(cost, bestCost)) {
        bestCost = cost;
        best = { courtIndex: m.courtIndex, teamA, teamB };
      }
    }
    return best;
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
  justRested: ReadonlySet<PlayerIndex> = new Set(),
): [number, number] {
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

  const again = (ps: PlayerIndex[]) => ps.filter((p) => justRested.has(p)).length;

  const surplus = pool.length - Math.min(Math.floor(pool.length / 2), courts) * 2;
  if (surplus <= 0) return [sumSquares(base), again(forced)];

  let best: [number, number] = [Infinity, Infinity];
  for (const idx of combinations(pool.length, surplus)) {
    const sim = new Map(base);
    const benched = [...forced];
    for (const i of idx) {
      for (const p of pool[i]!) {
        sim.set(p, count(sim, p) + 1);
        benched.push(p);
      }
    }
    const c: [number, number] = [sumSquares(sim), again(benched)];
    if (c[0] < best[0] || (c[0] === best[0] && c[1] < best[1])) best = c;
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
  const circles = new Map<number, Team[][]>();
  const circleOf = (cycle: number): Team[][] => {
    if (!circles.has(cycle)) {
      const before = cycle > 0 && opts.random ? circleOf(cycle - 1) : undefined;
      circles.set(cycle, drawnCircle(M, opts.random, cycle, before));
    }
    return circles.get(cycle)!;
  };
  const circleFor = (turn: number) => circleOf(Math.floor(turn / (M - 1)));
  let recent: RecentGame | undefined = opts.previous
    ? recentOf(opts.previous.matches, opts.previous.resting)
    : undefined;

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
      ? (teams: Team[]) => bestRestCost(teams, n, courts, GHOST, rested, recent?.rested)
      : undefined;

  for (let r = 0; r < rounds; r++) {
    // Wrapping past M-1 necessarily repeats SOME partnerships (spec 9.4), but
    // not necessarily this row's — see `pickRow`.
    const turn = rotationOffset + r;
    const base = circleFor(turn);
    const row = pickRow(
      base,
      turn,
      GHOST,
      history.partnered,
      restProbe,
      opposed,
      recent,
      opts.random?.('game', turn),
    );
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

    // 2 & 3. fit the slate onto the courts and fold it into history. A drawn
    // circle's rows are already new games, and re-splitting them would move
    // partners between rows that are meant to share none — which is exactly
    // how a partnership came back the game after it was played. They are only
    // re-split when courts are scarce and benched teams leave rows half-used.
    const fitted = assignCourts(teams, resters, n, courts, rested, opposed, recent?.rested);
    const matches =
      turn < M - 1 || (opts.random && surplus <= 0)
        ? fitted.matches
        : resplitPastCycle(fitted.matches, history, recent, Boolean(opts.random));
    applyIndexRound(history, matches, resters);
    recent = recentOf(matches, resters);
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
  /** who sat out the game before; among equally fair drops, bench others */
  justRested: ReadonlySet<PlayerIndex> = new Set(),
): { matches: RawMatch[] } {
  let pool = [...teams];

  const courtsInPlay = Math.min(Math.floor(pool.length / 2), courts);
  const surplus = pool.length - courtsInPlay * 2;
  if (surplus > 0) {
    const candidates = combinations(pool.length, surplus);
    const score = (idx: number[]): [number, number, number] => {
      const sim = new Map(rested);
      let again = 0;
      for (const p of resters) sim.set(p, count(sim, p) + 1);
      for (const i of idx) {
        for (const p of pool[i]!) {
          sim.set(p, count(sim, p) + 1);
          if (justRested.has(p)) again++;
        }
      }
      const counts = Array.from({ length: n }, (_, i) => count(sim, i));
      return [
        counts.reduce((s, x) => s + x * x, 0),
        Math.max(...counts) - Math.min(...counts),
        again,
      ];
    };

    let best: number[] = [];
    let bestScore: [number, number, number] | null = null;
    if (candidates.length <= 5000) {
      for (const idx of candidates) {
        const sc = score(idx);
        const wins =
          !bestScore ||
          sc[0] < bestScore[0] ||
          (sc[0] === bestScore[0] && (sc[1] < bestScore[1] || (sc[1] === bestScore[1] && sc[2] < bestScore[2])));
        if (wins) {
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
  opts: MexicanoOptions = {},
): RawRound {
  const drawRounds = clampDrawRounds(opts.drawRounds);
  if (roundIndex < drawRounds) {
    // Random within each half — see `generateMexicanoRound`. Shuffling the two
    // halves separately is what keeps the mixed constraint intact: every team
    // still takes one player from each. The bipartite circle then continues
    // across the warm-up rather than restarting.
    const drawRng = opts.drawRng ?? rng;
    const raw = buildMixicanoSchedule(
      shuffled(rankedA, drawRng),
      shuffled(rankedB, drawRng),
      n,
      courts,
      1,
      { seed: history, rotationOffset: roundIndex },
    ).schedule[0];
    return raw
      ? { ...raw, index: roundIndex }
      : { index: roundIndex, matches: [], resting: [] };
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
    // Cross-pair, always: stronger A with weaker B. The straight pairing puts
    // both halves' stronger player on the same side, which is this format's
    // 1+2 v 3+4 — so history does not get a vote here either. See `rankedSplit`.
    matches.push({ courtIndex: c, teamA: [a1, b2], teamB: [a2, b1] });
  }
  return { index: roundIndex, matches, resting: resters };
}

/**
 * How a Mexicano session opens.
 *
 * `drawRounds` is how many rounds are drawn at random before the leaderboard
 * starts dictating the courts. One is the published format. More is a warm-up:
 * with a single result each, the table that decides every subsequent court is
 * mostly a record of who drew the strong partner, and organisers running mixed
 * groups asked to play two or three before it starts to matter.
 */
export interface MexicanoOptions {
  drawRounds?: number;
  /**
   * The stream the opening draw order comes from. Must NOT vary by round, or
   * the warm-up reshuffles every round and the circle stops protecting against
   * repeat partnerships. Defaults to the round rng, which is right when there
   * is only one drawn round.
   */
  drawRng?: () => number;
}

/** At least one drawn round — a Mexicano with no random opener is not one. */
export function clampDrawRounds(n: number | undefined): number {
  return Math.max(1, Math.floor(n ?? 1) || 1);
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
  opts: MexicanoOptions = {},
): RawRound {
  const drawRounds = clampDrawRounds(opts.drawRounds);
  if (roundIndex < drawRounds) {
    // The OPENING DRAW. Round one is random because that is the format: there
    // is no leaderboard yet, so any deterministic opener is really seeding by
    // the order names were typed in — the organiser's mates, entered first,
    // would partner each other every single week.
    //
    // `drawRounds` extends that to a warm-up of several rounds, because one
    // result each is a thin basis for a table that then dictates every court
    // for the rest of the night. Whoever drew the strong partner in round one
    // leads on nothing but the draw.
    //
    // The circle lays the draw out — it is what gets the court count and the
    // rest split right — and it CONTINUES across the warm-up rather than
    // restarting, so no two people partner twice before the table takes over.
    // The randomness is in who enters the circle, drawn once from `drawRng` so
    // every warm-up round reads the same order.
    const draw = shuffled(ranking, opts.drawRng ?? rng);
    // The reference returned this raw. Its matches hold POSITIONS 0..len-1,
    // whereas every other path holds entries of `ranking` — identical only when
    // `ranking` is the identity permutation. With any inactive player the wrong
    // people get put on court, silently, because the indices are still in range.
    const raw = buildAmericanoSchedule(draw.length, courts, 1, {
      seed: history,
      rotationOffset: roundIndex,
    }).schedule[0]!;
    return {
      index: roundIndex,
      matches: raw.matches.map((m) => ({
        courtIndex: m.courtIndex,
        teamA: [draw[m.teamA[0]]!, draw[m.teamA[1]]!] as [PlayerIndex, PlayerIndex],
        teamB: [draw[m.teamB[0]]!, draw[m.teamB[1]]!] as [PlayerIndex, PlayerIndex],
      })),
      resting: raw.resting.map((i) => draw[i]!),
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
    // 1+4 v 2+3, always. A stable top four does replay the same fixture, and
    // that is the format working, not a fault — see `rankedSplit`.
    const [p1, p2, p3, p4] = rank.slice(c * 4, c * 4 + 4);
    const { teamA, teamB } = rankedSplit([p1!, p2!, p3!, p4!]);
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
      ? (fixtures: Team[]): [number, number] => [
          bestTeamRestCost(fixtures, nTeams, courts, GHOST, rested),
          0,
        ]
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
  opts: MexicanoOptions = {},
): RawTeamRound {
  const drawRounds = clampDrawRounds(opts.drawRounds);
  if (roundIndex < drawRounds) {
    // The opening draw, exactly as in the individual game — see
    // `generateMexicanoRound`. The circle continues across the warm-up, so no
    // two pairs meet twice before the table takes over.
    const draw = shuffled(ranking, opts.drawRng ?? rng);
    const raw = buildTeamSchedule(draw.length, courts, 1, {
      seed: history,
      rotationOffset: roundIndex,
    }).schedule[0]!;
    return {
      index: roundIndex,
      matches: raw.matches.map((m) => ({
        courtIndex: m.courtIndex,
        teamA: draw[m.teamA]!,
        teamB: draw[m.teamB]!,
      })),
      resting: raw.resting.map((i) => draw[i]!),
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

  // Strict rank adjacency: ranks 1 and 2 on court one, 3 and 4 on court two.
  // The top two pairs therefore DO meet every round for as long as they both
  // keep winning, and that repeat is the format rather than a fault — it is the
  // team reading of ranks 1-4 sharing a court. History gets no vote here, for
  // the same reason it gets none in `rankedSplit`: stepping over a fixture to
  // find a fresh one means pairing the leader with somebody they have already
  // out-ranked, which is the mismatch Mexicano exists to prevent.
  const matches: RawTeamMatch[] = [];
  for (let c = 0; c < courtsInPlay; c++) {
    matches.push({ courtIndex: c, teamA: rank[c * 2]!, teamB: rank[c * 2 + 1]! });
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
 * partner. Only two of the three splits do that, so `chooseSplit` is given
 * `SPLITS_BOTH_PAIRS` and can never hand the two arriving pairs back intact.
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
    // Both arriving pairs must be broken up — that is the rule that hands
    // everyone a new partner. Only the first two shapes do it, so the third is
    // withheld rather than merely ranked last.
    const { teamA, teamB } = chooseSplit(
      [q[0]!, q[1]!, q[2]!, q[3]!],
      history,
      SPLITS_BOTH_PAIRS,
    );
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
