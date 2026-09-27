'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Id, Round, Tournament } from '@/lib/types';
import { CourtCard } from '@/components/CourtCard';
import { ScheduleTab } from '@/components/ScheduleTab';
import { StandingsTable } from '@/components/StandingsTable';
import { FinishView } from '@/components/FinishView';
import { AvatarStack, PlayerAvatar, playerColors } from '@/components/PlayerAvatar';
import { GameProgress, SessionHeader } from '@/components/SessionChrome';
import { Group, GroupLabel, PrimaryButton, QuietButton, Tabs } from '@/components/ui';
import { ArrowLeft, Eye, Share } from '@/components/icons';
import { computeStandings, computeTeamStandings } from '@/lib/standings';
import { displayNames } from '@/lib/format';
import { getStore } from '@/lib/store/factory';
import { formatShareCode, normaliseShareCode, sharePath } from '@/lib/share';
import { gameLabel, gamesPerRound } from '@/lib/cycles';
import { knockoutStageOf } from '@/lib/knockout';
import { isRoundComplete } from '@/lib/history';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SessionAside } from '@/components/SessionAside';
import { useNow } from '@/components/useNow';

/**
 * The session as everyone who is not running it sees it.
 *
 * Deliberately built from the same components as the live view rather than
 * from read-only copies of them — a spectator screen that drifts out of sync
 * with the real one is worse than no spectator screen, because the argument at
 * the net is then about which phone is right. The header, the game strip and
 * the tabs are the organiser's own (`SessionChrome`), `CourtCard` has a
 * `readOnly` mode, and the standings and schedule never had edit controls.
 *
 * Every edit control is absent, not disabled: the game strip has no segments
 * to tap and no +, the header has no save state, and FinishView is handed
 * none of its edit callbacks. A greyed-out button a spectator cannot press
 * reads as "broken", not as "not yours".
 *
 * There is no sign-in here on purpose. The code IS the address.
 */

/** How often to re-read the session. Long enough to be free, short enough to feel live. */
const POLL_MS = 10_000;

/** The Round tab's table is a glance, not the standings — those are a tab away. */
const TABLE_ROWS = 5;

type Tab = 'round' | 'standings' | 'schedule';

export function SpectatorView({ code }: { code: string }) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('round');
  const [viewing, setViewing] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const normalised = useMemo(() => normaliseShareCode(code), [code]);

  /**
   * One effect, one external system: a poller.
   *
   * The first read and every refresh go through the same path, and every
   * setState happens in a promise callback rather than in the effect body —
   * which is both what the lint rule wants and what actually keeps a stale
   * response from a code that has since changed out of the render.
   *
   * Polling pauses with the tab. A phone in a pocket between games should not
   * be asking the database anything, and it refreshes the moment it is back.
   */
  useEffect(() => {
    // A code that is not six valid characters never reaches the database —
    // there is nothing to look up, and the render below already says so.
    if (!normalised) return;

    let cancelled = false;
    let timer: number | null = null;
    let first = true;

    const read = () => {
      if (cancelled) return;
      getStore()
        .getByShareCode(normalised)
        .then((t) => {
          if (cancelled) return;
          if (!t) {
            // An empty poll means the organiser regenerated the code. Say so
            // rather than silently freezing on stale scores.
            setStatus('missing');
            return;
          }
          setTournament(t);
          setUpdatedAt(Date.now());
          setStatus('ready');
          first = false;
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : 'Could not reach the database.');
          // A failed refresh keeps whatever is already on screen; only a failed
          // first load is a dead end.
          if (first) setStatus('failed');
        });
    };

    const tick = () => {
      if (document.visibilityState === 'visible') read();
    };
    const start = () => {
      if (timer === null) timer = window.setInterval(tick, POLL_MS);
    };
    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        read();
        start();
      } else {
        stop();
      }
    };

    read();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [normalised]);

  if (normalised && status === 'loading') {
    return (
      <Centered>
        <p role="status" className="text-[15px] text-ink-faint">
          Opening the session…
        </p>
      </Centered>
    );
  }
  if (!normalised || status === 'missing') {
    return (
      <Centered
        action={
          <PrimaryButton href="/watch" className="max-w-sm">
            Try another code
          </PrimaryButton>
        }
      >
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">
          That code does not open anything
        </h1>
        <p className="mt-2 max-w-xs text-pretty text-[15px] leading-normal text-ink-dim">
          It may have been typed wrong, or whoever is running the night has made a new one. Ask
          them for the current link.
        </p>
      </Centered>
    );
  }
  if (status === 'failed' || !tournament) {
    return (
      <Centered
        action={
          <PrimaryButton onClick={() => window.location.reload()} className="max-w-sm">
            Try again
          </PrimaryButton>
        }
      >
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Could not open the night</h1>
        <p className="mt-2 max-w-xs text-pretty text-[15px] leading-normal text-danger">
          {error ?? 'Something went wrong.'}
        </p>
      </Centered>
    );
  }

  return (
    <Board
      tournament={tournament}
      code={normalised}
      tab={tab}
      setTab={setTab}
      viewing={viewing}
      setViewing={setViewing}
      updatedAt={updatedAt}
    />
  );
}

function Board({
  tournament,
  code,
  tab,
  setTab,
  viewing,
  setViewing,
  updatedAt,
}: {
  tournament: Tournament;
  code: string;
  tab: Tab;
  setTab: (t: Tab) => void;
  viewing: number | null;
  setViewing: (i: number | null) => void;
  updatedAt: number | null;
}) {
  const names = useMemo(() => displayNames(tournament.players), [tournament.players]);
  const colors = useMemo(() => playerColors(tournament.players), [tournament.players]);
  const rows = useMemo(() => computeStandings(tournament), [tournament]);

  const finished = tournament.status === 'finished';
  const roundIndex = viewing ?? tournament.currentRound;
  const round = tournament.rounds[roundIndex];
  const stage = knockoutStageOf(tournament, roundIndex);
  const isPast = viewing !== null && viewing !== tournament.currentRound;

  return (
    <div className="flex min-h-full flex-col">
      <SessionHeader
        left={
          <span className="ml-1.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-[13px] font-semibold text-accent-text">
            <Eye size="sm" />
            Watching
          </span>
        }
        right={
          <span className="flex w-[90px] items-center justify-end">
            <ThemeToggle />
            <CopyLink code={code} />
          </span>
        }
        title={tournament.name}
        sub={<Subline tournament={tournament} updatedAt={updatedAt} />}
      >
        <div className="pt-1.5">
          <GameProgress
            count={tournament.rounds.length}
            current={finished ? tournament.rounds.length : tournament.currentRound}
            played={(i) => {
              const r = tournament.rounds[i];
              return r ? isRoundComplete(r) : false;
            }}
            viewing={viewing}
          />
        </div>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'round', label: 'Round' },
            { value: 'standings', label: finished ? 'Results' : 'Standings' },
            { value: 'schedule', label: 'Schedule' },
          ]}
        />
      </SessionHeader>

      <main className="mx-auto w-full max-w-lg flex-1 px-6 pb-12 xl:grid xl:max-w-6xl xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] xl:items-start xl:gap-10">
        <div className="min-w-0">
          {tab === 'standings' ? (
            <div className="pt-5">
              {finished ? (
                // No onReopen / onPlayAnother / onShare: FinishView draws none
                // of the organiser's actions when their callbacks are absent.
                <FinishView tournament={tournament} rows={rows} names={names} colors={colors} />
              ) : (
                <StandingsTable
                  tournament={tournament}
                  rows={rows}
                  names={names}
                  colors={colors}
                />
              )}
            </div>
          ) : tab === 'schedule' ? (
            <div className="pt-5">
              <ScheduleTab
                tournament={tournament}
                names={names}
                onOpenRound={(i) => {
                  setViewing(i === tournament.currentRound ? null : i);
                  setTab('round');
                }}
              />
            </div>
          ) : !round ? (
            <p className="pt-8 text-center text-[15px] text-ink-dim">
              Nothing has been played yet.
            </p>
          ) : (
            <>
              {isPast ? (
                <QuietButton
                  onClick={() => setViewing(null)}
                  className="-ml-2! mt-2! w-auto! justify-start!"
                >
                  <ArrowLeft size="sm" />
                  Back to the game in progress
                </QuietButton>
              ) : null}

              {/* CourtCard draws its own "Court 1 … Scored / In play" line in
                  read-only mode; the only thing it cannot know is that a
                  past or finished game will never be "in play" again. */}
              {round.matches.map((m, i) => (
                <CourtCard
                  key={m.id}
                  match={m}
                  scoring={tournament.scoring}
                  names={names}
                  colors={colors}
                  onScore={() => undefined}
                  readOnly
                  label={stage?.labels[i]}
                  remark={
                    (finished || isPast) && (m.scoreA === null || m.scoreB === null)
                      ? 'Not scored'
                      : undefined
                  }
                />
              ))}

              <SitOut round={round} names={names} colors={colors} />

              {!finished ? <TopFive tournament={tournament} names={names} colors={colors} /> : null}
            </>
          )}
        </div>

        {/* Same column a spectator on a laptop would otherwise stare past. */}
        <SessionAside tournament={tournament} rows={rows} names={names} colors={colors} />
      </main>

      {/* The code in words, so whoever is watching can read it out to the
          next person without going back to the organiser for the link. */}
      <footer className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 text-center text-[13px] text-ink-faint">
        Code <span className="nums font-semibold text-ink-dim">{formatShareCode(code)}</span> ·{' '}
        <Link href="/" className="inline-flex min-h-11 items-center">
          Rain Padel
        </Link>
      </footer>
    </div>
  );
}

/**
 * "Game 6 of 9 · updated 8s ago".
 *
 * The age has to move on its own or it reads as frozen, and reading the clock
 * during render would make it a different number every repaint — so it ticks
 * from `useNow`, and stops ticking once the night is over.
 */
function Subline({
  tournament,
  updatedAt,
}: {
  tournament: Tournament;
  updatedAt: number | null;
}) {
  const finished = tournament.status === 'finished';
  const now = useNow(5000, !finished);
  if (finished) return <>Finished</>;

  const i = tournament.currentRound;
  const stage = knockoutStageOf(tournament, i);
  const where = stage
    ? stage.name
    : gamesPerRound(tournament) === 1
      ? `${gameLabel(tournament, i)} of ${tournament.rounds.length}`
      : gameLabel(tournament, i);
  const secs = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;
  const age = secs === null ? '' : secs < 5 ? ' · updated just now' : ` · updated ${secs}s ago`;
  return (
    <>
      {where}
      {age}
    </>
  );
}

/**
 * Copy the link rather than the code: the code is what somebody types, the
 * link is what somebody sends, and this is the button next to the thing you
 * send. Passing it on is the one thing a spectator does here.
 */
function CopyLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${window.location.origin}${sharePath(code)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy the link:', url);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label="Copy the link to this session"
      className="inline-flex h-11 min-w-11 items-center justify-center text-ink-dim active:opacity-60"
    >
      {copied ? (
        <span className="text-xs font-semibold text-accent-text">Copied</span>
      ) : (
        <Share />
      )}
    </button>
  );
}

/** "Hana sits this one out" — one quiet line, not a card. */
function SitOut({
  round,
  names,
  colors,
}: {
  round: Round;
  names: Map<Id, string>;
  colors: Map<Id, string>;
}) {
  if (round.resting.length === 0) return null;
  const who = round.resting.map((id) => names.get(id) ?? 'Unknown');
  const list =
    who.length === 1 ? who[0] : `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}`;
  return (
    <p className="mt-3 flex items-center gap-2.5 px-1 text-sm text-ink-dim">
      {round.resting.length === 1 ? (
        <PlayerAvatar name={who[0]!} color={colors.get(round.resting[0]!)} size="sm" />
      ) : (
        <AvatarStack
          size="sm"
          ring="var(--color-ground)"
          people={round.resting.map((id) => ({ name: names.get(id) ?? '?', color: colors.get(id) }))}
        />
      )}
      <span>
        {list} {who.length === 1 ? 'sits' : 'sit'} this one out
      </span>
    </p>
  );
}

/**
 * The top of the table under the courts, so "where does that leave us" is
 * answered without leaving the tab. In a fixed-pairs night the pair is the
 * thing being ranked, so it lists pairs.
 */
function TopFive({
  tournament,
  names,
  colors,
}: {
  tournament: Tournament;
  names: Map<Id, string>;
  colors: Map<Id, string>;
}) {
  const lines = useMemo(() => {
    if (tournament.mode === 'teams') {
      return computeTeamStandings(tournament)
        .slice(0, TABLE_ROWS)
        .map((r) => ({
          key: r.teamId,
          position: r.position,
          name: r.name,
          points: r.points,
          faces: r.players.map((id) => ({ name: names.get(id) ?? '?', color: colors.get(id) })),
        }));
    }
    return computeStandings(tournament)
      .slice(0, TABLE_ROWS)
      .map((r) => ({
        key: r.playerId,
        position: r.position,
        name: names.get(r.playerId) ?? r.name,
        points: r.points,
        faces: [{ name: names.get(r.playerId) ?? r.name, color: colors.get(r.playerId) }],
      }));
  }, [tournament, names, colors]);

  if (lines.length === 0) return null;

  return (
    <section className="mt-6">
      <GroupLabel className="!mt-0" aside={`Top ${lines.length}`}>
        Table
      </GroupLabel>
      <Group as="ul">
        {lines.map((l) => (
          <li key={l.key} className="flex h-11 items-center gap-3 px-4">
            <span className="nums w-4 flex-none text-sm text-ink-faint">{l.position}</span>
            {l.faces.length === 1 ? (
              <PlayerAvatar name={l.faces[0]!.name} color={l.faces[0]!.color} size="sm" />
            ) : (
              <AvatarStack size="sm" people={l.faces} />
            )}
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{l.name}</span>
            <span className="nums flex-none text-[15px] font-semibold">{l.points}</span>
          </li>
        ))}
      </Group>
    </section>
  );
}

function Centered({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col items-center justify-center text-center">{children}</div>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </div>
  );
}
