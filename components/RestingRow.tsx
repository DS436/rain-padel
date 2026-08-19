import type { Id } from '@/lib/types';

/**
 * Always rendered, even when empty — players want to see their own name here so
 * they know they have not been forgotten (spec 8.3).
 */
export function RestingRow({ resting, names }: { resting: Id[]; names: Map<Id, string> }) {
  if (resting.length === 0) return null;
  return (
    <p className="rounded-xl border border-line/60 bg-surface/50 px-4 py-3 text-sm text-ink-dim">
      <span className="text-ink-faint">Resting this game — </span>
      {resting.map((id) => names.get(id) ?? 'Unknown').join(', ')}
    </p>
  );
}
