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
  favouriteFormatName,
  recentNights,
  type LastNight,
} from '@/lib/dashboard';
import { getStore } from '@/lib/store/factory';
import { getPlayerStore } from '@/lib/store/playerStore';
import { useAuth } from '@/components/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { AvatarStack, PlayerAvatar, initial } from '@/components/PlayerAvatar';
import { Group, ListRow, PrimaryButton } from '@/components/ui';
import { BookOpen, ChevronRight, Clock, Plus, Users } from '@/components/icons';
import { Ball } from '@/components/SiteChrome';
import { squadColors } from '@/components/PlayersView';

/**
 * The screen you land on after signing in.
 *
 * The cobalt list strips this back to one sentence and three doors: a
 * headline that says how much padel has been played, the button that starts
 * a night (and, when one is still running, the way back into it), who is top
 * of the pile, and one grouped list for everything else — past nights, the
 * squad, the rules. The four stat tiles that used to sit here became the
 * headline; the recent-nights list became its own page, one tap away.
 *
 * Only two things on the screen are coloured: "Let's padel" and "Resume".
 * Everything else is ink on white, so the eye has nowhere else to go.
 *
 * Everything above the button is derived from the same stored sessions on
 * every render. There is no dashboard table and nothing to backfill; see
 * `lib/dashboard.ts`.
 */
export function Dashboard() {
  const { email, signOut, devMode } = useAuth();
  const [sessions, setSessions] = useState<Tournament[] | null>(null);
  const [squad, setSquad] = useState<PlayerProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  /**
   * When the sessions arrived. The "weeks on the bounce" streak is counted
   * back from this rather than from a clock read during render, which would
   * make the headline a different sentence on every repaint.
   */
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getStore().listAll(), getPlayerStore().list()])
      .then(([all, people]) => {
        if (cancelled) return;
        setSessions(all);
        setSquad(people);
        setLoadedAt(Date.now());
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
  }, []);

  const all = useMemo(() => sessions ?? [], [sessions]);
  const stats = useMemo(() => (sessions ? dashboardStats(all) : emptyDashboard()), [sessions, all]);
  const careers = useMemo(() => careerStats(squad, all), [squad, all]);
  const leader = useMemo(() => currentLeader(squad, careers), [squad, careers]);
  const recent = useMemo(() => recentNights(all), [all]);
  const colors = useMemo(() => squadColors(squad), [squad]);
  const live = useMemo(
    () => all.filter((t) => t.status === 'live').sort((a, b) => b.createdAt - a.createdAt),
    [all],
  );
  const streak = useMemo(() => currentStreak(recent, loadedAt), [recent, loadedAt]);

  const loading = sessions === null;
  // The faces on the Squad row: the regulars still in the picker, most
  // recently added last so the stack reads as "the usual lot".
  const faces = squad.filter((p) => !p.archived).slice(0, 4);

  return (
    <>
      <DevStoreBanner />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between py-2 pl-6 pr-5">
          <span className="flex items-center gap-2">
            <Ball className="h-[22px] w-[22px]" />
            <span className="text-base font-semibold text-ink-dim">Rain Padel</span>
          </span>
          <span className="flex items-center">
            <ThemeToggle />
            <Link
              href="/players"
              aria-label="Your squad"
              title={devMode ? 'Running without a database' : (email ?? 'Your squad')}
              className="inline-flex h-11 w-11 items-center justify-center"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-text">
                {email ? initial(email) : 'D'}
              </span>
            </Link>
          </span>
        </header>

        {error ? <p className="mx-6 mt-3 text-sm text-danger">{error}</p> : null}

        <Headline
          loading={loading}
          nights={stats.nights}
          points={stats.points}
          people={stats.people}
          favourite={favouriteFormatName(stats)}
          streak={streak}
        />

        <div className="flex flex-col gap-2.5 px-6 pt-7">
          <PrimaryButton href="/new">
            Let&rsquo;s padel
            <Plus />
          </PrimaryButton>
          {!loading && live[0] ? <ResumeRow live={live} /> : null}
        </div>

        {!loading && leader ? (
          <div className="card mx-6 mt-7 flex items-center gap-3.5 p-4">
            <PlayerAvatar name={leader.name} color={colors.get(leader.profileId)} size="lg" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-ink-faint">Top of the board</span>
              <span className="mt-0.5 truncate text-base font-semibold">{leader.name}</span>
            </span>
            <span className="flex-none text-right">
              <span className="nums block text-[22px] font-semibold text-accent-text">
                {leader.average.toFixed(1)}
              </span>
              <span className="block text-xs text-ink-faint">per game</span>
            </span>
          </div>
        ) : null}

        <Group className={`mx-6 ${!loading && leader ? 'mt-3' : 'mt-7'}`}>
          <ListRow
            href="/sessions/past"
            minH="min-h-[60px]"
            lead={<Clock className="h-5 w-5" />}
            title="Past sessions"
            sub={recent[0] ? lastLine(recent[0]) : loading ? undefined : 'Nothing played yet'}
            trailing={
              recent.length > 0 ? (
                <span className="nums text-sm text-ink-faint">{recent.length}</span>
              ) : null
            }
            chevron
          />
          <ListRow
            href="/players"
            minH="min-h-[60px]"
            lead={<Users className="h-5 w-5" />}
            title="Squad"
            sub={faces.length === 0 && !loading ? 'Save the people you play with' : undefined}
            trailing={
              faces.length > 0 ? (
                <AvatarStack
                  size="sm"
                  people={faces.map((p) => ({ name: p.name, color: colors.get(p.id) }))}
                />
              ) : null
            }
            chevron
          />
          <ListRow
            href="/how-to-play"
            minH="min-h-[60px]"
            lead={<BookOpen className="h-5 w-5" />}
            title="Rules while you wait"
            sub="Scoring, serving, sit-outs"
            chevron
          />
        </Group>

        {/* Pushed to the bottom of the screen, not the bottom of the list —
            these are the ways out, and they sit where a thumb expects them. */}
        <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-4 px-6 pt-10 text-[13px] text-ink-faint">
          <Link href="/how-to-play" className="inline-flex min-h-11 items-center">
            How to play
          </Link>
          <Link href="/guide" className="inline-flex min-h-11 items-center">
            Using the app
          </Link>
          <Link href="/watch" className="inline-flex min-h-11 items-center">
            Watch a night
          </Link>
          {devMode ? (
            <span className="inline-flex min-h-11 items-center">No database</span>
          ) : (
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex min-h-11 items-center"
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
 * The headline
 *
 * The four stat tiles, said as a sentence. Games played dropped out: it is
 * the one number nobody quotes, and "nights" already says how much padel.
 * ------------------------------------------------------------------ */

function Headline({
  loading,
  nights,
  points,
  people,
  favourite,
  streak,
}: {
  loading: boolean;
  nights: number;
  points: number;
  people: number;
  favourite: string | null;
  streak: number;
}) {
  if (loading) {
    return (
      <div className="px-6 pt-9" aria-busy>
        <div className="h-[18px] w-32 animate-pulse rounded-md bg-surface-2" />
        <div className="mt-2 h-[46px] w-48 animate-pulse rounded-lg bg-surface-2" />
        <div className="mt-3 h-[18px] w-56 animate-pulse rounded-md bg-surface-2" />
      </div>
    );
  }

  if (nights === 0) {
    return (
      <div className="px-6 pt-9">
        <p className="text-sm text-ink-faint">Your padel so far</p>
        <h1 className="mt-1.5 text-[44px] font-semibold leading-[1.05] tracking-[-0.035em]">
          Nothing yet
        </h1>
        <p className="mt-2 text-pretty text-[15px] leading-normal text-ink-dim">
          Run your first night and this fills up: evenings played, every point scored, and who is
          top of the pile.
        </p>
      </div>
    );
  }

  const second = [
    favourite ? `Mostly ${favourite}` : null,
    streak >= 2 ? `${streak} weeks on the bounce` : null,
  ].filter(Boolean);

  return (
    <div className="px-6 pt-9">
      <p className="text-sm text-ink-faint">Your padel so far</p>
      <h1 className="nums mt-1.5 text-[44px] font-semibold leading-[1.05] tracking-[-0.035em]">
        {nights} night{nights === 1 ? '' : 's'}
      </h1>
      <p className="nums mt-2 text-[15px] leading-normal text-ink-dim">
        {points.toLocaleString('en-GB')} points · {people} {people === 1 ? 'person' : 'people'}
        {second.length > 0 ? (
          <>
            <br />
            {second.join(' · ')}
          </>
        ) : null}
      </p>
    </div>
  );
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Consecutive weeks with a night in them, counted back from now.
 *
 * `dashboardStats.streakWeeks` is the LONGEST run ever, which is the wrong
 * number for "on the bounce" — a group that played ten weeks straight last
 * spring and has not played since is not on a run. This one counts back from
 * this week, and forgives the current week being empty (it is only Monday).
 * Weeks are bucketed exactly as the lib buckets them, so the two can agree.
 */
function currentStreak(nights: LastNight[], now: number): number {
  if (now === 0 || nights.length === 0) return 0;
  const weeks = new Set(nights.map((n) => Math.floor(n.playedAt / WEEK_MS)));
  let week = Math.floor(now / WEEK_MS);
  if (!weeks.has(week)) week -= 1;
  let run = 0;
  while (weeks.has(week)) {
    run += 1;
    week -= 1;
  }
  return run;
}

/** "Last: Tuesday 23 Sep · Ana won" */
function lastLine(n: LastNight): string {
  const when = new Date(n.playedAt).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  // en-GB puts a comma after the weekday; the mock reads as one phrase
  return `Last: ${when.replace(',', '')}${n.winner ? ` · ${n.winner} won` : ''}`;
}

/* ------------------------------------------------------------------ *
 * Resume
 *
 * An organiser who locks their phone mid-night has to be able to get back to
 * the live session, and this is the only route to one. The one tinted row
 * on the screen, directly under the button it is the alternative to.
 * ------------------------------------------------------------------ */

function ResumeRow({ live }: { live: Tournament[] }) {
  const resume = live[0]!;
  return (
    <Link
      href={`/t/${resume.id}`}
      className="flex h-[52px] items-center gap-2.5 rounded-[14px] bg-accent-soft px-4 text-sm text-accent-text active:opacity-80"
    >
      <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full bg-accent" />
      <span className="min-w-0 flex-1 truncate">
        Resume <b className="font-semibold">{resume.name}</b> · game {resume.currentRound + 1}
        {/* Several unfinished nights is unusual enough to mention, and quiet
            enough not to need a list: the rest are on Past sessions. */}
        {live.length > 1 ? <span className="opacity-70"> · {live.length - 1} more open</span> : null}
      </span>
      <ChevronRight size="sm" />
    </Link>
  );
}
