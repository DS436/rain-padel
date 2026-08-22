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
   * true when "a round" means a full cycle of the roster. The rotation formats
   * have one; a ladder does not — its rounds are just games, so the counter
   * says "game 7" rather than pretending a cycle finished.
   */
  cyclic: boolean;
  supportsTeams: boolean;
  supportsMixed: boolean;
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
    supportsTeams: true,
    supportsMixed: true,
    singleCourt: false,
  },
  mexicano: {
    value: 'mexicano',
    name: 'Mexicano',
    tagline: 'Winners play winners',
    blurb:
      'Everyone is re-ranked after every game and paired first-with-fourth against second-with-third. Win and you climb toward court one; the games get tighter as the night goes on.',
    bestFor: 'Competitive, self-balancing.',
    adaptive: true,
    cyclic: true,
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

/** Coerce anything (a query param, a stored blob) to a format we can run. */
export function parseFormat(v: unknown): Format {
  return typeof v === 'string' && (ALL_FORMATS as string[]).includes(v)
    ? (v as Format)
    : 'americano';
}
