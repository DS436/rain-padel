'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTournament } from '@/components/TournamentProvider';
import { CourtCard } from '@/components/CourtCard';
import { RestingRow } from '@/components/RestingRow';
import { RoundTimer } from '@/components/RoundTimer';
import { ScheduleTab } from '@/components/ScheduleTab';
import { StandingsTable } from '@/components/StandingsTable';
import { FinishView } from '@/components/FinishView';
import { RosterSheet } from '@/components/RosterSheet';
import { Button } from '@/components/ui';
import { computeStandings } from '@/lib/standings';
import { displayNames } from '@/lib/format';
import { blockingReason, canAdvance, isLastRound } from '@/lib/tournamentReducer';

type Tab = 'round' | 'standings' | 'schedule';

export function LiveView() {
  const { tournament, dispatch, notice, saveState, retrySave } = useTournament();
  const [tab, setTab] = useState<Tab>('round');
  /** Which round the Round tab is showing. null means "whatever is current".
      Deliberately component state: it is a view concern and must not persist. */
  const [viewing, setViewing] = useState<number | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);

  const names = useMemo(() => displayNames(tournament.players), [tournament.players]);
  const rows = useMemo(() => computeStandings(tournament), [tournament]);

  const finished = tournament.status === 'finished';
  const roundIndex = viewing ?? tournament.currentRound;
  const round = tournament.rounds[roundIndex];
  const isPast = viewing !== null && viewing !== tournament.currentRound;
  const blocker = blockingReason(tournament);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-ground/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 flex-col">
            <Link href="/" className="truncate text-base font-medium">
              {tournament.name}
            </Link>
            <span className="nums text-xs text-ink-faint">
              Round {roundIndex + 1} of {tournament.plannedRounds}
              {tournament.format === 'mexicano' ? ' · Mexicano' : ''}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SaveDot state={saveState} onRetry={retrySave} />
            <button
              type="button"
              onClick={() => setRosterOpen(true)}
              className="min-h-11 rounded-lg border border-line px-3 text-xs text-ink-dim active:bg-surface-2"
            >
              Players
            </button>
          </div>
        </div>

        <nav className="mx-auto flex w-full max-w-lg gap-1 px-5 pb-2">
          {(['round', 'standings', 'schedule'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={tab === t}
              className={`min-h-11 flex-1 rounded-lg text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-surface-2 text-ink' : 'text-ink-faint'
              }`}
            >
              {t === 'round' && finished ? 'Results' : t}
            </button>
          ))}
        </nav>
      </header>

      {notice ? (
        <div className="mx-auto w-full max-w-lg px-5 pt-3">
          <button
            type="button"
            onClick={() => dispatch({ type: 'DISMISS_NOTICE' })}
            className="w-full rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-left text-sm text-accent"
          >
            {notice.kind === 'schedule-rebuilt'
              ? `Schedule rebuilt from round ${notice.roundsFrom + 1} — some partnerships may repeat.`
              : `Total was ${notice.total}, not ${notice.target}. Saved anyway.`}
          </button>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-40 pt-4">
        {tab === 'standings' ? (
          <StandingsTable rows={rows} names={names} />
        ) : tab === 'schedule' ? (
          <ScheduleTab
            tournament={tournament}
            names={names}
            onOpenRound={(i) => {
              setViewing(i);
              setTab('round');
            }}
          />
        ) : finished && !isPast ? (
          <FinishView
            tournament={tournament}
            rows={rows}
            names={names}
            onReopen={() => dispatch({ type: 'REOPEN' })}
          />
        ) : !round ? (
          <p className="text-ink-dim">
            No round to play. Add at least four players to get started.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {isPast ? (
              <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-dim">
                Editing round {roundIndex + 1}. Standings update as you type.
              </p>
            ) : null}

            {tournament.scoring.mode === 'time' && !isPast ? (
              <RoundTimer
                scoring={tournament.scoring}
                timer={round.timer}
                onStart={() => dispatch({ type: 'START_TIMER', roundIndex })}
                onPause={() => dispatch({ type: 'PAUSE_TIMER', roundIndex })}
                onReset={() => dispatch({ type: 'RESET_TIMER', roundIndex })}
              />
            ) : null}

            {round.matches.map((m) => (
              <CourtCard
                key={m.id}
                match={m}
                scoring={tournament.scoring}
                names={names}
                onScore={(scoreA, scoreB) =>
                  dispatch({ type: 'SET_SCORE', roundIndex, matchId: m.id, scoreA, scoreB })
                }
              />
            ))}

            <RestingRow resting={round.resting} names={names} />
          </div>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-ground/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
          {isPast ? (
            <Button variant="ghost" className="w-full" onClick={() => setViewing(null)}>
              Back to round {tournament.currentRound + 1}
            </Button>
          ) : finished ? (
            <Button variant="ghost" className="w-full" onClick={() => dispatch({ type: 'REOPEN' })}>
              Reopen session
            </Button>
          ) : (
            <>
              <Button
                className="w-full"
                disabled={!canAdvance(tournament)}
                onClick={() => dispatch({ type: 'ADVANCE_ROUND' })}
              >
                {isLastRound(tournament) ? 'Finish session' : 'Next round'}
              </Button>
              <div className="flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'UNDO_ADVANCE' })}
                  disabled={tournament.currentRound === 0}
                  className="min-h-9 text-ink-faint underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
                >
                  Back a round
                </button>
                {blocker ? <span className="text-ink-dim">{blocker}</span> : null}
              </div>
            </>
          )}
        </div>
      </footer>

      {rosterOpen ? (
        <RosterSheet
          tournament={tournament}
          names={names}
          onClose={() => setRosterOpen(false)}
          onToggle={(playerId, active) => dispatch({ type: 'SET_PLAYER_ACTIVE', playerId, active })}
          onAdd={(name) => dispatch({ type: 'ADD_PLAYER', name })}
        />
      ) : null}
    </div>
  );
}

function SaveDot({ state, onRetry }: { state: string; onRetry: () => void }) {
  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-full border border-danger/40 px-3 py-1 text-xs text-danger"
      >
        Not saved · retry
      </button>
    );
  }
  const label = state === 'saving' ? 'Saving' : state === 'saved' ? 'Saved' : '';
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-faint">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          state === 'saving' ? 'bg-warn' : state === 'saved' ? 'bg-accent' : 'bg-transparent'
        }`}
      />
      {label}
    </span>
  );
}
