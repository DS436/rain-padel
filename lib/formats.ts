import type { Format, PlayMode } from '@/lib/types';

/**
 * Everything the app knows about a format, in one table.
 *
 * Before this existed the answer to "does this format precompute its schedule"
 * was five separate `t.format === 'americano'` checks scattered across the
 * reducer, and adding a sixth format meant finding all of them. Every branch
 * that used to test a literal now asks a question here instead.
 */
export interface FormatSpec {
  value: Format;
  name: string;
  /** Four or five words for a card subtitle. */
  tagline: string;
  /** A paragraph for the landing page and the "?" explainer. */
  blurb: string;
  /** The one line that tells you whether this is your night. */
  bestFor: string;
  /**
   * false = the whole schedule is known before the first serve and is rebuilt
   * wholesale when the roster changes. true = the next game cannot exist until
   * this one is scored, so rounds are generated one at a time.
   */
  adaptive: boolean;
  /**
   * true when "a round" means a full cycle of the roster. Only Americano has
   * one: its promise is that everyone partners everyone, and that promise is
   * only kept at the end of a cycle. Mexicano and the ladders do not — a slate
   * of courts is the whole unit, so the counter says "round 7" or "game 7"
   * rather than pretending a cycle finished.
   */
  cyclic: boolean;
  /**
   * What one slate of courts is called in this format's own language.
   *
   * Only meaningful when `cyclic` is false. Mexicano and the ladders are both
   * non-cyclic, but they do not use the same word: a Mexicano slate is a ROUND
   * — "seven rounds" is how the format is published and how players talk about
   * it — whereas a ladder has no rounds at all, only games. Same arithmetic,
   * different noun, so the noun lives here. A cyclic format reserves "round"
   * for the cycle, so its slates are always games.
   */
  roundNoun: 'round' | 'game';
  /**
   * How many slates the session opens on, when that is a property of the format
   * rather than of the field size. Null means derive it: a cycle for Americano,
   * roughly a cycle's worth of games for a ladder.
   */
  defaultRounds: number | null;
  supportsTeams: boolean;
  supportsMixed: boolean;
  /**
   * Does an opening phase of randomly-drawn rounds mean anything here? Only for
   * a format whose matchmaking reads the leaderboard — the others are either
   * decided upfront or driven by which court you won on, so "before the table
   * takes over" describes nothing they do.
   */
  supportsDrawRounds: boolean;
  /** Formats that only make sense on a single court say so, and the form obeys. */
  singleCourt: boolean;
}

export const FORMAT_SPECS: Record<Format, FormatSpec> = {
  americano: {
    value: 'americano',
    name: 'Americano',
    tagline: 'Everyone partners everyone',
    blurb:
      'Everyone partners everyone exactly once. The whole schedule is worked out before the first serve, so there are no arguments about who is next and no accidental repeats.',
    bestFor: 'Social, egalitarian, the default.',
    adaptive: false,
    cyclic: true,
    roundNoun: 'round',
    defaultRounds: null,
    supportsDrawRounds: false,
    supportsTeams: true,
    supportsMixed: true,
    singleCourt: false,
  },
  mexicano: {
    value: 'mexicano',
    name: 'Mexicano',
    tagline: 'Winners play winners',
    blurb:
      'The first round is drawn at random. After that everyone is re-ranked on points and grouped in fours — ranks one to four on court one — and paired first-with-fourth against second-with-third. Win and you climb toward court one; the games get tighter as the night goes on.',
    bestFor: 'Competitive, self-balancing.',
    adaptive: true,
    // A Mexicano round IS one slate of courts. It has no cycle to complete —
    // the whole point is that the next round is unknown until this one is
    // scored, so "everyone has partnered everyone" is not a milestone it can
    // reach or would want to. Published Mexicano is 5-8 of these.
    cyclic: false,
    roundNoun: 'round',
    defaultRounds: 7,
    supportsDrawRounds: true,
    supportsTeams: true,
    supportsMixed: true,
    singleCourt: false,
  },
  kingofcourt: {
    value: 'kingofcourt',
    name: 'King of the Court',
    tagline: 'Win and move up a court',
    blurb:
      'Courts are ranked, court one is the king’s court. Win and your pair moves up a court; lose and you move down. The two pairs arriving on a court are split up, so you get a new partner every single game and the strongest four end up on court one without anybody keeping a table.',
    bestFor: 'Loud, fast, no maths at all.',
    adaptive: true,
    cyclic: false,
    roundNoun: 'game',
    defaultRounds: null,
    supportsDrawRounds: false,
    supportsTeams: false,
    supportsMixed: false,
    singleCourt: false,
  },
  winnerstays: {
    value: 'winnerstays',
    name: 'Winner Stays On',
    tagline: 'Hold the court or join the queue',
    blurb:
      'One court, one queue. The winning pair holds the court, the losing pair goes to the back, and the next two waiting come on together. A drawn game is not a win — the holders stay until somebody actually beats them.',
    bestFor: 'One court and more people than fit on it.',
    adaptive: true,
    cyclic: false,
    roundNoun: 'game',
    defaultRounds: null,
    supportsDrawRounds: false,
    supportsTeams: false,
    supportsMixed: false,
    singleCourt: true,
  },
};

export const ALL_FORMATS: Format[] = ['americano', 'mexicano', 'kingofcourt', 'winnerstays'];

export function formatSpec(f: Format): FormatSpec {
  return FORMAT_SPECS[f] ?? FORMAT_SPECS.americano;
}

/** True when the next game is generated from the last one's scores. */
export function isAdaptive(f: Format): boolean {
  return formatSpec(f).adaptive;
}

/** True when the schedule is materialised upfront and rebuilt on roster changes. */
export function isPrecomputed(f: Format): boolean {
  return !formatSpec(f).adaptive;
}

/** True when a round is a full cycle of the roster rather than a single game. */
export function isCyclic(f: Format): boolean {
  return formatSpec(f).cyclic;
}

export function supportsMode(f: Format, mode: PlayMode): boolean {
  return mode === 'teams' ? formatSpec(f).supportsTeams : true;
}

export function supportsMixed(f: Format): boolean {
  return formatSpec(f).supportsMixed;
}

/** True when an opening phase of randomly-drawn rounds is meaningful. */
export function supportsDrawRounds(f: Format): boolean {
  return formatSpec(f).supportsDrawRounds;
}

/** Coerce anything (a query param, a stored blob) to a format we can run. */
export function parseFormat(v: unknown): Format {
  return typeof v === 'string' && (ALL_FORMATS as string[]).includes(v)
    ? (v as Format)
    : 'americano';
}
