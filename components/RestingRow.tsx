import type { Id } from '@/lib/types';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PauseCircle } from '@/components/icons';

/**
 * Who is sitting this one out.
 *
 * This used to be one line of small grey text under the last court, which is
 * the wrong weight for it. When your group does not divide by four, "am I on
 * this game?" is the single most asked question of the night — asked out loud,
 * across a court, by someone who cannot read a caption from where they are
 * standing. So it is a card with faces on it.
 *
 * The redesign flattens it to a single row: the faces and the names are the
 * whole message, and the paragraph explaining that sit-outs are levelled was
 * reassurance nobody reads twice. It lives in the rules now.
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
    <section className="flex items-center gap-3 rounded-[18px] border border-warn/[0.28] bg-warn/[0.06] px-3.5 py-2.5">
      <h3 className="sr-only">Sitting out this game</h3>
      <PauseCircle size="sm" className="text-warn" />
      <ul className="flex flex-1 flex-wrap gap-x-3.5 gap-y-2">
        {resting.map((id) => (
          <li key={id} className="flex items-center gap-[7px]">
            <PlayerAvatar name={names.get(id) ?? '?'} color={colors?.get(id)} size="md" />
            <span className="disp text-[13.5px] font-bold">{names.get(id) ?? 'Unknown'}</span>
          </li>
        ))}
      </ul>
      <span className="nums flex-none font-mono text-[9.5px] font-medium text-ink-faint">
        back next
      </span>
    </section>
  );
}
