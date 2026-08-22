'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RosterEntry } from '@/lib/types';
import type { PlayerProfile } from '@/lib/players';
import { getPlayerStore } from '@/lib/store/playerStore';
import { PlayerAvatar, FALLBACK_COLOR } from '@/components/PlayerAvatar';

/**
 * Tap the regulars instead of typing them again.
 *
 * The squad is the same eight people most weeks, so retyping the roster every
 * Tuesday was the single most tedious part of setting up. Picking from here
 * also carries `profileId` through to the session, which is what lets the
 * player page show a career record rather than one night's points.
 *
 * Anyone already in tonight's roster is REMOVED from this list rather than
 * shown as selected. A picked-and-highlighted chip reads like a filter, and
 * organisers were tapping the same person twice — once here, once in the text
 * field — and putting them on court against themselves. The list is what is
 * still available; the roster below is who is coming. Removing someone happens
 * there, next to everybody else who was added by hand.
 */
export function SquadPicker({
  selected,
  onToggle,
  disabled = false,
}: {
  selected: RosterEntry[];
  onToggle: (entry: RosterEntry) => void;
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

  if (error) return <p className="text-sm text-ink-faint">{error}</p>;
  if (squad === null) return <p className="text-sm text-ink-faint">Loading the squad…</p>;

  if (squad.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        No saved players yet.{' '}
        <Link href="/players" className="text-accent underline underline-offset-4">
          Add your regulars
        </Link>{' '}
        and they will be one tap away every week.
      </p>
    );
  }

  const chosen = new Set(selected.map((e) => e.profileId).filter(Boolean));
  // Matching on the name too: someone typed by hand before the squad loaded is
  // the same person, and offering them again is the mistake this list is for.
  const typed = new Set(selected.map((e) => e.name.trim().toLowerCase()));
  const available = squad.filter(
    (p) => !chosen.has(p.id) && !typed.has(p.name.trim().toLowerCase()),
  );

  if (available.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        Everyone in your squad is in tonight.{' '}
        <Link href="/players" className="text-accent underline underline-offset-4">
          Manage squad
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2">
        {available.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToggle({ name: p.name, profileId: p.id })}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface pl-1.5 pr-4 text-sm text-ink-dim transition-colors active:bg-surface-2 disabled:opacity-40"
            >
              <PlayerAvatar name={p.name} color={FALLBACK_COLOR} size="sm" />
              {p.name}
              <span aria-hidden className="text-ink-faint">
                +
              </span>
            </button>
          </li>
        ))}
      </ul>
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-faint">
          {available.length} more in your squad · tap to add
        </span>
        <Link href="/players" className="text-xs text-ink-faint underline underline-offset-4">
          Manage squad
        </Link>
      </span>
    </div>
  );
}
