import type { PlayMode } from '@/lib/types';
import { feasibility } from '@/lib/format';

/**
 * Spec 8.2. Never phrased as a warning — sit-outs are normal, not an error
 * (spec 9.2), so this just states what will happen.
 */
export function FeasibilityLine({
  units,
  courts,
  mode = 'individual',
}: {
  /** players in individual mode, TEAMS in teams mode */
  units: number;
  courts: number;
  mode?: PlayMode;
}) {
  const ok = units >= (mode === 'teams' ? 2 : 4);
  return (
    <p
      className={`rounded-lg border px-3 py-2 text-sm ${
        ok ? 'border-line bg-surface text-ink-dim' : 'border-warn/40 bg-warn/10 text-warn'
      }`}
    >
      {feasibility(units, courts, mode)}
    </p>
  );
}
