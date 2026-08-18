import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/store';

/**
 * One browser client for the whole app.
 *
 * This matters: auth state lives on the client instance, so a second
 * createClient() would leave the data layer querying as an anonymous user while
 * the UI believes someone is signed in. Everything goes through here.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured — check NEXT_PUBLIC_SUPABASE_URL.');
  }
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // the session has to survive a refresh and a locked phone
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
