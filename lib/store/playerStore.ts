import type { Id } from '@/lib/types';
import type { PlayerProfile } from '@/lib/players';
import { isSupabaseConfigured } from '@/lib/store';
import { getSupabase } from '@/lib/supabase/client';

/**
 * The squad list. Same shape and same fallback rule as the tournament store:
 * Supabase when it is configured, an in-process map when it is not, so the app
 * runs before the credentials are wired.
 */
export interface PlayerStore {
  list(): Promise<PlayerProfile[]>;
  save(p: PlayerProfile): Promise<void>;
  remove(id: Id): Promise<void>;
}

const TABLE = 'players';

interface Row {
  id: string;
  name: string;
  created_at: string;
  archived: boolean;
}

export function createSupabasePlayerStore(): PlayerStore {
  const db = () => getSupabase();
  return {
    async list(): Promise<PlayerProfile[]> {
      const { data, error } = await db()
        .from(TABLE)
        .select('id,name,created_at,archived')
        .order('name', { ascending: true });
      if (error) throw new Error(`Could not load players: ${error.message}`);
      return (data ?? []).map((r: Row) => ({
        id: r.id,
        name: r.name,
        createdAt: Date.parse(r.created_at),
        archived: Boolean(r.archived),
      }));
    },
    async save(p: PlayerProfile): Promise<void> {
      const { error } = await db().from(TABLE).upsert({
        id: p.id,
        name: p.name,
        created_at: new Date(p.createdAt).toISOString(),
        archived: p.archived,
      });
      if (error) throw new Error(`Could not save player: ${error.message}`);
    },
    async remove(id: Id): Promise<void> {
      const { error } = await db().from(TABLE).delete().eq('id', id);
      if (error) throw new Error(`Could not remove player: ${error.message}`);
    },
  };
}

export function createMemoryPlayerStore(seed?: PlayerProfile[]): PlayerStore {
  const rows = new Map<Id, PlayerProfile>((seed ?? []).map((p) => [p.id, p] as const));
  return {
    async list() {
      return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    async save(p) {
      rows.set(p.id, p);
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}

let cached: PlayerStore | null = null;

export function getPlayerStore(): PlayerStore {
  cached ??= isSupabaseConfigured() ? createSupabasePlayerStore() : createMemoryPlayerStore();
  return cached;
}
