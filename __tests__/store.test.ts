import { describe, expect, it } from 'vitest';
import { migrate, summarize } from '@/lib/store';
import { createMemoryStore } from '@/lib/store/memoryStore';
import { createSupabaseStore } from '@/lib/store/supabaseStore';
import { makeMatch, makeRound, makeTournament } from './fixtures';
import { SCHEMA_VERSION } from '@/lib/types';

/**
 * Minimal stand-in for the parts of the supabase-js query builder the adapter
 * uses. Thenable, so `await` works on any point in the chain.
 */
function fakeSupabase() {
  const rows = new Map<string, Record<string, unknown>>();

  const query = (run: () => { data: unknown; error: null }) => {
    let filterVal: string | null = null;
    const self = {
      eq(_col: string, val: string) {
        filterVal = val;
        return self;
      },
      order() {
        return self;
      },
      maybeSingle() {
        const row = filterVal !== null ? rows.get(filterVal) : undefined;
        return Promise.resolve({ data: row ?? null, error: null });
      },
      get _filter() {
        return filterVal;
      },
      then<T>(res: (v: { data: unknown; error: null }) => T) {
        return Promise.resolve(run.call(self)).then(res);
      },
    };
    return self;
  };

  const client = {
    from() {
      return {
        select() {
          return query(function (this: { _filter: string | null }) {
            return { data: [...rows.values()], error: null };
          });
        },
        upsert(row: Record<string, unknown>) {
          rows.set(row.id as string, row);
          return query(() => ({ data: null, error: null }));
        },
        delete() {
          return query(function (this: { _filter: string | null }) {
            if (this._filter) rows.delete(this._filter);
            return { data: null, error: null };
          });
        },
      };
    },
  };

  return { client: client as never, rows };
}

describe('memory store', () => {
  it('round-trips a tournament including a partially entered score', async () => {
    const store = createMemoryStore();
    const t = makeTournament({
      rounds: [
        makeRound({
          index: 0,
          matches: [
            // one court scored, one still blank — the mid-round refresh case
            makeMatch({ id: 'm0', teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], scoreA: 14, scoreB: 10 }),
            makeMatch({ id: 'm1', courtIndex: 1, teamA: ['p4', 'p5'], teamB: ['p6', 'p7'] }),
          ],
        }),
      ],
    });

    await store.save(t);
    const back = await store.get(t.id);

    expect(back).toEqual(t);
    expect(back?.rounds[0]?.matches[0]?.scoreA).toBe(14);
    expect(back?.rounds[0]?.matches[1]?.scoreA).toBeNull();
  });

  it('returns null for an unknown id', async () => {
    const store = createMemoryStore();
    expect(await store.get('nope')).toBeNull();
  });

  it('keeps the list consistent after remove, newest first', async () => {
    const store = createMemoryStore();
    await store.save(makeTournament({ id: 'a', name: 'A', createdAt: 1000 }));
    await store.save(makeTournament({ id: 'b', name: 'B', createdAt: 3000 }));
    await store.save(makeTournament({ id: 'c', name: 'C', createdAt: 2000 }));

    expect((await store.list()).map((s) => s.id)).toEqual(['b', 'c', 'a']);

    await store.remove('b');
    expect((await store.list()).map((s) => s.id)).toEqual(['c', 'a']);
    expect(await store.get('b')).toBeNull();
  });
});

describe('migrate', () => {
  it('defaults a missing schemaVersion rather than rejecting the row', () => {
    const withoutVersion: Record<string, unknown> = { ...makeTournament() };
    delete withoutVersion.schemaVersion;
    expect(migrate(withoutVersion)?.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('returns null for junk instead of throwing', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('not an object')).toBeNull();
    expect(migrate({ id: 'x' })).toBeNull();
    expect(migrate({ id: 42, players: [], rounds: [] })).toBeNull();
  });

  it('coerces an unrecognised status to live', () => {
    expect(migrate({ ...makeTournament(), status: 'wat' })?.status).toBe('live');
  });
});

describe('supabase store', () => {
  it('round-trips through the denormalised columns and the data blob', async () => {
    const { client, rows } = fakeSupabase();
    const store = createSupabaseStore(client);
    const t = makeTournament({ id: '11111111-1111-1111-1111-111111111111' });

    await store.save(t);

    // the list view must not have to read `data`
    const row = rows.get(t.id)!;
    expect(row.name).toBe(t.name);
    expect(row.player_count).toBe(8);
    expect(row.status).toBe('live');

    expect(await store.get(t.id)).toEqual(t);
    expect((await store.list())[0]).toEqual(summarize(t));
  });

  it('returns null for a missing row and deletes by id', async () => {
    const { client } = fakeSupabase();
    const store = createSupabaseStore(client);
    const t = makeTournament({ id: '22222222-2222-2222-2222-222222222222' });

    expect(await store.get(t.id)).toBeNull();
    await store.save(t);
    expect(await store.get(t.id)).not.toBeNull();
    await store.remove(t.id);
    expect(await store.get(t.id)).toBeNull();
    expect(await store.list()).toEqual([]);
  });
});
