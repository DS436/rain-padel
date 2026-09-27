import { isSupabaseConfigured } from '@/lib/store';

/**
 * The app has exactly one store, and it is Supabase. Without credentials it
 * falls back to memory so development is not blocked — but that fallback must
 * never be mistaken for working persistence, hence this.
 */
export function DevStoreBanner() {
  if (isSupabaseConfigured()) return null;
  return (
    <p className="bg-surface px-4 py-2.5 text-center text-xs text-warn shadow-[0_1px_0_var(--color-line)]">
      No database connected — sessions vanish on refresh. Add your Supabase keys to{' '}
      <span className="font-semibold">.env.local</span>.
    </p>
  );
}
