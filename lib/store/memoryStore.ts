import type { Id, Tournament } from '@/lib/types';
import { migrate, summarize, type TournamentStore, type TournamentSummary } from '@/lib/store';

/**
 * In-process store. Used by the test suite, and as the dev fallback when no
 * Supabase credentials are present so `npm run dev` works before wiring them.
 *
 * This is NOT localStorage and nothing survives a refresh — that is deliberate,
 * so nobody mistakes it for real persistence.
 */
export function createMemoryStore(seed?: Tournament[]): TournamentStore {
  const rows = new Map<Id, string>();
  for (const t of seed ?? []) rows.set(t.id, JSON.stringify(t));

  return {
    async list(): Promise<TournamentSummary[]> {
      const out: TournamentSummary[] = [];
      for (const json of rows.values()) {
        const t = safeParse(json);
        if (t) out.push(summarize(t));
      }
      return out.sort((a, b) => b.createdAt - a.createdAt);
    },
    async get(id) {
      const json = rows.get(id);
      return json ? safeParse(json) : null;
    },
    async save(t) {
      rows.set(t.id, JSON.stringify(t));
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}

function safeParse(json: string): Tournament | null {
  try {
    return migrate(JSON.parse(json));
  } catch {
    return null;
  }
}
