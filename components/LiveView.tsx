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
import { Button, Meta, Segmented } from '@/components/ui';
import {
  ArrowLeft,
  ArrowRight,
  BarChart,
  Clock,
  Plus,
  Share,
  Trophy,
} from '@/components/icons';
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
import { formatSpec } from '@/lib/formats';
import {
  gameInRound,
  gameLabel,
  gamesPerRound,
  counterNoun,
  shortGameLabel,
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
      <header className="sticky top-0 z-10 bg-ground/95 backdrop-blur">
        <div className="mx-auto w-full max-w-lg px-5 pb-2.5 pt-1 xl:max-w-6xl">
          <div className="flex items-center gap-2">
            <Link
              href="/sessions"
              aria-label="Home"
              className="-ml-2 inline-flex h-11 w-9 shrink-0 items-center justify-center text-ink-dim"
            >
              <ArrowLeft />
            </Link>
            <button
              type="button"
              onClick={() => (stage ? setFinalsOpen(true) : setRoundsOpen(true))}
              disabled={finished && !stage}
              className="flex min-w-0 flex-1 flex-col items-start text-left"
            >
              <span className="disp w-full truncate text-[15px] font-bold">{tournament.name}</span>
              <Meta>
                {stage ? (
                  <>
                    {stage.name}
                    {tournament.knockout ? ` · top ${tournament.knockout.size}` : ''}
                  </>
                ) : (
                  <>
                    {/* The format was nowhere on this screen, and a night run as
                        the wrong one looks exactly like a broken right one — an
                        Americano ignores the leaderboard because it is supposed
                        to, which is impossible to tell from here without it. */}
                    {formatSpec(tournament.format).name}
                    {tournament.mode === 'teams' ? ' · teams' : ''}
                    {tournament.mixed ? ' · mixed' : ''}
                    {` · ${tournament.players.length}`}
                    {tournament.scoring.mode === 'points'
                      ? ` · ${tournament.scoring.target} pts`
                      : ` · ${tournament.scoring.minutes} min`}
                  </>
                )}
              </Meta>
            </button>
            <SaveDot state={saveState} onRetry={retrySave} />
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              aria-label="Share this session"
              className="-mr-2 inline-flex h-11 w-10 shrink-0 items-center justify-center text-ink-dim"
            >
              <Share />
            </button>
          </div>

          {/* Every game in the night, as one rail. Tapping one opens it for
              editing, which used to need two taps through a sheet. */}
          <div className="scr flex gap-[5px] overflow-x-auto pt-2.5">
            {tournament.rounds.map((_, i) => {
              const isNow = i === tournament.currentRound;
              const isViewing = i === roundIndex;
              const played = tournament.rounds[i]!.matches.every(
                (m) => m.scoreA !== null && m.scoreB !== null,
              );
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setViewing(i === tournament.currentRound ? null : i)}
                  aria-current={isViewing}
                  title={gameLabel(tournament, i)}
                  className={`nums disp inline-flex h-11 flex-none items-center justify-center rounded-[9px] border text-[12.5px] font-bold ${
                    isNow ? 'min-w-[62px] px-2' : 'min-w-9 px-1'
                  } ${
                    isNow
                      ? 'border-transparent bg-accent text-accent-ink'
                      : played
                        ? 'border-transparent bg-surface-2 text-ink-faint'
                        : 'border-dashed border-line bg-transparent text-ink-faint'
                  } ${isViewing && !isNow ? '!border-solid !border-accent !text-accent' : ''}`}
                >
                  {isNow ? shortGameLabel(tournament, i) : i + 1}
                </button>
              );
            })}
            {finished || currentStage ? null : (
              <button
                type="button"
                onClick={() => dispatch({ type: 'ADD_ROUND' })}
                aria-label={`Add a ${counterNoun(tournament).toLowerCase()}`}
                className="inline-flex h-11 min-w-11 flex-none items-center justify-center rounded-[9px] border border-line text-ink-dim"
              >
                <Plus size="sm" />
              </button>
            )}
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

      {fit && !finished ? (
        <div className="mx-auto w-full max-w-lg px-5 pt-1.5 xl:max-w-6xl">
          <button
            type="button"
            onClick={() => setRoundsOpen(true)}
            className={`flex w-full items-center gap-2 rounded-[11px] border px-3 py-2 text-left ${
              fit.status === 'over'
                ? 'border-danger/40 bg-danger/[0.08] text-danger'
                : fit.status === 'tight'
                  ? 'border-warn/[0.35] bg-warn/[0.08] text-warn'
                  : 'border-line bg-surface text-ink-dim'
            }`}
          >
            <Clock size="sm" />
            <span className="nums font-mono text-[11px] font-medium">
              Ends {formatTimeOfDay(fit.endsAt)} ·{' '}
              {fit.status === 'over'
                ? `${fit.roundsLeft} left overruns by ${formatDuration(Math.round(fit.overrunMs / 60_000))}`
                : `${fit.roundsLeft} ${fit.roundsLeft === 1 ? 'round' : 'rounds'} fit`}
            </span>
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

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ground/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-[7px] xl:mr-auto xl:ml-[max(0px,calc((100vw-72rem)/2))] xl:max-w-[34rem]">
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
              {blocker ? (
                <p className="text-center text-[11px] text-ink-dim">{blocker}</p>
              ) : null}

              <div className="flex gap-[7px]">
                <button
                  type="button"
                  onClick={() => setTab('standings')}
                  aria-label="Standings"
                  className="inline-flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[15px] border border-line bg-surface text-ink-dim"
                >
                  <BarChart />
                </button>

                {/* The last game of the plan does NOT finish the session on one
                    tap. Everybody starts a night at one round and keeps adding,
                    so this button says "Finish" every second game — and a mis-tap
                    used to lock the table with no warning. */}
                <button
                  type="button"
                  disabled={!canAdvance(tournament)}
                  onClick={() =>
                    isLastRound(tournament) && !currentStage
                      ? setFinishAsk('plan-complete')
                      : dispatch({ type: 'ADVANCE_ROUND' })
                  }
                  className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-[15px] bg-accent text-accent-ink transition-opacity active:opacity-80 disabled:bg-surface-2 disabled:text-ink-faint"
                >
                  <span className="disp text-[15.5px] font-bold">
                    {currentStage
                      ? currentStage.isFinal
                        ? 'Crown the champions'
                        : `On to the ${nextStageName(tournament, tournament.currentRound)}`
                      : isLastRound(tournament)
                        ? 'Finish session'
                        : closesRound
                          ? `Next ${counterNoun(tournament).toLowerCase()}`
                          : 'Next game'}
                  </span>
                  <ArrowRight size="sm" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'UNDO_ADVANCE' })}
                  disabled={tournament.currentRound === 0}
                  className="inline-flex min-h-11 items-center gap-1 px-1 text-[11px] font-medium text-ink-faint disabled:opacity-40"
                >
                  <ArrowLeft size="sm" />
                  Back
                </button>

                {/* One round was never meant to be a commitment, so the way to
                    keep going stays one tap away even before the plan runs out. */}
                {isLastRound(tournament) && !currentStage ? (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'ADD_ROUND' })}
                    className="min-h-11 px-1 text-[11px] font-medium text-ink-faint"
                  >
                    Play another {counterNoun(tournament).toLowerCase()}
                  </button>
                ) : null}

                {/* Stopping half way through a round is the normal way a padel
                    night ends. Everything unplayed is dropped so the standings
                    on screen are the final ones. */}
                {isLastRound(tournament) ? null : (
                  <button
                    type="button"
                    onClick={() => setFinishAsk('early')}
                    className="min-h-11 px-1 text-[11px] font-medium text-ink-faint"
                  >
                    Finish{dropped > 0 ? ` · drop ${dropped}` : ' here'}
                  </button>
                )}

                {/* The way a leaderboard night gets an ending. */}
                {!currentStage && canStartKnockout(tournament) ? (
                  <button
                    type="button"
                    onClick={() => setFinalsOpen(true)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-[11px] border border-accent/30 px-3 text-[11px] font-semibold text-accent"
                  >
                    <Trophy size="sm" />
                    Finals
                  </button>
                ) : null}
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
          onAdd={(name, group) => dispatch({ type: 'ADD_PLAYER', name, group })}
          onSetGroup={(playerId, group) => dispatch({ type: 'SET_PLAYER_GROUP', playerId, group })}
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
