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

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2">
        {squad.map((p) => {
          const on = chosen.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={disabled && !on}
                onClick={() => onToggle({ name: p.name, profileId: p.id })}
                aria-pressed={on}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border pl-1.5 pr-4 text-sm transition-colors disabled:opacity-40 ${
                  on ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-surface text-ink-dim'
                }`}
              >
                <PlayerAvatar name={p.name} color={on ? undefined : FALLBACK_COLOR} size="sm" />
                {p.name}
              </button>
            </li>
          );
        })}
      </ul>
      <Link href="/players" className="self-start text-xs text-ink-faint underline underline-offset-4">
        Manage squad
      </Link>
    </div>
  );
}
