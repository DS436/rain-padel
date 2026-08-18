import { isSupabaseConfigured } from '@/lib/store';

/**
 * The app has exactly one store, and it is Supabase. Without credentials it
 * falls back to memory so development is not blocked — but that fallback must
 * never be mistaken for working persistence, hence this.
 */
export function DevStoreBanner() {
  if (isSupabaseConfigured()) return null;
  return (
    <p className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-center text-xs text-warn">
      No database connected — sessions vanish on refresh. Add your Supabase keys to{' '}
      <code className="font-mono">.env.local</code>.
    </p>
  );
}
