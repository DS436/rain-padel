import { describe, expect, it } from 'vitest';
import {
  formatShareCode,
  generateShareCode,
  newShare,
  normaliseShareCode,
  sharePath,
} from '@/lib/share';
import { createMemoryStore } from '@/lib/store/memoryStore';
import { createReducer, initialState, type CreateInput } from '@/lib/tournamentReducer';
import { counterIds, makeTournament } from './fixtures';

describe('share codes', () => {
  it('avoids every character that gets misheard on a padel court', () => {
    const banned = /[OIL01US]/;
    for (let i = 0; i < 500; i++) {
      expect(generateShareCode()).not.toMatch(banned);
    }
  });

  it('is six characters', () => {
    expect(generateShareCode()).toHaveLength(6);
  });

  it('is not the same code twice', () => {
    const seen = new Set(Array.from({ length: 200 }, generateShareCode));
    expect(seen.size).toBeGreaterThan(190);
  });

  it('accepts a code in whatever shape it was typed', () => {
    for (const raw of ['K7M4QD', 'k7m4qd', 'K7M-4QD', '  k7m-4qd ', 'K7M 4QD']) {
      expect(normaliseShareCode(raw)).toBe('K7M4QD');
    }
  });

  it('rejects a typo loudly rather than dropping the bad character', () => {
    // O and 0 are not in the alphabet, so this cannot be a real code.
    expect(normaliseShareCode('K7M4Q0')).toBeNull();
    expect(normaliseShareCode('K7M4QDX')).toBeNull();
    expect(normaliseShareCode('K7M4Q')).toBeNull();
    expect(normaliseShareCode('')).toBeNull();
  });

  it('prints and links consistently', () => {
    expect(formatShareCode('K7M4QD')).toBe('K7M-4QD');
    expect(sharePath('K7M4QD')).toBe('/s/K7M4QD');
  });
});

describe('SET_SHARE', () => {
  const reducer = createReducer({ newId: counterIds('id'), now: () => 1 });
  const input: CreateInput = {
    name: 'Tuesday',
    format: 'americano',
    scoring: { mode: 'points', target: 24 },
    courts: 2,
    plannedRounds: 3,
    playerNames: ['A', 'B', 'C', 'D'],
  };

  it('a new session has never been shared', () => {
    const state = reducer(initialState, { type: 'CREATE', input });
    expect(state.tournament!.share).toBeNull();
  });

  it('attaches and then replaces a code', () => {
    let state = reducer(initialState, { type: 'CREATE', input });
    const first = newShare(1);
    state = reducer(state, { type: 'SET_SHARE', share: first });
    expect(state.tournament!.share).toEqual(first);

    const second = newShare(2);
    state = reducer(state, { type: 'SET_SHARE', share: second });
    expect(state.tournament!.share).toEqual(second);
  });

  it('is a no-op when nothing changed, so no save is queued', () => {
    let state = reducer(initialState, { type: 'CREATE', input });
    const share = newShare(1);
    state = reducer(state, { type: 'SET_SHARE', share });
    const same = reducer(state, { type: 'SET_SHARE', share: { ...share } });
    expect(same).toBe(state);
  });

  it('revoking clears it', () => {
    let state = reducer(initialState, { type: 'CREATE', input });
    state = reducer(state, { type: 'SET_SHARE', share: newShare(1) });
    state = reducer(state, { type: 'SET_SHARE', share: null });
    expect(state.tournament!.share).toBeNull();
  });
});

describe('store lookup by code', () => {
  it('resolves a shared session and nothing else', async () => {
    const shared = makeTournament({ id: 'a', share: { code: 'K7M4QD', createdAt: 1 } });
    const private_ = makeTournament({ id: 'b', share: null });
    const store = createMemoryStore([shared, private_]);

    expect((await store.getByShareCode('K7M4QD'))?.id).toBe('a');
    expect(await store.getByShareCode('NOPE22')).toBeNull();
  });

  it('a regenerated code orphans the old one', async () => {
    const t = makeTournament({ id: 'a', share: { code: 'K7M4QD', createdAt: 1 } });
    const store = createMemoryStore([t]);
    await store.save({ ...t, share: { code: 'X9P2TT', createdAt: 2 } });

    expect(await store.getByShareCode('K7M4QD')).toBeNull();
    expect((await store.getByShareCode('X9P2TT'))?.id).toBe('a');
  });
});

describe('migrating a session from before sharing existed', () => {
  it('reads as never shared rather than being backfilled a code', async () => {
    const { migrate } = await import('@/lib/store');
    const legacy = { ...makeTournament({ id: 'old' }) } as Record<string, unknown>;
    delete legacy.share;
    expect(migrate(legacy)?.share).toBeNull();
  });
});
