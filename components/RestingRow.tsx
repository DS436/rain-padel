import type { Id } from '@/lib/types';
import { AvatarStack, PlayerAvatar } from '@/components/PlayerAvatar';

/**
 * Who is sitting this one out.
 *
 * This used to be one line of small grey text under the last court, which is
 * the wrong weight for it. When your group does not divide by four, "am I on
 * this game?" is the single most asked question of the night — asked out loud,
 * across a court, by someone who cannot read a caption from where they are
 * standing. So on the organiser's screen it is a card with a big face on it,
 * and it answers the follow-up question too: when am I back on?
 *
 * The spectator's screen has no `backOn` to give, and nobody there is asking
 * across a court, so without it this stays a single quiet line.
 */
export function RestingRow({
  resting,
  names,
  colors,
  backOn,
}: {
  resting: Id[];
  names: Map<Id, string>;
  colors?: Map<Id, string>;
  /** "Back on for game 8" — draws the card. Omit for the quiet line. */
  backOn?: (id: Id) => string;
}) {
  if (resting.length === 0) return null;
  const nameOf = (id: Id) => names.get(id) ?? 'Unknown';

  if (!backOn) {
    const who = resting.map(nameOf);
    const list =
      who.length === 1 ? who[0] : `${who.slice(0, -1).join(', ')} and ${who.at(-1)}`;
    return (
      <p className="mt-3 flex items-center gap-2.5 px-1 text-sm text-ink-dim">
        <AvatarStack
          people={resting.map((id) => ({ name: nameOf(id), color: colors?.get(id) }))}
          size="sm"
          ring="var(--color-ground)"
        />
        <span className="min-w-0">
          {list} {who.length === 1 ? 'sits' : 'sit'} this one out
        </span>
      </p>
    );
  }

  return (
    <section className="card mt-5 divide-y divide-line overflow-hidden">
      <h3 className="sr-only">Sitting out this game</h3>
      {resting.map((id) => (
        <div key={id} className="flex items-center gap-3.5 p-4">
          <PlayerAvatar
            name={nameOf(id)}
            color={colors?.get(id)}
            size="lg"
            className="h-12! w-12! text-[19px]!"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs text-ink-faint">Sitting out</span>
            <span className="mt-0.5 truncate text-[17px] font-semibold">{nameOf(id)}</span>
            <span className="nums mt-0.5 text-[13px] text-ink-faint">{backOn(id)}</span>
          </span>
        </div>
      ))}
    </section>
  );
}
