'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Tournament } from '@/lib/types';
import type { NewsItem } from '@/lib/news';
import type { PlayerProfile } from '@/lib/players';
import { careerStats } from '@/lib/players';
import {
  currentLeader,
  dashboardStats,
  favouriteFormatName,
  lastNight,
  emptyDashboard,
} from '@/lib/dashboard';
import { getStore } from '@/lib/store/factory';
import { getPlayerStore } from '@/lib/store/playerStore';
import { formatSpec } from '@/lib/formats';
import { relativeAge } from '@/lib/news';
import { useAuth } from '@/components/AuthProvider';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { SquadPanel } from '@/components/SquadPanel';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Crown } from '@/components/Crown';
import { Ball } from '@/components/SiteChrome';

/**
 * The screen you land on after signing in.
 *
 * It used to be the session list and nothing else, which answered "what did I
 * do before" and never answered "what is this worth". So the list is still
 * here — it is the reason anybody signs in twice — but it is now behind a
 * disclosure, because on the night itself nobody wants to scroll past eleven
 * finished Tuesdays to reach the button that starts the twelfth.
 *
 * Everything above that button is derived from the same stored sessions on
 * every render. There is no dashboard table and nothing to backfill; see
 * `lib/dashboard.ts`.
 */
export function Dashboard({ news, newsFetchedAt }: { news: NewsItem[]; newsFetchedAt: number }) {
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
  const last = useMemo(() => lastNight(all), [all]);
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

  return (
    <>
      <DevStoreBanner />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 pb-16 pt-8">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">
              {stats.nights === 0 ? 'Welcome' : 'Your padel'}
            </h1>
            <p className="mt-1 truncate text-sm text-ink-dim">
              {devMode ? 'Running without a database.' : (email ?? '')}
            </p>
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

        <PlayCta live={live} loading={sessions === null} />

        <StatGrid stats={stats} loading={sessions === null} now={newsFetchedAt} />

        {leader || last ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {leader ? <LeaderCard leader={leader} /> : null}
            {last ? <LastNightCard last={last} /> : null}
          </div>
        ) : null}

        <SquadPanel />

        <PastSessions
          sessions={all}
          loading={sessions === null}
          onDelete={(id, name) => void remove(id, name)}
        />

        <Rules />

        <News items={news} fetchedAt={newsFetchedAt} />
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The button the whole page exists to get you to.
 * ------------------------------------------------------------------ */

function PlayCta({ live, loading }: { live: Tournament[]; loading: boolean }) {
  const resume = live[0];
  return (
    <section className="flex flex-col gap-3">
      <Link
        href="/new"
        className="group flex min-h-20 items-center gap-4 rounded-2xl bg-accent px-5 py-4 text-accent-ink transition-opacity active:opacity-80"
      >
        <Ball className="h-9 w-9 shrink-0 [&_*]:!stroke-[var(--color-accent-ink)]" />
        <span className="flex min-w-0 flex-col">
          <span className="text-2xl font-semibold tracking-tight">Let&rsquo;s padel</span>
          <span className="text-sm opacity-70">
            Add who turned up — we work out the rest
          </span>
        </span>
        <span aria-hidden className="ml-auto text-2xl opacity-60">
          →
        </span>
      </Link>

      {loading ? null : resume ? (
        <Link
          href={`/t/${resume.id}`}
          className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/[0.07] px-4 py-3 active:bg-accent/15"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{resume.name} is still live</span>
            <span className="text-xs text-ink-faint">
              {live.length > 1 ? `${live.length} unfinished sessions · ` : ''}Pick up where you
              left off
            </span>
          </span>
          <span aria-hidden className="ml-auto text-ink-faint">
            →
          </span>
        </Link>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Stats
 * ------------------------------------------------------------------ */

/**
 * `now` is the server's render timestamp, threaded down rather than read from
 * `Date.now()` here. Two reasons: a clock read during render is impure and
 * would disagree between the server pass and hydration, and the alternative —
 * `useNow` — repaints four times a second to move a label that changes once a
 * day.
 */
function StatGrid({
  stats,
  loading,
  now,
}: {
  stats: ReturnType<typeof dashboardStats>;
  loading: boolean;
  now: number;
}) {
  const favourite = favouriteFormatName(stats);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[4.75rem] animate-pulse rounded-2xl border border-line bg-surface" />
        ))}
      </div>
    );
  }

  if (stats.nights === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Nothing on the board yet</h2>
        <p className="mt-2 text-pretty leading-relaxed text-ink-dim">
          Run your first night and this fills up: how many evenings you have played, every point
          scored, who is top of the pile, and how each of your regulars is doing over time.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Nights played" value={stats.nights} />
        <Stat label="Games" value={stats.games} />
        <Stat label="Points scored" value={stats.points} />
        <Stat label="People" value={stats.people} />
      </div>
      {favourite || stats.streakWeeks > 1 || stats.lastPlayed ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-ink-faint">
          {favourite ? (
            <span>
              Mostly <span className="text-ink-dim">{favourite}</span>
            </span>
          ) : null}
          {stats.streakWeeks > 1 ? (
            <span>
              · <span className="nums text-ink-dim">{stats.streakWeeks}</span> weeks on the bounce
            </span>
          ) : null}
          {stats.lastPlayed ? (
            <span>
              ·{' '}
              <span className="text-ink-dim">
                {relativeAge(stats.lastPlayed, now) ?? 'recently'}
              </span>
            </span>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="nums text-2xl font-semibold tracking-tight">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-xs uppercase tracking-[0.12em] text-ink-faint">{label}</div>
    </div>
  );
}

function LeaderCard({ leader }: { leader: NonNullable<ReturnType<typeof currentLeader>> }) {
  return (
    <Link
      href="/players"
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2"
    >
      <PlayerAvatar name={leader.name} color={undefined} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Crown tier={1} className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium">{leader.name}</span>
        </div>
        <p className="nums mt-0.5 text-xs text-ink-faint">
          {leader.average} per game · {leader.sessions} nights
          {leader.titles > 0 ? ` · ${leader.titles} won` : ''}
        </p>
      </div>
    </Link>
  );
}

function LastNightCard({ last }: { last: NonNullable<ReturnType<typeof lastNight>> }) {
  return (
    <Link
      href={`/t/${last.id}`}
      className="flex flex-col justify-between gap-2 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2"
    >
      <div className="min-w-0">
        <span className="text-[10px] uppercase tracking-[0.14em] text-accent">Last night</span>
        <p className="mt-1 truncate font-medium">{last.name}</p>
      </div>
      <p className="nums text-xs text-ink-faint">
        {formatSpec(last.format).name} · {last.players} players
        {last.winner ? ` · ${last.winner} won on ${last.winnerPoints}` : ''}
      </p>
    </Link>
  );
}

/* ------------------------------------------------------------------ *
 * The old list, now opt-in.
 * ------------------------------------------------------------------ */

function PastSessions({
  sessions,
  loading,
  onDelete,
}: {
  sessions: Tournament[];
  loading: boolean;
  onDelete: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ordered = useMemo(
    () => [...sessions].sort((a, b) => b.createdAt - a.createdAt),
    [sessions],
  );

  if (loading) return null;

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 text-left active:bg-surface-2"
      >
        <span className="flex flex-col">
          <span className="font-medium">Past sessions</span>
          <span className="nums text-xs text-ink-faint">
            {ordered.length === 0
              ? 'Nothing here yet'
              : `${ordered.length} session${ordered.length === 1 ? '' : 's'}`}
          </span>
        </span>
        <span
          aria-hidden
          className={`text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>

      {open ? (
        ordered.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-5 text-pretty leading-relaxed text-ink-dim">
            No sessions yet. Add everyone who turned up, and the app works out who plays with
            whom — your score is your own, so a weak partner never sinks you.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {ordered.map((s) => (
              <li key={s.id}>
                <div className="flex items-stretch gap-2">
                  <Link
                    href={`/t/${s.id}`}
                    className="flex flex-1 items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-lg font-medium">{s.name}</span>
                      <span className="nums text-sm text-ink-dim">
                        {new Date(s.createdAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        · {s.players.length} players · {formatSpec(s.format).name}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
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
                    onClick={() => onDelete(s.id, s.name)}
                    aria-label={`Delete ${s.name}`}
                    className="min-h-11 min-w-11 rounded-2xl border border-line bg-surface px-3 text-ink-faint active:text-danger"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

/**
 * The rules worth having on the screen you look at while people are arriving.
 *
 * Deliberately the short version with a link out, not a copy of
 * `/how-to-play` — two places to edit the same paragraph is how one of them
 * goes stale. The format list renders from `ALL_FORMATS`, so a fifth format
 * appears here on its own.
 */
function Rules() {
  const RULES = [
    {
      tag: 'Scoring',
      title: 'Everyone banks the team score',
      body: 'A 24-point game ending 14–10 gives both winners 14 and both losers 10. You collect points, not victories — which is why a weak draw costs you a few points rather than your evening.',
    },
    {
      tag: 'Serving',
      title: 'Two points, then hand it over',
      body: 'No games to hold, so the serve just rotates: a side serves two consecutive points and passes it on. Some groups rotate per player instead — three serves each in a 24, four in a 32. Agree it before the first serve.',
    },
    {
      tag: 'Mexicano',
      title: 'Round one is a random draw',
      body: 'After that everyone is re-ranked on points and grouped in fours — ranks one to four on court one. Within each four, first plays with fourth against second with third. Five to eight rounds is a normal night.',
    },
    {
      tag: 'Sit-outs',
      title: 'Nobody sits twice before everybody sits once',
      body: 'Any group that is not a multiple of four means somebody rests each game. The rotation levels those out rather than picking at random, and it never singles out whoever is winning.',
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Rules worth knowing
        </h2>
        <Link href="/how-to-play" className="text-sm text-accent underline underline-offset-4">
          All the rules
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {RULES.map((r) => (
          <article key={r.title} className="rounded-2xl border border-line bg-surface p-4">
            <span className="text-[10px] uppercase tracking-[0.14em] text-accent">{r.tag}</span>
            <h3 className="mt-1 text-sm font-semibold">{r.title}</h3>
            <p className="mt-1.5 text-pretty text-sm leading-relaxed text-ink-dim">{r.body}</p>
          </article>
        ))}
      </div>

      <Link
        href="/guide"
        className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 text-sm active:bg-surface-2"
      >
        <span className="text-ink-dim">How to use the app, end to end</span>
        <span aria-hidden className="text-ink-faint">
          →
        </span>
      </Link>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * News
 * ------------------------------------------------------------------ */

/**
 * Fetched on the server and cached for an hour — see `lib/news.ts`. Feed
 * content is somebody else's, so titles render as React text and links are
 * validated http(s) upstream before they ever reach an href.
 */
function News({ items, fetchedAt }: { items: NewsItem[]; fetchedAt: number }) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        Around padel
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const age = relativeAge(item.published, fetchedAt);
          return (
            <li key={item.link}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent/40"
              >
                <span className="text-pretty text-sm font-medium leading-snug">{item.title}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                  <span className="text-ink-dim">{item.source}</span>
                  {item.language ? <span>· {item.language}</span> : null}
                  {age ? <span>· {age}</span> : null}
                  <span aria-hidden className="ml-auto">
                    ↗
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
