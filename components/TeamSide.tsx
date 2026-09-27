'use client';

import type { Id } from '@/lib/types';
import { AvatarStack } from '@/components/PlayerAvatar';

/**
 * One pair on a court, as one row of the court card.
 *
 * The two pairs are stacked, one row each, split by a hairline: faces, the
 * names, and the score on the far right where the eye lands last. The
 * side-by-side panels this replaced read like a court, but they halved the
 * width a name had and put the numbers in two different places; a stack keeps
 * every score in one column, which is what you scan when you want to know who
 * won.
 *
 * What the older version got right still holds: a score must never be
 * separable from the people it belongs to, so the faces, the names and the
 * number are one button. The row the pad is driving is the ONLY tinted thing on
 * the card, and it also says "Scoring" in words, because a tint alone does not
 * survive a phone held at arm's length in daylight.
 */
export function TeamSide({
  players,
  names,
  colors,
  score,
  selected = false,
  nameTone = 'normal',
  scoreTone = 'ink',
  onSelect,
  seed,
  size = 'lg',
}: {
  players: readonly [Id, Id];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  score: number | null;
  /** Entry mode: this is the pair the number pad is currently driving. */
  selected?: boolean;
  /** `strong` for a winner, `dim` for the pair the pad is NOT driving. */
  nameTone?: 'strong' | 'normal' | 'dim';
  /** `faint` for the other side while one is selected, and for a locked card. */
  scoreTone?: 'ink' | 'faint';
  /** Omitted on a locked card, which makes the row a div rather than a button. */
  onSelect?: () => void;
  /** A bracket's seed, drawn as a small number in front of the faces. */
  seed?: number | null;
  /** `lg` is a 60px court row; `sm` is a 52px bracket row. */
  size?: 'lg' | 'sm';
}) {
  const label = players.map((id) => names.get(id) ?? 'Unknown').join(' & ');
  const lg = size === 'lg';

  const nameCls = selected
    ? 'font-semibold text-ink'
    : nameTone === 'strong'
      ? 'font-semibold text-ink'
      : nameTone === 'dim'
        ? 'font-medium text-ink-dim'
        : 'font-medium text-ink';

  const scoreCls =
    score === null
      ? 'text-line'
      : selected
        ? 'text-accent-text'
        : scoreTone === 'faint'
          ? 'text-ink-faint'
          : 'text-ink';

  const shell = `flex w-full items-center px-4 text-left ${lg ? 'h-[60px] gap-3' : 'h-[52px] gap-2.5'} ${
    selected ? 'bg-accent-soft' : ''
  }`;

  const body = (
    <>
      {seed !== undefined ? (
        <span className="nums w-[18px] flex-none text-xs text-ink-faint">{seed ?? ''}</span>
      ) : null}
      <AvatarStack
        people={players.map((id) => ({
          name: names.get(id) ?? '?',
          color: colors.get(id),
        }))}
        size="md"
        ring={selected ? 'var(--color-accent-soft)' : 'var(--color-surface)'}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className={`truncate text-[15px] ${nameCls}`}>{label}</span>
        {selected ? <span className="text-xs text-accent-text">Scoring</span> : null}
      </span>
      <span
        className={`nums flex-none font-semibold leading-none ${lg ? 'text-[30px]' : 'text-xl'} ${scoreCls}`}
      >
        {score === null ? '–' : score}
      </span>
    </>
  );

  if (!onSelect) return <div className={shell}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Enter the score for ${label}${score === null ? '' : `, now ${score}`}`}
      className={`${shell} ${selected ? '' : 'active:bg-surface-2'}`}
    >
      {body}
    </button>
  );
}
