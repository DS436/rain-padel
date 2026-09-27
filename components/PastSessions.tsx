'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Tournament } from '@/lib/types';
import { recentNights, type LastNight } from '@/lib/dashboard';
import { getStore } from '@/lib/store/factory';
import { formatSpec } from '@/lib/formats';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Group, PageTitle, TopBar } from '@/components/ui';
import { X } from '@/components/icons';

/** A row on this page: a scored night, or one still open with nothing in it. */
type Row = LastNight & { open: boolean; scored: boolean };

/**
 * Every night, newest first — the list that used to sit under the home
 * screen's "Recent" heading, given a page of its own now that home is one
 * sentence and three doors.
 *
 * It is also where deleting lives. A night is deleted from here and nowhere
 * else, behind a confirm, because it takes every score in it with it.
 *
 * Scored nights come from `recentNights` so this list and the home page's
 * count can never disagree. Open nights with no score yet are added on top:
 * they are not "played" in the dashboard's sense, but an abandoned setup
 * still has to be reachable to be resumed or cleared away.
 */
export function PastSessions() {
  const [sessions, setSessions] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** bumping this re-runs the load effect; avoids setState during render */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getStore()
      .listAll()
      .then((all) => {
        if (cancelled) return;
        setSessions(all);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSessions((s) => s ?? []);
        setError(e instanceof Error ? e.message : 'Could not reach the database.');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const rows = useMemo<Row[]>(() => {
    const all = sessions ?? [];
    const status = new Map(all.map((t) => [t.id, t.status] as const));
    const scored: Row[] = recentNights(all).map((n) => ({
      ...n,
      open: status.get(n.id) === 'live',
      scored: true,
    }));
    const seen = new Set(scored.map((n) => n.id));
    const unscored: Row[] = all
      .filter((t) => t.status === 'live' && !seen.has(t.id))
      .map((t) => ({
        id: t.id,
        name: t.name,
        playedAt: t.createdAt,
        format: t.format,
        winner: null,
        winnerColor: undefined,
        winnerPoints: 0,
        players: t.players.length,
        open: true,
        scored: false,
      }));
    return [...scored, ...unscored].sort((a, b) => b.playedAt - a.playedAt);
  }, [sessions]);

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await getStore().remove(id);
      setReloadToken((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that session.');
    }
  }

  const played = rows.filter((r) => r.scored).length;

  return (
    <>
      <DevStoreBanner />
      <main className="mx-auto flex w-full max-w-lg flex-col pb-16">
        <TopBar back={{ href: '/sessions', label: 'Home' }} />
        <PageTitle
          sub={sessions === null ? ' ' : `${played} night${played === 1 ? '' : 's'}`}
        >
          Past sessions
        </PageTitle>

        <div className="px-6 pt-5">
          {error ? <p className="mb-3 px-1 text-[13px] text-danger">{error}</p> : null}

          {sessions === null ? (
            <p className="px-1 text-sm text-ink-faint">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="card px-5 py-6 text-center text-sm leading-relaxed text-ink-dim">
              Nothing played yet. Every night you run lands here, with who won it.
            </p>
          ) : (
            <Group as="ul">
              {rows.map((n) => (
                <li key={n.id} className="flex items-stretch">
                  <Link
                    href={`/t/${n.id}`}
                    className="flex min-h-[62px] min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 active:bg-surface-2"
                  >
                    <span className="nums w-8 flex-none text-center text-xs leading-tight text-ink-faint">
                      <span className="block text-[15px] font-semibold text-ink-dim">
                        {new Date(n.playedAt).getDate()}
                      </span>
                      {new Date(n.playedAt).toLocaleDateString('en-GB', { month: 'short' })}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-medium">{n.name}</span>
                      <span className="truncate text-xs text-ink-faint">
                        {formatSpec(n.format).name} · {n.players} players
                        {n.open ? ' · still open' : ''}
                      </span>
                    </span>
                    {n.winner ? (
                      <span className="flex flex-none items-center gap-1.5">
                        <PlayerAvatar name={n.winner} color={n.winnerColor} size="sm" />
                        <span className="nums w-7 text-right text-[15px] font-semibold">
                          {n.winnerPoints}
                        </span>
                      </span>
                    ) : null}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(n.id, n.name)}
                    aria-label={`Delete ${n.name}`}
                    className="inline-flex w-11 flex-none items-center justify-center text-ink-faint active:text-danger"
                  >
                    <X size="sm" />
                  </button>
                </li>
              ))}
            </Group>
          )}
        </div>
      </main>
    </>
  );
}
