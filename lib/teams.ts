import type { Id, RosterEntry } from '@/lib/types';

/**
 * The pairs that outlive a single night.
 *
 * `Team` (in `lib/types.ts`) is a pair inside one session — it holds session
 * player ids and dies with the session. `TeamProfile` is the pair as a standing
 * arrangement: the two people who always play together, saved once and picked
 * every week. Same relationship as `Player` to `PlayerProfile`, and saved for
 * the same reason — retyping "Ana & Ben" every Tuesday is the tedious part.
 *
 * Each side keeps its `RosterEntry`, so a pair built from the squad carries
 * both `profileId`s into the session and the career record still joins up.
 * Deleting a saved pair can never touch a night that has already been played.
 */
export interface TeamProfile {
  id: Id;
  name: string;
  players: [RosterEntry, RosterEntry];
  createdAt: number;
  /** kept, not deleted — a pair that has stopped playing is not a mistake */
  archived: boolean;
}

/**
 * Mint a saved pair.
 *
 * Both the id and the clock arrive as dependencies for the same reason the
 * reducer takes a `Deps` — they are the two impure things in the whole domain,
 * and keeping them at the boundary means this stays a pure function the tests
 * can pin exactly.
 */
export function newTeamProfile(
  players: [RosterEntry, RosterEntry],
  deps: { newId: () => Id; now: () => number },
  name?: string,
): TeamProfile {
  return {
    id: deps.newId(),
    name: teamProfileName(players, name),
    players,
    createdAt: deps.now(),
    archived: false,
  };
}

/** "Ana & Ben" unless somebody named it something better. */
export function teamProfileName(players: [RosterEntry, RosterEntry], given?: string): string {
  return given?.trim() || `${players[0].name.trim()} & ${players[1].name.trim()}`;
}

/**
 * Order-independent identity for a pair, so "Ana & Ben" typed the other way
 * round is recognised as the pair that is already saved rather than added
 * again. Profile ids win when both sides have one; names are the fallback.
 */
export function pairKey(players: [RosterEntry, RosterEntry]): string {
  const parts = players
    .map((p) => p.profileId ?? p.name.trim().toLowerCase())
    .sort((a, b) => a.localeCompare(b));
  return parts.join('|');
}

/**
 * Order-independent identity for ONE person, on the same terms as `pairKey`:
 * the squad link where there is one, the typed name where there is not.
 */
export function entryKey(e: RosterEntry): string {
  return e.profileId ?? e.name.trim().toLowerCase();
}

/**
 * One person, one team.
 *
 * `pairKey` stops the same PAIR going on the sheet twice. Nothing stopped the
 * same PERSON going into two different pairs, and nothing downstream survives
 * it: a player on two teams is scheduled onto two courts in the same game, and
 * `computeTeamStandings` credits their points to both rows.
 *
 * Returns the offending entry, or null when the pair is legal. Takes the pair
 * apart from the teams already committed so the caller can use it both to
 * disable a control and to refuse the action behind it.
 */
export function teamConflict(
  pair: readonly [RosterEntry, RosterEntry],
  committed: readonly { players: readonly [RosterEntry, RosterEntry] }[],
): { entry: RosterEntry; reason: 'self' | 'taken' } | null {
  if (entryKey(pair[0]) === entryKey(pair[1])) {
    return { entry: pair[0], reason: 'self' };
  }
  const taken = takenPlayers(committed);
  for (const p of pair) if (taken.has(entryKey(p))) return { entry: p, reason: 'taken' };
  return null;
}

/** Every person already spoken for by a committed team, by `entryKey`. */
export function takenPlayers(
  committed: readonly { players: readonly [RosterEntry, RosterEntry] }[],
): Set<string> {
  const out = new Set<string>();
  for (const t of committed) for (const p of t.players) out.add(entryKey(p));
  return out;
}

/** The sentence to show a human. */
export function conflictMessage(c: { entry: RosterEntry; reason: 'self' | 'taken' }): string {
  const name = c.entry.name.trim();
  return c.reason === 'self'
    ? `${name} cannot partner themselves.`
    : `${name} is already on another team.`;
}
