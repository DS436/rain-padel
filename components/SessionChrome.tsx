'use client';

import type { ReactNode } from 'react';
import { Plus } from '@/components/icons';

/**
 * The top of a session screen, shared by the organiser's view and the
 * spectator's so the two can never drift apart.
 *
 * A white bar with a hairline under it: a 44px slot either side of a centred
 * title and one grey line, then whatever rows the screen stacks under it —
 * in practice the game strip and the tabs.
 */
export function SessionHeader({
  left,
  right,
  title,
  sub,
  onTitle,
  children,
}: {
  left?: ReactNode;
  right?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  /** Makes the title a button — the organiser opens the plan from here. */
  onTitle?: () => void;
  children?: ReactNode;
}) {
  const head = (
    <>
      <span className="block truncate text-base font-semibold">{title}</span>
      {sub ? <span className="block truncate text-xs text-ink-faint">{sub}</span> : null}
    </>
  );
  return (
    <header className="sticky top-0 z-10 bg-surface shadow-[0_1px_0_var(--color-line)]">
      <div className="mx-auto w-full max-w-lg xl:max-w-6xl">
        <div className="flex items-center gap-1.5 px-3 pt-1">
          <span className="flex min-w-11 flex-none items-center">{left}</span>
          {onTitle ? (
            <button
              type="button"
              onClick={onTitle}
              className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-px text-center"
            >
              {head}
            </button>
          ) : (
            <span className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-px text-center">
              {head}
            </span>
          )}
          <span className="flex min-w-11 flex-none items-center justify-end">{right}</span>
        </div>
        {children}
      </div>
    </header>
  );
}

/**
 * Every game in the night as one strip of segments: played ones faint, the one
 * on court solid, the rest grey. It replaces the old rail of numbered pills —
 * the number of the game is in the title line, and the strip answers "how far
 * through are we" at a glance.
 *
 * Tapping a segment opens that game (the organiser only); the + on the end
 * adds a round.
 */
export function GameProgress({
  count,
  current,
  played,
  viewing,
  onSelect,
  onAdd,
  addLabel = 'Add a round',
  labelOf,
}: {
  count: number;
  /** The game on court now; `count` or more once the night is over. */
  current: number;
  /** Whether each game has every score in. */
  played: (i: number) => boolean;
  /** The game being looked at, when it is not the current one. */
  viewing?: number | null;
  onSelect?: (i: number) => void;
  onAdd?: () => void;
  addLabel?: string;
  /** Accessible name for a segment — "Game 3". */
  labelOf?: (i: number) => string;
}) {
  return (
    <div className="flex items-center gap-1 px-6 pb-1 pt-0.5">
      {Array.from({ length: count }, (_, i) => {
        const tone =
          i === current
            ? 'bg-accent'
            : i < current || played(i)
              ? 'bg-accent opacity-35'
              : 'bg-surface-2';
        const ring =
          viewing !== null && viewing !== undefined && viewing === i && i !== current
            ? 'outline outline-2 outline-offset-2 outline-accent !opacity-100'
            : '';
        const bar = <span className={`block h-[5px] w-full rounded-[3px] ${tone} ${ring}`} />;
        return onSelect ? (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={labelOf ? labelOf(i) : `Game ${i + 1}`}
            aria-current={i === current ? 'step' : undefined}
            className="flex h-8 min-w-0 flex-1 items-center"
          >
            {bar}
          </button>
        ) : (
          <span key={i} className="flex h-8 min-w-0 flex-1 items-center">
            {bar}
          </span>
        );
      })}
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          className="-my-1.5 -mr-2.5 ml-0.5 inline-flex h-11 w-11 flex-none items-center justify-center"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-surface-2 text-ink-dim">
            <Plus size="sm" />
          </span>
        </button>
      ) : null}
    </div>
  );
}

/** "Saved" with its green dot — or the retry, when a save failed. */
export function SaveState({ state, onRetry }: { state: string; onRetry: () => void }) {
  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-danger"
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger" />
        Not saved · retry
      </button>
    );
  }
  if (state !== 'saving' && state !== 'saved') return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${state === 'saving' ? 'bg-warn' : 'bg-ok'}`}
      />
      {state === 'saving' ? 'Saving' : 'Saved'}
    </span>
  );
}

/**
 * "Court 1 … Court until 21:30 · plan fits" — the line above each court
 * card. Bold name on the left, one grey remark on the right.
 */
export function CourtHeading({
  name,
  remark,
  remarkTone = 'faint',
}: {
  name: ReactNode;
  remark?: ReactNode;
  remarkTone?: 'faint' | 'accent';
}) {
  return (
    <div className="mb-2.5 mt-5 flex items-baseline justify-between gap-3">
      <h3 className="text-[15px] font-semibold">{name}</h3>
      {remark ? (
        <span
          className={`truncate text-[13px] ${
            remarkTone === 'accent' ? 'font-semibold text-accent-text' : 'text-ink-faint'
          }`}
        >
          {remark}
        </span>
      ) : null}
    </div>
  );
}
