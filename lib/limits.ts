import type { Format, PlayMode } from '@/lib/types';
import { formatSpec } from '@/lib/formats';

/**
 * How many units a format will take.
 *
 * A "unit" is a player in individual mode and a pair in teams mode, so the
 * teams row is counted in TEAMS, not people — 32 teams is 64 people.
 *
 * The floors are what the court needs: four players fill one court, and three
 * pairs is the smallest field where a pair can be drawn against someone new in
 * the next game rather than replaying the same fixture forever. The ceilings
 * are where the scheduler stops being pleasant to use rather than where it
 * stops being correct: past ~30 units the brute-force team-drop in
 * `lib/scheduler.ts` falls back to its heuristic and rest spread widens.
 */
export const UNIT_LIMITS: Record<Format, Record<PlayMode, { min: number; max: number }>> = {
  americano: {
    individual: { min: 4, max: 32 },
    teams: { min: 3, max: 32 },
  },
  mexicano: {
    individual: { min: 4, max: 64 },
    teams: { min: 3, max: 64 },
  },
  // A ladder needs at least two courts to be a ladder — with one court there is
  // nowhere to climb to and it collapses into "the same four people". Eight is
  // the floor for that, and the ceiling is the same brute-force wall as above.
  kingofcourt: {
    individual: { min: 8, max: 32 },
    teams: { min: 3, max: 32 },
  },
  // One court, one queue. Four is playable but the losers walk straight back
  // on; six is where a queue exists. The ceiling is a comfort limit — past a
  // dozen people somebody waits four games between hits.
  winnerstays: {
    individual: { min: 4, max: 16 },
    teams: { min: 3, max: 16 },
  },
};

export function unitLimits(format: Format, mode: PlayMode): { min: number; max: number } {
  return UNIT_LIMITS[format][mode];
}

export const unitNoun = (mode: PlayMode, n: number): string =>
  mode === 'teams' ? `${n} team${n === 1 ? '' : 's'}` : `${n} player${n === 1 ? '' : 's'}`;

/**
 * Null when the field is legal, otherwise the sentence to show under the
 * roster. Kept as a message rather than a boolean because every caller that
 * has ever wanted this has wanted the reason too.
 */
export function limitProblem(format: Format, mode: PlayMode, units: number): string | null {
  const { min, max } = unitLimits(format, mode);
  const noun = mode === 'teams' ? 'teams' : 'players';
  if (units < min) {
    const need = min - units;
    const kind = formatSpec(format).supportsTeams ? ` ${mode === 'teams' ? 'teams' : 'singles'}` : '';
    return `Add ${need} more ${need === 1 ? noun.slice(0, -1) : noun} — ${formatName(format)}${kind} needs at least ${min}.`;
  }
  if (units > max) {
    return `That is ${units} ${noun}. ${formatName(format)} tops out at ${max}.`;
  }
  return null;
}

export function formatName(format: Format): string {
  return formatSpec(format).name;
}
