import type { TournamentStore } from '@/lib/store';
import { isSupabaseConfigured } from '@/lib/store';
import { createMemoryStore } from '@/lib/store/memoryStore';
import { createSupabaseStore } from '@/lib/store/supabaseStore';

let cached: TournamentStore | null = null;

/**
 * Supabase when credentials are present, otherwise an in-memory store so the
 * app is runnable before they are wired. Callers should surface
 * `isSupabaseConfigured()` in the UI so the fallback is never mistaken for
 * working persistence.
 */
export function getStore(): TournamentStore {
  cached ??= isSupabaseConfigured() ? createSupabaseStore() : createMemoryStore();
  return cached;
}
