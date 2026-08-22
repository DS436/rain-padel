import type { Id } from '@/lib/types';
import { PlayerAvatar } from '@/components/PlayerAvatar';

/**
 * Who is sitting this one out.
 *
 * This used to be one line of small grey text under the last court, which is
 * the wrong weight for it. When your group does not divide by four, "am I on
 * this game?" is the single most asked question of the night — asked out loud,
 * across a court, by someone who cannot read a caption from where they are
 * standing. So it is a card with faces on it, at a size that survives being
 * held up.
 */
export function RestingRow({
  resting,
  names,
  colors,
}: {
  resting: Id[];
  names: Map<Id, string>;
  colors?: Map<Id, string>;
}) {
  if (resting.length === 0) return null;

  return (
    <section className="rounded-2xl border border-warn/30 bg-warn/[0.07] p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-warn">
        <span aria-hidden>⏸</span>
        Sitting out this game
      </h3>
      <ul className="flex flex-wrap gap-x-5 gap-y-3">
        {resting.map((id) => (
          <li key={id} className="flex items-center gap-2.5">
            <PlayerAvatar
              name={names.get(id) ?? '?'}
              color={colors?.get(id)}
              size="lg"
            />
            <span className="text-lg font-semibold text-ink">{names.get(id) ?? 'Unknown'}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-faint">
        The rotation levels sit-outs, so nobody waits twice while somebody else has not waited
        once.
      </p>
    </section>
  );
}
