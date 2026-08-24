'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTournament } from '@/components/TournamentProvider';
import { CourtCard } from '@/components/CourtCard';
import { RestingRow } from '@/components/RestingRow';
import { RoundTimer } from '@/components/RoundTimer';
import { ScheduleTab } from '@/components/ScheduleTab';
import { StandingsTable } from '@/components/StandingsTable';
import { FinishView } from '@/components/FinishView';
import { RosterSheet } from '@/components/RosterSheet';
import { RoundsSheet } from '@/components/RoundsSheet';
import { KnockoutSheet } from '@/components/KnockoutSheet';
import { FinishSheet } from '@/components/FinishSheet';
import { SessionAside } from '@/components/SessionAside';
import { ShareSheet } from '@/components/ShareSheet';
import { Button } from '@/components/ui';
import { computeStandings } from '@/lib/standings';
import { displayNames } from '@/lib/format';
import { playerColors } from '@/components/PlayerAvatar';
import {
  blockingReason,
  canAdvance,
  canStartKnockout,
  gamesDroppedByFinishingNow,
  isLastRound,
} from '@/lib/tournamentReducer';
import { knockoutStageOf } from '@/lib/knockout';
import {
  gameInRound,
  gameLabel,
  gamesPerRound,
  plannedRoundCount,
  roundOfGame,
  slateNoun,
} from '@/lib/cycles';
import { courtFit, formatTimeOfDay } from '@/lib/court';
import { formatDuration } from '@/lib/format';
import { useNow } from '@/components/useNow';

/**
 * Three tabs, and only three.
 *
 * There used to be a fourth screen in all but name: when a session finished,
 * the Round tab quietly relabelled itself "Results" and rendered the finish
 * view, while Standings went on rendering the same table underneath it. Two
 * places showing the same numbers, one of which moved. The finish view now
 * lives ON the standings tab, because it IS the standings — a podium, the
 * awards and the exports wrapped around the same rows.
 */
type Tab = 'round' | 'standings' | 'schedule';

export function LiveView() {
  const { tournament, dispatch, notice, saveState, retrySave } = useTournament();
  const [tab, setTab] = useState<Tab>('round');
  /** Which round the Round tab is showing. null means "whatever is current".
      Deliberately component state: it is a view concern and must not persist. */
  const [viewing, setViewing] = useState<number | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [roundsOpen, setRoundsOpen] = useState(false);
  const [finalsOpen, setFinalsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  /** Non-null while the "are you sure" for ending the night is up. */
  const [finishAsk, setFinishAsk] = useState<'plan-complete' | 'early' | null>(null);

  const names = useMemo(() => displayNames(tournament.players), [tournament.players]);
  const colors = useMemo(() => playerColors(tournament.players), [tournament.players]);
  const rows = useMemo(() => computeStandings(tournament), [tournament]);

  const now = useNow(30_000, tournament.status === 'live');
  const fit = courtFit(tournament, now);
  const finished = tournament.status === 'finished';
  const roundIndex = viewing ?? tournament.currentRound;
  const round = tournament.rounds[roundIndex];
  const isPast = viewing !== null && viewing !== tournament.currentRound;
  const blocker = blockingReason(tournament);

  const perRound = gamesPerRound(tournament);
  const roundNo = roundOfGame(roundIndex, perRound) + 1;
  const gameNo = gameInRound(roundIndex, perRound) + 1;
  // "Next round" reads better than "next game" when this game closes a cycle
  const closesRound = gameInRound(tournament.currentRound, perRound) === perRound - 1;
  const dropped = gamesDroppedByFinishingNow(tournament);
  // A bracket game is not part of the rotation, so the whole header, the court
  // labels and the footer all read from this rather than from the round counter.
  const stage = knockoutStageOf(tournament, roundIndex);
  const currentStage = knockoutStageOf(tournament, tournament.currentRound);

  // Finishing moves the answer to "who won" from the Round tab to Standings,
  // so the app goes there — otherwise the last thing you see after tapping
  // Finish is the court you just played on.
  const wasFinished = useRef(finished);
  useEffect(() => {
    if (finished && !wasFinished.current) {
      setTab('standings');
      setViewing(null);
    }
    wasFinished.current = finished;
  }, [finished]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-ground/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-5 py-3 xl:max-w-6xl">
          <div className="flex min-w-0 flex-col">
            <Link href="/sessions" className="truncate text-base font-medium">
              {tournament.name}
            </Link>
            <button
              type="button"
              onClick={() => (stage ? setFinalsOpen(true) : setRoundsOpen(true))}
              disabled={finished && !stage}
              className="nums -ml-1 self-start rounded-md px-1 py-0.5 text-left text-xs text-ink-faint active:bg-surface-2 disabled:active:bg-transparent"
            >
              {stage ? (
                <>
                  {stage.name}
                  {tournament.knockout ? ` · top ${tournament.knockout.size}` : ''}
                </>
              ) : (
                <>
                  Round {roundNo} of {plannedRoundCount(tournament)}
                  {perRound > 1 ? ` · game ${gameNo}/${perRound}` : ''}
                  {tournament.mode === 'teams' ? ' · teams' : ''}
                  {tournament.mixed ? ' · mixed' : ''}
                  {finished ? '' : ' · edit'}
                </>
              )}
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SaveDot state={saveState} onRetry={retrySave} />
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              aria-label="Share this session"
              className="min-h-11 rounded-lg border border-line px-3 text-xs text-ink-dim active:bg-surface-2"
            >
              Share
            </button>
            <button
              type="button"
              onClick={() => setRosterOpen(true)}
              className="min-h-11 rounded-lg border border-line px-3 text-xs text-ink-dim active:bg-surface-2"
            >
              {tournament.mode === 'teams' ? 'Teams' : 'Players'}
            </button>
          </div>
        </div>

        <nav className="mx-auto flex w-full max-w-lg gap-1 px-5 pb-2 xl:max-w-6xl">
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
              {t === 'standings' && finished ? 'Results' : t}
            </button>
          ))}
        </nav>
      </header>

      {fit && !finished ? (
        <div className="mx-auto w-full max-w-lg px-5 pt-3 xl:max-w-6xl">
          <button
            type="button"
            onClick={() => setRoundsOpen(true)}
            className={`w-full rounded-xl border px-4 py-2 text-left text-xs ${
              fit.status === 'over'
                ? 'border-danger/40 bg-danger/10 text-danger'
                : fit.status === 'tight'
                  ? 'border-warn/40 bg-warn/10 text-warn'
                  : 'border-line bg-surface text-ink-dim'
            }`}
          >
            Court until {formatTimeOfDay(fit.endsAt)} ·{' '}
            {fit.status === 'over'
              ? `${fit.roundsLeft} rounds left would overrun by ${formatDuration(Math.round(fit.overrunMs / 60_000))} — tap to adjust`
              : `${fit.roundsLeft} rounds left, finishing about ${formatTimeOfDay(fit.projectedFinish)}`}
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="mx-auto w-full max-w-lg px-5 pt-3 xl:max-w-6xl">
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

      {/* Phone-first, but a laptop on the bench next to the court should not
          show one narrow strip and 900 empty pixels. Above `xl` the courts keep
          their comfortable measure and the space to the right becomes the log
          everybody leans over to read. */}
      <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-40 pt-4 xl:grid xl:max-w-6xl xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] xl:items-start xl:gap-10">
        <div className="min-w-0">
        {tab === 'standings' ? (
          finished ? (
            <FinishView
              tournament={tournament}
              rows={rows}
              names={names}
              colors={colors}
              onReopen={() => dispatch({ type: 'REOPEN' })}
              onPlayAnother={() => dispatch({ type: 'ADD_ROUND' })}
              onShare={() => setShareOpen(true)}
            />
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
          <p className="text-ink-dim">
            No round to play. Add at least four players to get started.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* A finished session is locked, so the Round tab becomes a record
                of what happened rather than a form. Reopen puts the controls
                back — see the footer. */}
            {finished ? (
              <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-dim">
                This session has finished, so the scores are locked. Reopen it below to fix one.
              </p>
            ) : isPast ? (
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3">
                <p className="text-sm text-ink-dim">
                  Editing {gameLabel(tournament, roundIndex).toLowerCase()}. Standings update as you
                  type.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'CLEAR_ROUND_SCORES', index: roundIndex })}
                    className="min-h-9 rounded-lg border border-line px-3 text-xs text-ink-dim active:bg-surface-2"
                  >
                    Clear scores
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete game ${roundIndex + 1}? Its scores go with it and the later games renumber.`,
                        )
                      ) {
                        dispatch({ type: 'DELETE_ROUND', index: roundIndex });
                        setViewing(null);
                      }
                    }}
                    disabled={tournament.rounds.length <= 1}
                    className="min-h-9 rounded-lg border border-danger/40 px-3 text-xs text-danger active:bg-danger/10 disabled:opacity-40"
                  >
                    Delete game
                  </button>
                </div>
              </div>
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
                colors={colors}
                onScore={(scoreA, scoreB) =>
                  dispatch({ type: 'SET_SCORE', roundIndex, matchId: m.id, scoreA, scoreB })
                }
                readOnly={finished}
                label={stage?.labels[round.matches.indexOf(m)]}
              />
            ))}

            <RestingRow resting={round.resting} names={names} colors={colors} />
          </div>
        )}
        </div>

        <SessionAside
          tournament={tournament}
          rows={rows}
          names={names}
          colors={colors}
          onOpenRound={(i) => {
            setViewing(i);
            setTab('round');
          }}
        />
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-ground/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2 xl:mr-auto xl:max-w-[34rem] xl:ml-[max(0px,calc((100vw-72rem)/2))]">
          {isPast ? (
            <Button variant="ghost" className="w-full" onClick={() => setViewing(null)}>
              Back to {gameLabel(tournament, tournament.currentRound).toLowerCase()}
            </Button>
          ) : finished ? (
            <Button variant="ghost" className="w-full" onClick={() => dispatch({ type: 'REOPEN' })}>
              Reopen session
            </Button>
          ) : (
            <>
              {blocker ? <p className="text-center text-xs text-ink-dim">{blocker}</p> : null}

              {/* The last game of the plan does NOT finish the session on one
                  tap. Everybody starts a night at one round and keeps adding,
                  so this button says "Finish" every second game — and a mis-tap
                  used to lock the table with no warning. */}
              <Button
                className="w-full"
                disabled={!canAdvance(tournament)}
                onClick={() =>
                  isLastRound(tournament) && !currentStage
                    ? setFinishAsk('plan-complete')
                    : dispatch({ type: 'ADVANCE_ROUND' })
                }
              >
                {currentStage
                  ? currentStage.isFinal
                    ? 'Crown the champions'
                    : `On to the ${nextStageName(tournament, tournament.currentRound)}`
                  : isLastRound(tournament)
                    ? 'Finish session'
                    : closesRound
                      ? 'Next round'
                      : 'Next game'}
              </Button>

              {/* One round was never meant to be a commitment, so the way to
                  keep going stays one tap away even before the plan runs out. */}
              {isLastRound(tournament) && !currentStage ? (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => dispatch({ type: 'ADD_ROUND' })}
                >
                  Play another round{perRound > 1 ? ` · ${perRound} more games` : ''}
                </Button>
              ) : null}

              <div className="flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'UNDO_ADVANCE' })}
                  disabled={tournament.currentRound === 0}
                  className="min-h-9 text-ink-faint underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
                >
                  Back a {slateNoun(tournament)}
                </button>

                {/* Nobody knows how long a padel night will run when they set
                    it up, so the round count is decided here, mid-session,
                    rather than on a form before the first serve. A bracket has
                    a fixed number of games, so neither button belongs in one. */}
                {currentStage || isLastRound(tournament) ? null : (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'ADD_ROUND' })}
                    className="min-h-9 rounded-lg border border-line px-3 text-ink-dim active:bg-surface-2"
                  >
                    + Add round
                  </button>
                )}

                {/* The way a leaderboard night gets an ending. */}
                {!currentStage && canStartKnockout(tournament) ? (
                  <button
                    type="button"
                    onClick={() => setFinalsOpen(true)}
                    className="min-h-9 rounded-lg border border-line px-3 text-ink-dim active:bg-surface-2"
                  >
                    🏆 Finals
                  </button>
                ) : null}

                {/* Stopping half way through a round is the normal way a padel
                    night ends. Everything unplayed is dropped so the standings
                    on screen are the final ones. */}
                {isLastRound(tournament) ? null : (
                  <button
                    type="button"
                    onClick={() => setFinishAsk('early')}
                    className="min-h-9 text-ink-faint underline underline-offset-4"
                  >
                    Finish here{dropped > 0 ? ` · drop ${dropped}` : ''}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </footer>

      {roundsOpen ? (
        <RoundsSheet
          tournament={tournament}
          onClose={() => setRoundsOpen(false)}
          onChangeRounds={(rounds) => dispatch({ type: 'SET_PLANNED_ROUNDS', rounds })}
          onChangeCourtEnd={(at) => dispatch({ type: 'SET_COURT_END', at })}
        />
      ) : null}

      {finalsOpen ? (
        <KnockoutSheet
          tournament={tournament}
          colors={colors}
          onClose={() => setFinalsOpen(false)}
          onStart={(size, thirdPlace) => dispatch({ type: 'START_KNOCKOUT', size, thirdPlace })}
          onCancel={() => dispatch({ type: 'CANCEL_KNOCKOUT' })}
        />
      ) : null}

      {finishAsk ? (
        <FinishSheet
          reason={finishAsk}
          dropped={dropped}
          gamesPerRound={perRound}
          onClose={() => setFinishAsk(null)}
          onFinish={() => {
            setFinishAsk(null);
            // On the last planned game the session ends by advancing past it;
            // stopping early has to cut the plan back first.
            dispatch(finishAsk === 'early' ? { type: 'FINISH_NOW' } : { type: 'ADVANCE_ROUND' });
          }}
          onPlayAnother={() => {
            setFinishAsk(null);
            dispatch({ type: 'ADD_ROUND' });
          }}
        />
      ) : null}

      {shareOpen ? (
        <ShareSheet tournament={tournament} onClose={() => setShareOpen(false)} />
      ) : null}

      {rosterOpen ? (
        <RosterSheet
          tournament={tournament}
          names={names}
          colors={colors}
          onClose={() => setRosterOpen(false)}
          onToggle={(playerId, active) => dispatch({ type: 'SET_PLAYER_ACTIVE', playerId, active })}
          onToggleTeam={(teamId, active) => dispatch({ type: 'SET_TEAM_ACTIVE', teamId, active })}
          onAdd={(name) => dispatch({ type: 'ADD_PLAYER', name })}
          onAddTeam={(names) => dispatch({ type: 'ADD_TEAM', names })}
        />
      ) : null}
    </div>
  );
}

/** "On to the semi-finals" reads better than "next game" inside a bracket. */
function nextStageName(tournament: Parameters<typeof knockoutStageOf>[0], gameIndex: number): string {
  return knockoutStageOf(tournament, gameIndex + 1)?.name.toLowerCase() ?? 'next game';
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
