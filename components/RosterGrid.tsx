'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RosterEntry } from '@/lib/types';
import type { PlayerProfile } from '@/lib/players';
import { getPlayerStore } from '@/lib/store/playerStore';
import { colorAt, initial } from '@/components/PlayerAvatar';
import { Plus } from '@/components/icons';

/**
 * "Who turned up" — the whole squad as a grid of faces you tap on and off.
 *
 * This replaces the old add-only list, which removed a person from the picker
 * the moment you chose them. That read as a filter rather than a roster:
 * organisers lost track of who they had already tapped and went looking for
 * them in the text field. Here nobody ever leaves the grid — picked faces are
 * ringed and ticked, the rest are dimmed, and the count at the top is the
 * answer to the only question this screen asks.
 *
 * Names typed by hand sit in the same grid after the saved squad, so a guest
 * is removed the same way a regular is.
 */
export function RosterGrid({
  selected,
  onToggle,
  onRemove,
  onAdd,
  disabled = false,
}: {
  selected: RosterEntry[];
  onToggle: (entry: RosterEntry) => void;
  /** for an ad-hoc name, which has no profile to toggle against */
  onRemove: (index: number) => void;
  onAdd: () => void;
  disabled?: boolean;
}) {
  const [squad, setSquad] = useState<PlayerProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPlayerStore()
      .list()
      .then((list) => {
        if (!cancelled) setSquad(list.filter((p) => !p.archived));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the squad.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chosen = new Set(selected.map((e) => e.profileId).filter(Boolean));
  const saved = squad ?? [];
  // A typed name is anything in the roster that did not come from the squad.
  const adhoc = selected
    .map((e, i) => ({ entry: e, index: i }))
    .filter(({ entry }) => !entry.profileId);

  return (
    <div className="flex flex-col gap-3.5">
      {error ? <p className="text-[13px] text-ink-faint">{error}</p> : null}

      {squad === null ? (
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : saved.length === 0 && adhoc.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-ink-faint">
          No saved players yet — add names below, or{' '}
          <Link href="/players" className="text-accent">
            save your regulars
          </Link>{' '}
          and they will be one tap away every week.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {saved.map((p) => {
            const on = chosen.has(p.id);
            const seat = selected.findIndex((e) => e.profileId === p.id);
            return (
              <Face
                key={p.id}
                name={p.name}
                color={on ? colorAt(seat) : undefined}
                on={on}
                disabled={disabled && !on}
                onClick={() => onToggle({ name: p.name, profileId: p.id })}
              />
            );
          })}
          {adhoc.map(({ entry, index }) => (
            <Face
              key={`adhoc-${index}`}
              name={entry.name}
              color={colorAt(index)}
              on
              onClick={() => onRemove(index)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="flex min-h-[46px] w-full items-center gap-2.5 rounded-[13px] border border-dashed border-line px-3.5 text-left text-[13px] font-medium text-ink-faint disabled:opacity-40"
      >
        <Plus size="sm" />
        Add a name
      </button>
    </div>
  );
}

function Face({
  name,
  color,
  on,
  disabled = false,
  onClick,
}: {
  name: string;
  /** the seat colour once picked; unpicked faces stay neutral */
  color: string | undefined;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      aria-label={`${name}${on ? ' — playing tonight, tap to remove' : ' — tap to add'}`}
      className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl px-0.5 py-1.5 disabled:opacity-30"
    >
      <span className="relative">
        <span
          aria-hidden
          style={{
            // an unpicked face is furniture, not a person yet
            backgroundColor: color ?? 'var(--color-line)',
            opacity: on ? 1 : 0.3,
            boxShadow: on
              ? '0 0 0 2px var(--color-ground), 0 0 0 4px var(--color-accent)'
              : undefined,
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold text-white"
        >
          {initial(name)}
        </span>
        {on ? (
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 inline-flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-ground bg-accent text-accent-ink"
          >
            <svg
              viewBox="0 0 24 24"
              width="9"
              height="9"
              fill="none"
              stroke="currentColor"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        ) : null}
      </span>
      <span
        className={`max-w-full truncate text-[11px] font-medium ${
          on ? 'text-ink' : 'text-ink-faint'
        }`}
      >
        {name}
      </span>
    </button>
  );
}
