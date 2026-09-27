import type { PlayMode } from '@/lib/types';
import { feasibility } from '@/lib/format';

/**
 * Spec 8.2. Never phrased as a warning — sit-outs are normal, not an error
 * (spec 9.2), so this just states what will happen.
 *
 * It lives as the second line of the Courts row on the setup screen, so it is
 * the row's 12px grey sub rather than a box of its own. The one time it turns
 * amber is a field too small to fill a single court, which is the only case
 * where the sentence is asking you to do something.
 */
export function FeasibilityLine({
  units,
  courts,
  mode = 'individual',
  className = '',
}: {
  /** players in individual mode, TEAMS in teams mode */
  units: number;
  courts: number;
  mode?: PlayMode;
  className?: string;
}) {
  const ok = units >= (mode === 'teams' ? 2 : 4);
  return (
    <span className={`nums text-xs ${ok ? 'text-ink-faint' : 'text-warn'} ${className}`}>
      {feasibility(units, courts, mode)}
    </span>
  );
}
