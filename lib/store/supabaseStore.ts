import type { SupabaseClient } from '@supabase/supabase-js';
import type { Id, Tournament } from '@/lib/types';
import { migrate, type TournamentStore, type TournamentSummary } from '@/lib/store';
import { getSupabase } from '@/lib/supabase/client';

const TABLE = 'tournaments';

interface SummaryRow {
  id: string;
  name: string;
  created_at: string;
  status: string;
  player_count: number;
}

export function createSupabaseStore(injected?: SupabaseClient): TournamentStore {
  // Shares the app's single client, so queries carry the signed-in user's token.
  const db = () => injected ?? getSupabase();

  return {
    async list(): Promise<TournamentSummary[]> {
      const { data, error } = await db()
        .from(TABLE)
        .select('id,name,created_at,status,player_count')
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Could not load tournaments: ${error.message}`);

      return (data ?? []).map((r: SummaryRow) => ({
        id: r.id,
        name: r.name,
        createdAt: Date.parse(r.created_at),
        status: r.status === 'finished' ? ('finished' as const) : ('live' as const),
        playerCount: r.player_count,
      }));
    },

    async listAll(): Promise<Tournament[]> {
      const { data, error } = await db()
        .from(TABLE)
        .select('data')
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Could not load tournaments: ${error.message}`);
      return (data ?? [])
        .map((r: { data: unknown }) => migrate(r.data))
        .filter((t): t is Tournament => t !== null);
    },

    async get(id: Id): Promise<Tournament | null> {
      const { data, error } = await db()
        .from(TABLE)
        .select('data')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(`Could not load tournament: ${error.message}`);
      if (!data) return null;
      return migrate((data as { data: unknown }).data);
    },

    /**
     * Resolve a share code to its session.
     *
     * Filtered inside the jsonb blob rather than against a dedicated column,
     * so sharing needed no migration and works the moment the code is deployed
     * — the table is a handful of rows per group, and Postgres scans it in
     * microseconds. If this ever holds tens of thousands of sessions, promote
     * `data->share->>code` to a generated column with an index; nothing above
     * this function would have to change.
     */
    async getByShareCode(code: string): Promise<Tournament | null> {
      const { data, error } = await db()
        .from(TABLE)
        .select('data')
        .eq('data->share->>code', code)
        .limit(1);
      if (error) throw new Error(`Could not open that share code: ${error.message}`);
      const row = (data ?? [])[0] as { data: unknown } | undefined;
      return row ? migrate(row.data) : null;
    },

    async save(t: Tournament): Promise<void> {
      const { error } = await db()
        .from(TABLE)
        .upsert({
          id: t.id,
          name: t.name,
          created_at: new Date(t.createdAt).toISOString(),
          updated_at: new Date().toISOString(),
          status: t.status,
          player_count: t.players.length,
          data: t,
        });
      if (error) throw new Error(`Could not save: ${error.message}`);
    },

    async remove(id: Id): Promise<void> {
      const { error } = await db().from(TABLE).delete().eq('id', id);
      if (error) throw new Error(`Could not delete: ${error.message}`);
    },
  };
}
