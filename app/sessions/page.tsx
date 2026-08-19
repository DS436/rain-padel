'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { AuthGate } from '@/components/AuthGate';
import { useAuth } from '@/components/AuthProvider';
import { getStore, } from '@/lib/store/factory';
import type { TournamentSummary } from '@/lib/store';

export default function SessionsPage() {
  return (
    <AuthGate>
      <SessionList />
    </AuthGate>
  );
}

function SessionList() {
  const { email, signOut, devMode } = useAuth();
  const [sessions, setSessions] = useState<TournamentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** bumping this re-runs the load effect; avoids setState during render */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getStore()
      .list()
      .then((list) => {
        if (cancelled) return;
        setSessions(list);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSessions([]);
        setError(e instanceof Error ? e.message : 'Could not reach the database.');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const load = () => setReloadToken((n) => n + 1);

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await getStore().remove(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that session.');
    }
  }

  return (
    <>
      <DevStoreBanner />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 pb-32 pt-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Your sessions</h1>
            <p className="mt-1 text-sm text-ink-dim">
              {devMode ? 'Running without a database.' : (email ?? '')}
            </p>
            <Link
              href="/players"
              className="mt-2 inline-block text-sm text-accent underline underline-offset-4"
            >
              Players
            </Link>
          </div>
          {devMode ? null : (
            <button
              type="button"
              onClick={() => void signOut()}
              className="min-h-11 shrink-0 rounded-xl border border-line px-4 text-sm text-ink-dim active:bg-surface-2"
            >
              Sign out
            </button>
          )}
        </header>

        {error ? (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {sessions === null ? (
          <p className="text-ink-faint">Loading…</p>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-6">
            <p className="text-ink-dim">
              No sessions yet. Add everyone who turned up, and the app works out who plays
              with whom — your score is your own, so a weak partner never sinks you.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {sessions.map((s) => (
              <li key={s.id}>
                <div className="flex items-stretch gap-2">
                  <Link
                    href={`/t/${s.id}`}
                    className="flex flex-1 items-center justify-between rounded-2xl border border-line bg-surface p-4 active:bg-surface-2"
                  >
                    <span className="flex flex-col gap-1">
                      <span className="text-lg font-medium">{s.name}</span>
                      <span className="nums text-sm text-ink-dim">
                        {new Date(s.createdAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        · {s.playerCount} players
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        s.status === 'live'
                          ? 'bg-accent/15 text-accent'
                          : 'bg-surface-2 text-ink-faint'
                      }`}
                    >
                      {s.status === 'live' ? 'Live' : 'Done'}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(s.id, s.name)}
                    aria-label={`Delete ${s.name}`}
                    className="min-h-11 min-w-11 rounded-2xl border border-line bg-surface px-3 text-ink-faint active:text-danger"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-ground/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <div className="mx-auto w-full max-w-lg">
          <Link href="/new" className="block">
            <Button className="w-full">New session</Button>
          </Link>
        </div>
      </footer>
    </>
  );
}
