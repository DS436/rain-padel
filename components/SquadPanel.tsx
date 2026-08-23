'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PlayerProfile } from '@/lib/players';
import { getPlayerStore } from '@/lib/store/playerStore';
import { PlayerAvatar } from '@/components/PlayerAvatar';

/**
 * The squad, on the sessions screen.
 *
 * The regulars were already saved and already one tap away inside the setup
 * form, but you had to know that: the only route to them was a small "Players"
 * link, so the squad felt like a settings page rather than the thing the app is
 * built around. This puts the names on the screen you land on after signing in.
 *
 * Deliberately read-only. Adding, renaming and archiving all still live on
 * `/players`, because this is a reminder of who your people are, not a second
 * editor to keep in sync with the first.
 */
export function SquadPanel() {
  const [squad, setSquad] = useState<PlayerProfile[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPlayerStore()
      .list()
      .then((list) => {
        if (!cancelled) setSquad(list.filter((p) => !p.archived));
      })
      // A squad that will not load must not take the sessions list down with
      // it — this is the secondary thing on the page.
      .catch(() => {
        if (!cancelled) setSquad([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (squad === null || squad.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Your players
          </h2>
          <Link href="/players" className="text-sm text-accent underline underline-offset-4">
            {squad === null ? '' : 'Add'}
          </Link>
        </div>
        <p className="mt-2 text-sm text-ink-dim">
          {squad === null
            ? 'Loading…'
            : 'Save your regulars once and they are one tap away every week.'}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Your players
          <span className="nums ml-2 font-normal text-ink-faint">{squad.length}</span>
        </h2>
        <Link href="/players" className="text-sm text-accent underline underline-offset-4">
          Manage
        </Link>
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {squad.map((p) => (
          <li
            key={p.id}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-ground pl-1 pr-3 text-xs text-ink-dim"
          >
            <PlayerAvatar name={p.name} color={undefined} size="sm" />
            {p.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
