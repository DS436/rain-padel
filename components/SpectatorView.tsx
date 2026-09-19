'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Tournament } from '@/lib/types';
import { CourtCard } from '@/components/CourtCard';
import { RestingRow } from '@/components/RestingRow';
import { ScheduleTab } from '@/components/ScheduleTab';
import { StandingsTable } from '@/components/StandingsTable';
import { FinishView } from '@/components/FinishView';
import { AvatarStack, playerColors } from '@/components/PlayerAvatar';
import { Meta, Segmented } from '@/components/ui';
import { ArrowLeft, ArrowUpRight, Eye } from '@/components/icons';
import { formatShareCode } from '@/lib/share';
import { computeStandings } from '@/lib/standings';
import { displayNames } from '@/lib/format';
import { getStore } from '@/lib/store/factory';
import { normaliseShareCode, sharePath } from '@/lib/share';
import { formatSpec } from '@/lib/formats';
import {
  counterNoun,
  gameInRound,
  gamesPerRound,
  plannedRoundCount,
  roundOfGame,
} from '@/lib/cycles';
import { knockoutStageOf } from '@/lib/knockout';
import { isRoundComplete } from '@/lib/history';
import { SessionAside } from '@/components/SessionAside';
import { useNow } from '@/components/useNow';

/**
 * The session as everyone who is not running it sees it.
 *
 * Deliberately built from the same components as the live view rather than
 * from read-only copies of them — a spectator screen that drifts out of sync
 * with the real one is worse than no spectator screen, because the argument at
 * the net is then about which phone is right. `CourtCard` already had a
 * `readOnly` mode; the rest simply never had edit controls in it.
 *
 * There is no sign-in here on purpose. The code IS the address.
 */

/** How often to re-read the session. Long enough to be free, short enough to feel live. */
const POLL_MS = 10_000;

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

  if (normalised && status === 'loading') return <Centered>Opening the session…</Centered>;
  if (!normalised || status === 'missing') {
    return (
      <Centered>
        <p className="disp text-lg font-bold">That code does not open anything</p>
        <p className="mt-2 max-w-xs text-pretty text-[13px] leading-relaxed text-ink-dim">
          It may have been typed wrong, or whoever is running the night has made a new one. Ask
          them for the current link.
        </p>
        <Link
          href="/watch"
          className="mt-6 inline-flex min-h-11 items-center rounded-[14px] border border-line bg-surface px-5 text-[13.5px] font-semibold text-ink"
        >
          Try another code
        </Link>
      </Centered>
    );
  }
  if (status === 'failed' || !tournament) {
    return (
      <Centered>
        <p className="text-danger">{error ?? 'Something went wrong.'}</p>
      </Centered>
    );
  }

  return <Board tournament={tournament} tab={tab} setTab={setTab} viewing={viewing} setViewing={setViewing} updatedAt={updatedAt} />;
}

function Board({
  tournament,
  tab,
  setTab,
  viewing,
  setViewing,
  updatedAt,
}: {
  tournament: Tournament;
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
  const perRound = gamesPerRound(tournament);
  const stage = knockoutStageOf(tournament, roundIndex);
  const spec = formatSpec(tournament.format);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 bg-ground/95 backdrop-blur">
        <div className="mx-auto w-full max-w-lg px-5 pb-2.5 pt-2 xl:max-w-6xl">
          <div className="flex items-center gap-2.5">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="disp truncate text-[15px] font-bold">{tournament.name}</span>
              <Meta>
                {stage ? (
                  stage.name
                ) : (
                  <>
                    {spec.name} · {counterNoun(tournament).toLowerCase()}{' '}
                    {roundOfGame(roundIndex, perRound) + 1} of {plannedRoundCount(tournament)}
                    {perRound > 1
                      ? ` · game ${gameInRound(roundIndex, perRound) + 1}/${perRound}`
                      : ''}
                  </>
                )}
              </Meta>
            </span>
            <LiveDot finished={finished} updatedAt={updatedAt} />
          </div>

          <div className="pt-2.5">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'round', label: 'Court' },
                { value: 'standings', label: finished ? 'Results' : 'Table' },
                { value: 'schedule', label: 'Schedule' },
              ]}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-16 pt-4 xl:grid xl:max-w-6xl xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] xl:items-start xl:gap-10">
        <div className="min-w-0">
        {tab === 'standings' ? (
          finished ? (
            <FinishView tournament={tournament} rows={rows} names={names} colors={colors} />
          ) : (
            <StandingsTable tournament={tournament} rows={rows} names={names} colors={colors} />
          )
        ) : tab === 'schedule' ? (
          <ScheduleTab
            tournament={tournament}
            names={names}
            onOpenRound={(i) => {
              setViewing(i);
              setTab('round');
            }}
          />
        ) : !round ? (
          <p className="text-ink-dim">Nothing has been played yet.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {/* The code, so whoever is watching can pass it on without going
                back to the organiser for the link. */}
            {tournament.share ? <CodeCard code={tournament.share.code} /> : null}

            {viewing !== null && viewing !== tournament.currentRound ? (
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] font-medium text-ink-dim"
              >
                <ArrowLeft size="sm" />
                Back to the game in progress
              </button>
            ) : null}

            {round.matches.map((m) => (
              <CourtCard
                key={m.id}
                match={m}
                scoring={tournament.scoring}
                names={names}
                colors={colors}
                onScore={() => undefined}
                readOnly
                label={stage?.labels[round.matches.indexOf(m)]}
              />
            ))}

            <RestingRow resting={round.resting} names={names} colors={colors} />

            {!isRoundComplete(round) && !finished ? (
              <p className="pt-1 text-center text-[11px] text-ink-faint">
                Scores appear here as they are entered.
              </p>
            ) : null}
          </div>
        )}
        </div>

        {/* Same column a spectator on a laptop would otherwise stare past. */}
        <SessionAside tournament={tournament} rows={rows} names={names} colors={colors} />
      </main>

      <footer className="border-t border-line-soft px-5 py-4">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 xl:max-w-6xl">
          <span className="flex items-center gap-2">
            <AvatarStack
              people={rows.slice(0, 3).map((r) => ({
                name: names.get(r.playerId) ?? r.name,
                color: colors.get(r.playerId),
              }))}
              size="xs"
              ring="var(--color-ground)"
            />
            <Meta>watching · you cannot change anything here</Meta>
          </span>
          <Link href="/" className="text-[11px] font-medium text-ink-faint">
            Rain Padel
          </Link>
        </div>
      </footer>
    </div>
  );
}

/**
 * The share code, big enough to read out across a court.
 *
 * Copying the link rather than the code: the code is what somebody types, the
 * link is what somebody sends, and the button is next to the thing you send.
 */
function CodeCard({ code }: { code: string }) {
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
    <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-3">
      <Eye className="text-ink-faint" />
      <span className="nums disp flex-1 text-xl font-bold tracking-[0.08em] text-accent">
        {formatShareCode(code)}
      </span>
      {copied ? <Meta className="text-accent">copied</Meta> : null}
      <button
        type="button"
        onClick={() => void copy()}
        aria-label="Copy the link to this session"
        className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full border border-line text-ink-dim"
      >
        <ArrowUpRight size="sm" />
      </button>
    </div>
  );
}

function LiveDot({ finished, updatedAt }: { finished: boolean; updatedAt: number | null }) {
  // "x seconds ago" has to move on its own or it reads as frozen, and reading
  // the clock during render would make it a different number every repaint.
  const now = useNow(5000, !finished);

  if (finished) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 py-1">
        <span className="text-[9.5px] font-medium text-ink-faint">Finished</span>
      </span>
    );
  }
  const secs = updatedAt ? Math.round((now - updatedAt) / 1000) : null;
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 py-1">
      <span aria-hidden className="relative flex h-1.5 w-1.5">
        <span className="rp-ping absolute inset-0 rounded-full bg-accent" />
        <span className="relative h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
      <span className="text-[9.5px] font-medium text-ink-faint">
        {secs === null || secs < 15 ? 'Live' : `${secs}s ago`}
      </span>
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">{children}</div>
  );
}
