'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Tournament } from '@/lib/types';
import type { PlayerProfile } from '@/lib/players';
import { careerStats } from '@/lib/players';
import {
  currentLeader,
  dashboardStats,
  emptyDashboard,
  recentNights,
  type LastNight,
} from '@/lib/dashboard';
import { getStore } from '@/lib/store/factory';
import { getPlayerStore } from '@/lib/store/playerStore';
import { formatSpec } from '@/lib/formats';
import { useAuth } from '@/components/AuthProvider';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { PlayerAvatar, initial } from '@/components/PlayerAvatar';
import { Meta, SectionHead } from '@/components/ui';
import { ChevronRight, CrownIcon, Plus, X } from '@/components/icons';
import { Ball } from '@/components/SiteChrome';

/**
 * The screen you land on after signing in.
 *
 * The redesign strips this back to four things: the button that starts a
 * night, the four numbers that say the app is worth opening twice, who is top
 * of the pile, and what happened recently. The rules and the news feed that
 * used to sit underneath have their own pages — on the night itself nobody
 * scrolls past an explainer to reach the button.
 *
 * Everything above that button is derived from the same stored sessions on
 * every render. There is no dashboard table and nothing to backfill; see
 * `lib/dashboard.ts`.
 */
export function Dashboard() {
  const { email, signOut, devMode } = useAuth();
  const [sessions, setSessions] = useState<Tournament[] | null>(null);
  const [squad, setSquad] = useState<PlayerProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getStore().listAll(), getPlayerStore().list()])
      .then(([all, people]) => {
        if (cancelled) return;
        setSessions(all);
        setSquad(people);
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

  const all = useMemo(() => sessions ?? [], [sessions]);
  const stats = useMemo(() => (sessions ? dashboardStats(all) : emptyDashboard()), [sessions, all]);
  const careers = useMemo(() => careerStats(squad, all), [squad, all]);
  const leader = useMemo(() => currentLeader(squad, careers), [squad, careers]);
  const recent = useMemo(() => recentNights(all), [all]);
  const live = useMemo(
    () => all.filter((t) => t.status === 'live').sort((a, b) => b.createdAt - a.createdAt),
    [all],
  );

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await getStore().remove(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that session.');
    }
  }

  const loading = sessions === null;

  return (
    <>
      <DevStoreBanner />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col pb-10 pt-1">
        <header className="flex items-center justify-between px-5 pb-5 pt-2">
          <span className="flex items-center gap-2">
            <Ball className="h-5 w-5" />
            <span className="disp text-[18px] font-bold tracking-[-0.02em]">Rain Padel</span>
          </span>
          <Link
            href="/players"
            aria-label="Your squad"
            title={devMode ? 'Running without a database' : (email ?? 'Your squad')}
            className="-mr-2.5 inline-flex h-11 w-11 items-center justify-center text-ink-dim"
          >
            <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full border border-line bg-surface text-xs font-semibold">
              {email ? initial(email) : 'D'}
            </span>
          </Link>
        </header>

        {error ? (
          <p className="mx-5 mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="px-5 pb-[18px]">
          <Link
            href="/new"
            className="flex min-h-[62px] w-full items-center gap-3 rounded-2xl bg-accent px-[18px] text-left text-accent-ink transition-opacity active:opacity-80"
          >
            <Plus />
            <span className="disp flex-1 text-[18px] font-bold">Start a night</span>
            <ChevronRight size="sm" className="opacity-60" />
          </Link>
        </div>

        {!loading && live[0] ? <ResumeCard live={live} /> : null}

        <StatGrid stats={stats} loading={loading} />

        <Board leader={leader} loading={loading} />

        <Recent
          nights={recent}
          loading={loading}
          onDelete={(id, name) => void remove(id, name)}
        />

        <footer className="flex items-center justify-between gap-3 px-5 pt-8">
            <Link href="/how-to-play" className="min-h-11 text-[11.5px] font-medium text-ink-faint">
              Padel rules
            </Link>
            <Link href="/guide" className="min-h-11 text-[11.5px] font-medium text-ink-faint">
              Using the app
            </Link>
            {devMode ? (
              <span className="min-h-11 text-[11.5px] font-medium text-ink-faint">No database</span>
            ) : (
              <button
                type="button"
                onClick={() => void signOut()}
                className="min-h-11 text-[11.5px] font-medium text-ink-faint"
              >
                Sign out
              </button>
            )}
        </footer>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Resume
 *
 * Not in the mock, and kept anyway: an organiser who locks their phone
 * mid-night has to be able to get back to the live session, and the mock
 * gives no other route to one. Styled as the quiet accent-outlined card the
 * mock uses for "this is happening now" (the schedule's live row).
 * ------------------------------------------------------------------ */

function ResumeCard({ live }: { live: Tournament[] }) {
  const resume = live[0]!;
  return (
    <div className="px-5 pb-[18px]">
      <Link
        href={`/t/${resume.id}`}
        className="flex items-center gap-3 rounded-[14px] border border-accent/35 bg-accent/[0.06] px-3.5 py-2.5 active:bg-accent/15"
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="rp-ping absolute inset-0 rounded-full bg-accent" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-medium">{resume.name} is still live</span>
          <Meta>
            {live.length > 1 ? `${live.length} unfinished · ` : ''}pick up where you left off
          </Meta>
        </span>
        <ChevronRight size="sm" className="ml-auto text-accent" />
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Stats
 * ------------------------------------------------------------------ */

/** 3,900 is four glyphs too many for a quarter of a 390px row. */
function compact(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
}

function StatGrid({ stats, loading }: { stats: ReturnType<typeof dashboardStats>; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-2 px-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[68px] animate-pulse rounded-[13px] border border-line-soft bg-surface"
          />
        ))}
      </div>
    );
  }

  if (stats.nights === 0) {
    return (
      <section className="mx-5 rounded-[18px] border border-line bg-surface p-4">
        <h2 className="disp text-[15px] font-bold">Nothing on the board yet</h2>
        <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-ink-dim">
          Run your first night and this fills up: evenings played, every point scored, who is top
          of the pile, and how each of your regulars is doing over time.
        </p>
      </section>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2 px-5">
      <Stat label="Nights" value={compact(stats.nights)} />
      <Stat label="Games" value={compact(stats.games)} />
      <Stat label="Points" value={compact(stats.points)} />
      <Stat label="People" value={compact(stats.people)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-[3px] rounded-[13px] border border-line-soft bg-surface px-2.5 py-3">
      <span className="nums disp text-[22px] font-bold tracking-[-0.02em]">{value}</span>
      <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * The board
 * ------------------------------------------------------------------ */

function Board({
  leader,
  loading,
}: {
  leader: ReturnType<typeof currentLeader>;
  loading: boolean;
}) {
  if (loading || !leader) return null;

  return (
    <div className="px-5 pt-[22px]">
      <div className="pb-2">
        <SectionHead label="The board" action={{ label: 'Squad', href: '/players', accent: true }} />
      </div>
      <Link
        href="/players"
        className="flex w-full items-center gap-[13px] rounded-[18px] border border-line bg-surface p-4 text-left active:bg-surface-2"
      >
        <span className="relative flex-none">
          <PlayerAvatar name={leader.name} color={undefined} size="lg" />
          <CrownIcon className="absolute -right-1.5 -top-1.5 h-[15px] w-[15px]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="disp truncate text-[17px] font-bold">{leader.name}</span>
          <Meta className="text-[10px]">
            {leader.sessions} night{leader.sessions === 1 ? '' : 's'}
            {leader.titles > 0 ? ` · ${leader.titles} won` : ''}
          </Meta>
        </span>
        <span className="flex-none text-right">
          <span className="nums disp block text-[23px] font-bold text-accent">
            {leader.average.toFixed(1)}
          </span>
          <span className="block text-[8.5px] font-medium uppercase tracking-[0.1em] text-ink-faint">
            per game
          </span>
        </span>
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Recent
 *
 * The mock's "All 14 ›" expands the list in place rather than navigating —
 * there is no all-sessions screen in the redesign, and keeping it here is
 * what keeps delete reachable.
 * ------------------------------------------------------------------ */

const RECENT_SHOWN = 5;

function Recent({
  nights,
  loading,
  onDelete,
}: {
  nights: LastNight[];
  loading: boolean;
  onDelete: (id: string, name: string) => void;
}) {
  const [all, setAll] = useState(false);
  if (loading || nights.length === 0) return null;

  const shown = all ? nights : nights.slice(0, RECENT_SHOWN);

  return (
    <div className="pt-[22px]">
      <div className="px-5 pb-1.5">
        <SectionHead
          label="Recent"
          action={
            nights.length > RECENT_SHOWN
              ? { label: all ? 'Show less' : `All ${nights.length}`, onClick: () => setAll((o) => !o) }
              : undefined
          }
        />
      </div>
      <ul>
        {shown.map((n) => (
          <li key={n.id} className="flex items-stretch border-t border-line-soft">
            <Link
              href={`/t/${n.id}`}
              className="flex min-h-[62px] flex-1 items-center gap-3 py-[13px] pl-5 text-left active:bg-surface"
            >
              <span className="nums disp w-8 flex-none text-[11px] font-semibold leading-[1.25] text-ink-faint">
                <span className="block">{new Date(n.playedAt).getDate()}</span>
                <span className="block">
                  {new Date(n.playedAt).toLocaleDateString(undefined, { month: 'short' })}
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14.5px] font-medium">{n.name}</span>
                <Meta>
                  {formatSpec(n.format).name} · {n.players} players
                </Meta>
              </span>
              {n.winner ? (
                <span className="flex flex-none items-center gap-1.5">
                  <PlayerAvatar name={n.winner} color={n.winnerColor} size="sm" />
                  <span className="nums disp w-[26px] text-right text-[18px] font-bold text-accent">
                    {n.winnerPoints}
                  </span>
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={() => onDelete(n.id, n.name)}
              aria-label={`Delete ${n.name}`}
              className="inline-flex w-11 flex-none items-center justify-center text-ink-faint active:text-danger"
            >
              <X size="sm" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
