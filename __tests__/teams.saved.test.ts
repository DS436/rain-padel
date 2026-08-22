import { describe, expect, it } from 'vitest';
import { newTeamProfile, pairKey, teamProfileName, type TeamProfile } from '@/lib/teams';
import { createMemoryTeamStore } from '@/lib/store/teamStore';

/**
 * The saved pair is a source to pick FROM, never a foreign key a session hangs
 * off — so the tests here are about identity (is this the pair we already have?)
 * and about the squad link surviving the round trip.
 */

const ana = { name: 'Ana', profileId: 'sq-ana' };
const ben = { name: 'Ben', profileId: 'sq-ben' };

describe('pair identity', () => {
  it('is the same pair whichever way round it was typed', () => {
    expect(pairKey([ana, ben])).toBe(pairKey([ben, ana]));
  });

  it('falls back to names when the pair was typed rather than picked', () => {
    expect(pairKey([{ name: 'Ana' }, { name: 'Ben' }])).toBe(
      pairKey([{ name: 'ben' }, { name: ' Ana ' }]),
    );
  });

  it('keeps two different pairs apart even when a name is shared', () => {
    expect(pairKey([ana, ben])).not.toBe(pairKey([ana, { name: 'Cal' }]));
  });

  it('prefers the squad link over the name, so a rename is still the same pair', () => {
    expect(pairKey([{ name: 'Anastasia', profileId: 'sq-ana' }, ben])).toBe(pairKey([ana, ben]));
  });
});

describe('naming', () => {
  it('defaults to both names', () => {
    expect(teamProfileName([ana, ben])).toBe('Ana & Ben');
  });

  it('keeps a name somebody chose', () => {
    expect(teamProfileName([ana, ben], '  The Regulars ')).toBe('The Regulars');
  });

  it('ignores a blank name rather than saving an empty label', () => {
    expect(teamProfileName([ana, ben], '   ')).toBe('Ana & Ben');
  });
});

describe('minting a saved pair', () => {
  it('takes its id and its clock from the caller, so nothing is guessed', () => {
    const profile = newTeamProfile([ana, ben], { newId: () => 't-fixed', now: () => 42 });
    expect(profile).toEqual({
      id: 't-fixed',
      name: 'Ana & Ben',
      players: [ana, ben],
      createdAt: 42,
      archived: false,
    });
  });
});

describe('the team store', () => {
  const profile: TeamProfile = {
    id: 't1',
    name: 'Ana & Ben',
    players: [ana, ben],
    createdAt: 1_700_000_000_000,
    archived: false,
  };

  it('round-trips a pair with both squad links intact', async () => {
    const store = createMemoryTeamStore();
    await store.save(profile);
    const [saved] = await store.list();
    expect(saved!.players[0].profileId).toBe('sq-ana');
    expect(saved!.players[1].profileId).toBe('sq-ben');
  });

  it('lists alphabetically and forgets on request', async () => {
    const store = createMemoryTeamStore([
      profile,
      { ...profile, id: 't2', name: 'Cal & Dee', players: [{ name: 'Cal' }, { name: 'Dee' }] },
    ]);
    expect((await store.list()).map((t) => t.name)).toEqual(['Ana & Ben', 'Cal & Dee']);
    await store.remove('t1');
    expect((await store.list()).map((t) => t.name)).toEqual(['Cal & Dee']);
  });
});
