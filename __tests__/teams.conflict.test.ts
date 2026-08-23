import { describe, expect, it } from 'vitest';
import { conflictMessage, entryKey, takenPlayers, teamConflict } from '@/lib/teams';
import type { RosterEntry } from '@/lib/types';
import { createReducer, initialState } from '@/lib/tournamentReducer';

/**
 * The complaint this file exists for: "I put Ahmed in team one and the app let
 * me put him in team two as well."
 */

const typed = (name: string): RosterEntry => ({ name });
const squad = (name: string, profileId: string): RosterEntry => ({ name, profileId });
const team = (a: RosterEntry, b: RosterEntry) => ({ players: [a, b] as const });

/** Deterministic ids, so a failure names the same row every run. */
const seqId = () => {
  let n = 0;
  return () => `id${++n}`;
};

describe('one person, one team', () => {
  it('refuses a player who is already on another team', () => {
    const committed = [team(typed('Ahmed'), typed('Ana'))];
    const c = teamConflict([typed('Ahmed'), typed('Ben')], committed);
    expect(c?.reason).toBe('taken');
    expect(conflictMessage(c!)).toBe('Ahmed is already on another team.');
  });

  it('recognises the same person however the name was cased or spaced', () => {
    const committed = [team(typed('Ahmed'), typed('Ana'))];
    expect(teamConflict([typed('  ahmed '), typed('Ben')], committed)?.reason).toBe('taken');
  });

  it('matches on the squad link, not the display name', () => {
    // The same person, saved once and typed once under a nickname.
    const committed = [team(squad('Ahmed', 'p1'), typed('Ana'))];
    expect(teamConflict([squad('Ahmed H', 'p1'), typed('Ben')], committed)?.reason).toBe('taken');
  });

  it('refuses a player partnering themselves', () => {
    const c = teamConflict([typed('Ahmed'), typed('ahmed')], []);
    expect(c?.reason).toBe('self');
    expect(conflictMessage(c!)).toBe('Ahmed cannot partner themselves.');
  });

  it('allows a pair with two people nobody has claimed', () => {
    const committed = [team(typed('Ahmed'), typed('Ana'))];
    expect(teamConflict([typed('Ben'), typed('Cara')], committed)).toBeNull();
  });

  it('two different people who share no key are not a conflict', () => {
    // Distinct profiles, same display name — twins, or two Bens.
    const committed = [team(squad('Ben', 'p1'), typed('Ana'))];
    expect(teamConflict([squad('Ben', 'p2'), typed('Cara')], committed)).toBeNull();
  });
});

describe('takenPlayers', () => {
  it('collects both members of every committed team', () => {
    const committed = [
      team(typed('Ahmed'), typed('Ana')),
      team(squad('Ben', 'p9'), typed('Cara')),
    ];
    expect(takenPlayers(committed)).toEqual(
      new Set(['ahmed', 'ana', 'p9', 'cara']),
    );
  });

  it('is empty before anybody is paired', () => {
    expect(takenPlayers([]).size).toBe(0);
  });
});

describe('entryKey', () => {
  it('prefers the squad link over the typed name', () => {
    expect(entryKey(squad('Ahmed', 'p1'))).toBe('p1');
    expect(entryKey(typed('Ahmed'))).toBe('ahmed');
  });
});

describe('CREATE refuses a double-booked roster', () => {
  /**
   * The form disables this, but the rule cannot live only in a disabled
   * attribute — a stale draft or a share link reaches CREATE directly.
   */
  it('drops the second team claiming a player already paired', () => {
    const reducer = createReducer({ newId: seqId(), now: () => 0 });
    const t = reducer(initialState, {
      type: 'CREATE',
      input: {
        name: 'night',
        format: 'americano',
        mode: 'teams',
        mixed: null,
        scoring: { mode: 'points', target: 24 },
        courts: 1,
        plannedRounds: 1,
        playerNames: [],
        teams: [
          { players: [{ name: 'Ahmed' }, { name: 'Ana' }] },
          { players: [{ name: 'Ahmed' }, { name: 'Ben' }] }, // Ahmed again
          { players: [{ name: 'Cara' }, { name: 'Dan' }] },
        ],
        courtEndsAt: null,
      },
    }).tournament!;

    expect(t.teams.map((x) => x.name)).toEqual(['Ahmed & Ana', 'Cara & Dan']);
    // The decisive part: Ahmed exists exactly once, so he cannot be put on two
    // courts in one game and his points cannot be split over two rows.
    const names = t.players.map((p) => p.name);
    expect(names.filter((n) => n === 'Ahmed')).toHaveLength(1);
    expect(new Set(names).size).toBe(names.length);
  });

  it('drops a pair of the same person', () => {
    const reducer = createReducer({ newId: seqId(), now: () => 0 });
    const t = reducer(initialState, {
      type: 'CREATE',
      input: {
        name: 'night',
        format: 'americano',
        mode: 'teams',
        mixed: null,
        scoring: { mode: 'points', target: 24 },
        courts: 1,
        plannedRounds: 1,
        playerNames: [],
        teams: [
          { players: [{ name: 'Ahmed' }, { name: 'Ahmed' }] },
          { players: [{ name: 'Cara' }, { name: 'Dan' }] },
        ],
        courtEndsAt: null,
      },
    }).tournament!;
    expect(t.teams).toHaveLength(1);
    expect(t.players.map((p) => p.name)).toEqual(['Cara', 'Dan']);
  });
});
