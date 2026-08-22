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
