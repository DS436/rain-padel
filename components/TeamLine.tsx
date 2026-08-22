'use client';

import type { Id } from '@/lib/types';
import { PlayerAvatar } from '@/components/PlayerAvatar';

/**
 * One side of a court: who they are on the left, what they scored on the right.
 *
 * This shape exists because the old card put both scores in the middle as a
 * big "14 – 10" with the two pairs above and below it. That reads fine, but it
 * is unusable for ENTERING a score: you tapped one of the two numbers to
 * choose a side, and nothing on screen tied the number you had selected to the
 * names it belonged to. Land a thumb wrong and you have just given the other
 * pair fourteen points without noticing.
 *
 * Names and score on the same line removes the question entirely.
 */
export function TeamLine({
  players,
  names,
  colors,
  score,
  selected = false,
  onSelect,
  won = false,
  compact = false,
}: {
  players: readonly [Id, Id];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  score: number | null;
  /** Entry mode: this is the side the number pad is currently driving. */
  selected?: boolean;
  /** Omitted on a locked card, which makes the row a div rather than a button. */
  onSelect?: () => void;
  /** Read-only: outscored the other side. */
  won?: boolean;
  compact?: boolean;
}) {
  const label = players.map((id) => names.get(id) ?? 'Unknown').join('  ·  ');

  const body = (
    <>
      {/* The selected side gets a solid bar down its edge as well as a tint —
          a colour change alone is not enough on a phone in daylight. */}
      <span
        aria-hidden
        className={`w-1 self-stretch rounded-full ${selected ? 'bg-accent' : 'bg-transparent'}`}
      />

      <span className="flex shrink-0 -space-x-1.5">
        {players.map((id) => (
          <PlayerAvatar
            key={id}
            name={names.get(id) ?? '?'}
            color={colors.get(id)}
            size={compact ? 'sm' : undefined}
          />
        ))}
      </span>

      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span
          className={`truncate font-medium ${compact ? 'text-sm' : 'text-[15px]'} ${
            selected ? 'text-ink' : 'text-ink'
          }`}
        >
          {label}
        </span>
        {selected ? (
          <span className="text-[10px] uppercase tracking-wider text-accent">Entering</span>
        ) : null}
      </span>

      <span
        className={`nums shrink-0 tabular-nums font-semibold ${compact ? 'text-2xl' : 'text-4xl'} ${
          score === null
            ? 'text-ink-faint'
            : selected || won
              ? 'text-accent'
              : 'text-ink'
        }`}
      >
        {score === null ? '–' : score}
      </span>
    </>
  );

  const shell = `flex w-full items-center gap-3 rounded-xl border px-2 py-2.5 transition-colors ${
    selected ? 'border-accent bg-accent/10' : 'border-line bg-surface-2'
  }`;

  if (!onSelect) {
    return <div className={`${shell} ${won ? 'border-accent/40' : ''}`}>{body}</div>;
  }

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
