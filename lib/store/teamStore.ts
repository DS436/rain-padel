import type { Id } from '@/lib/types';
import type { TeamProfile } from '@/lib/teams';
import { isSupabaseConfigured } from '@/lib/store';
import { getSupabase } from '@/lib/supabase/client';

/**
 * The saved pairs. Same shape and same fallback rule as the player store:
 * Supabase when it is configured, an in-process map when it is not, so the app
 * still runs before the credentials are wired.
 */
export interface TeamStore {
  list(): Promise<TeamProfile[]>;
  save(t: TeamProfile): Promise<void>;
  remove(id: Id): Promise<void>;
}

const TABLE = 'saved_teams';

interface Row {
  id: string;
  name: string;
  player_a_name: string;
  player_a_profile: string | null;
  player_b_name: string;
  player_b_profile: string | null;
  created_at: string;
  archived: boolean;
}

function toProfile(r: Row): TeamProfile {
  return {
    id: r.id,
    name: r.name,
    players: [
      r.player_a_profile
        ? { name: r.player_a_name, profileId: r.player_a_profile }
        : { name: r.player_a_name },
      r.player_b_profile
        ? { name: r.player_b_name, profileId: r.player_b_profile }
        : { name: r.player_b_name },
    ],
    createdAt: Date.parse(r.created_at),
    archived: Boolean(r.archived),
  };
}

export function createSupabaseTeamStore(): TeamStore {
  const db = () => getSupabase();
  return {
    async list(): Promise<TeamProfile[]> {
      const { data, error } = await db()
        .from(TABLE)
        .select(
          'id,name,player_a_name,player_a_profile,player_b_name,player_b_profile,created_at,archived',
        )
        .order('name', { ascending: true });
      if (error) throw new Error(`Could not load teams: ${error.message}`);
      return (data ?? []).map(toProfile);
    },
    async save(t: TeamProfile): Promise<void> {
      const { error } = await db().from(TABLE).upsert({
        id: t.id,
        name: t.name,
        player_a_name: t.players[0].name,
        player_a_profile: t.players[0].profileId ?? null,
        player_b_name: t.players[1].name,
        player_b_profile: t.players[1].profileId ?? null,
        created_at: new Date(t.createdAt).toISOString(),
        archived: t.archived,
      });
      if (error) throw new Error(`Could not save team: ${error.message}`);
    },
    async remove(id: Id): Promise<void> {
      const { error } = await db().from(TABLE).delete().eq('id', id);
      if (error) throw new Error(`Could not remove team: ${error.message}`);
    },
  };
}

export function createMemoryTeamStore(seed?: TeamProfile[]): TeamStore {
  const rows = new Map<Id, TeamProfile>((seed ?? []).map((t) => [t.id, t] as const));
  return {
    async list() {
      return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    async save(t) {
      rows.set(t.id, t);
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}

let cached: TeamStore | null = null;

export function getTeamStore(): TeamStore {
  cached ??= isSupabaseConfigured() ? createSupabaseTeamStore() : createMemoryTeamStore();
  return cached;
}
