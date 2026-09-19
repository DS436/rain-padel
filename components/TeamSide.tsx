'use client';

import type { Id } from '@/lib/types';
import { AvatarStack } from '@/components/PlayerAvatar';

/**
 * One side of a court, as a panel you can hit with a thumb.
 *
 * The two sides sit next to each other with the score under the names, which
 * is how the court itself is arranged — you look left, you look right. The
 * older stacked-rows version solved the problem this one still has to solve,
 * which is that a score must never be separable from the people it belongs to:
 * the names, the faces and the number are inside the same button, and the
 * selected side is ringed in the accent as well as tinted, because colour
 * alone does not survive a phone held at arm's length in daylight.
 */
export function TeamSide({
  players,
  names,
  colors,
  score,
  selected = false,
  onSelect,
  won = false,
  size = 'lg',
}: {
  players: readonly [Id, Id];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  score: number | null;
  /** Entry mode: this is the side the number pad is currently driving. */
  selected?: boolean;
  /** Omitted on a locked card, which makes the panel a div rather than a button. */
  onSelect?: () => void;
  /** Read-only: outscored the other side. */
  won?: boolean;
  /** `lg` is the court you are scoring; `sm` is a card that is already done. */
  size?: 'lg' | 'sm';
}) {
  const label = players.map((id) => names.get(id) ?? 'Unknown').join(' · ');
  const lg = size === 'lg';

  const lit = selected || (!onSelect && won);
  const shell = `flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-[15px] border px-1.5 ${
    lg ? 'py-2.5' : 'py-2.5'
  } ${
    selected
      ? 'border-accent bg-accent/10'
      : won && !onSelect
        ? 'border-accent/25 bg-surface-2'
        : 'border-line bg-surface-2'
  }`;

  const body = (
    <>
      <AvatarStack
        people={players.map((id) => ({
          name: names.get(id) ?? '?',
          color: colors.get(id),
        }))}
        size={lg ? 'sm' : 'xs'}
        ring="var(--color-surface-2)"
      />
      <span
        className={`max-w-full truncate font-medium ${lg ? 'text-xs' : 'text-[11.5px]'} ${
          lit ? 'text-ink' : 'text-ink-dim'
        }`}
      >
        {label}
      </span>
      <span
        className={`nums disp font-bold leading-none ${lg ? 'text-[38px]' : 'text-[28px]'} ${
          score === null ? 'text-ink-faint' : lit ? 'text-accent' : 'text-ink-dim'
        }`}
      >
        {score === null ? '–' : score}
      </span>
      {selected ? <span className="sr-only">Entering score for this pair</span> : null}
    </>
  );

  if (!onSelect) return <div className={shell}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Enter the score for ${label}`}
      className={`${shell} active:opacity-70`}
    >
      {body}
    </button>
  );
}

/** The word between the two panels. Small, grey, and never in the tab order. */
export function Versus() {
  return (
    <span aria-hidden className="flex-none self-center text-[11px] font-semibold text-ink-faint">
      vs
    </span>
  );
}
