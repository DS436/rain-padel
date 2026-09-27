'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Id } from '@/lib/types';
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
import { BracketView } from '@/components/BracketView';
import { GameProgress, SaveState, SessionHeader } from '@/components/SessionChrome';
import {
  BarAction,
  BottomBar,
  IconButton,
  PrimaryButton,
  QuietButton,
  SecondaryButton,
  Tabs,
} from '@/components/ui';
import { ArrowLeft, ArrowRight, Flag, Plus, Share, Trophy, X } from '@/components/icons';
import { computeStandings } from '@/lib/standings';
import { displayNames, formatDuration } from '@/lib/format';
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
import { gameInRound, gamesPerRound, counterNoun, slateNoun } from '@/lib/cycles';
import { courtFit, formatTimeOfDay } from '@/lib/court';
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
  // "Game" for anything counted in games (every cyclic format, every ladder),
  // "round" for Mexicano — the same word the counter, the sit-out card and the
  // back link all use, so one screen never says three things.
  const slate = slateNoun(tournament);
  const Slate = slate === 'game' ? 'Game' : 'Round';
  // "Next round" reads better than "next game" when this game closes a cycle
  const closesRound = gameInRound(tournament.currentRound, perRound) === perRound - 1;
  const dropped = gamesDroppedByFinishingNow(tournament);
  // A bracket game is not part of the rotation, so the whole header, the court
  // labels and the footer all read from this rather than from the round counter.
  const stage = knockoutStageOf(tournament, roundIndex);
  const currentStage = knockoutStageOf(tournament, tournament.currentRound);
  const canAdd = !finished && !currentStage;

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

  const played = (i: number) =>
    tournament.rounds[i]?.matches.every((m) => m.scoreA !== null && m.scoreB !== null) ?? false;

  const seedOf = (ids: readonly [Id, Id]) =>
    tournament.knockout?.pairs.find((p) => p.players.includes(ids[0]) && p.players.includes(ids[1]))
      ?.seed ?? null;

  /** "Back on for game 8", read off the schedule when it is already drawn. */
  const backOn = (id: Id): string => {
    for (let j = roundIndex + 1; j < tournament.rounds.length; j++) {
      const on = tournament.rounds[j]!.matches.some(
        (m) => m.teamA.includes(id) || m.teamB.includes(id),
      );
      if (on) return j === roundIndex + 1 ? `Back on next ${slate}` : `Back on for ${slate} ${j + 1}`;
    }
    // Adaptive formats draw one game at a time, so there is nothing to read.
    return tournament.rounds.length > roundIndex + 1
      ? 'Not on again in this plan'
      : `Back next ${slate}`;
  };

  // The format was nowhere on this screen once, and a night run as the wrong
  // one looks exactly like a broken right one — an Americano ignores the
  // leaderboard because it is supposed to, which is impossible to tell from
  // here without it. So the line under the name always carries it.
  const sub = stage
    ? `${stage.name}${tournament.knockout ? ` · top ${tournament.knockout.size}` : ''}`
    : [
        finished
          ? 'Finished'
          : `${Slate} ${tournament.currentRound + 1} of ${Math.max(tournament.plannedRounds, tournament.currentRound + 1)}`,
        formatSpec(tournament.format).name,
        tournament.mode === 'teams' ? 'teams' : null,
        tournament.mixed ? 'mixed' : null,
        tournament.scoring.mode === 'points'
          ? `${tournament.scoring.target} pts`
          : `${tournament.scoring.minutes} min`,
      ]
        .filter(Boolean)
        .join(' · ');

  // The court booking used to be a banner of its own under the header. It is
  // now the first court's remark — same words, same warn/over colours, and it
  // still opens the rounds sheet when tapped.
  const fitRemark =
    fit && !finished && !isPast && !stage
      ? {
          text: `Court until ${formatTimeOfDay(fit.endsAt)} · ${
            fit.status === 'over'
              ? `runs ${formatDuration(Math.round(fit.overrunMs / 60_000))} over`
              : fit.status === 'tight'
                ? 'only just fits'
                : 'plan fits'
          }`,
          tone: fit.status === 'over' ? 'danger' : fit.status === 'tight' ? 'warn' : 'faint',
        } as const
      : null;

  const cancelFinals = () => {
    if (
      window.confirm(
        'Cancel the finals? The bracket games are dropped and the night goes back to a plain leaderboard. Group scores are kept.',
      )
    ) {
      dispatch({ type: 'CANCEL_KNOCKOUT' });
    }
  };

  const nextLabel = currentStage
    ? currentStage.isFinal
      ? 'Crown the champions'
      : `On to the ${nextStageName(tournament, tournament.currentRound)}`
    : isLastRound(tournament)
      ? 'Finish session'
      : closesRound
        ? `Next ${counterNoun(tournament).toLowerCase()}`
        : 'Next game';

  // The bar belongs to the Round tab. Standings and Schedule are for reading,
  // and a finished Standings tab is the results screen, which draws its own.
  const showBar = tab === 'round' && round !== undefined;
  // Undo for a Next tapped too soon: offered on the court itself while the new
  // game is still untouched, and always from the rounds sheet.
  const freshGame =
    !finished &&
    !isPast &&
    tournament.currentRound > 0 &&
    (round?.matches.every((m) => m.scoreA === null && m.scoreB === null) ?? false);

  return (
    <div className="flex min-h-full flex-col">
      <SessionHeader
        left={
          <Link
            href="/sessions"
            aria-label="Home"
            className="inline-flex h-11 w-11 items-center justify-center text-ink-dim active:opacity-60"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        }
        right={
          <IconButton onClick={() => setShareOpen(true)} aria-label="Share this session">
            <Share className="h-5 w-5" />
          </IconButton>
        }
        title={tournament.name}
        sub={sub}
        onTitle={
          stage
            ? () => setFinalsOpen(true)
            : finished
              ? undefined
              : () => setRoundsOpen(true)
        }
      >
        {/* Every game in the night, as one strip. Tapping a segment opens that
            game for editing, which used to need two taps through a sheet. */}
        <div className="pt-2">
          <GameProgress
            count={tournament.rounds.length}
            current={finished ? tournament.rounds.length : tournament.currentRound}
            played={played}
            viewing={viewing}
            onSelect={(i) => {
              setViewing(i === tournament.currentRound ? null : i);
              setTab('round');
            }}
            onAdd={canAdd ? () => dispatch({ type: 'ADD_ROUND' }) : undefined}
            addLabel={`Add a ${counterNoun(tournament).toLowerCase()}`}
            labelOf={(i) => `${Slate} ${i + 1}`}
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
          trailing={<SaveState state={saveState} onRetry={retrySave} />}
        />
      </SessionHeader>

      {notice ? (
        <div className="mx-auto w-full max-w-lg px-6 pt-4 xl:max-w-6xl">
          <button
            type="button"
            onClick={() => dispatch({ type: 'DISMISS_NOTICE' })}
            className="card flex w-full items-start gap-3 px-4 py-3 text-left text-sm text-ink-dim"
          >
            <span className="nums min-w-0 flex-1">
              {notice.kind === 'schedule-rebuilt'
                ? `Schedule rebuilt from round ${notice.roundsFrom + 1} — some partnerships may repeat.`
                : `Total was ${notice.total}, not ${notice.target}. Saved anyway.`}
            </span>
            <X size="sm" className="mt-0.5 text-ink-faint" />
            <span className="sr-only">Dismiss</span>
          </button>
        </div>
      ) : null}

      {/* Phone-first, but a laptop on the bench next to the court should not
          show one narrow strip and 900 empty pixels. Above `xl` the courts keep
          their comfortable measure and the space to the right becomes the log
          everybody leans over to read. */}
      <main className="mx-auto w-full max-w-lg flex-1 px-6 pb-40 pt-4 xl:grid xl:max-w-6xl xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] xl:items-start xl:gap-10">
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
            <p className="text-ink-dim">No round to play. Add at least four players to get started.</p>
          ) : (
            // Each court heading brings its own 20px, so the tab starts flush.
            <div className="-mt-4">
              {/* A finished session is locked, so the Round tab becomes a record
                  of what happened rather than a form. Reopen puts the controls
                  back — see the bar. */}
              {finished ? (
                <p className="mt-4 px-1 text-sm text-ink-faint">
                  This session has finished, so the scores are locked. Reopen it to fix one.
                </p>
              ) : isPast ? (
                <div className="card mt-4 px-4 pb-1 pt-3">
                  <p className="text-sm text-ink-dim">
                    Editing {slate} {roundIndex + 1}. Standings update as you type.
                  </p>
                  <div className="-ml-1 flex gap-5">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'CLEAR_ROUND_SCORES', index: roundIndex })}
                      className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-ink-dim active:opacity-60"
                    >
                      Clear scores
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${slate} ${roundIndex + 1}? Its scores go with it and the later games renumber.`,
                          )
                        ) {
                          dispatch({ type: 'DELETE_ROUND', index: roundIndex });
                          setViewing(null);
                        }
                      }}
                      disabled={tournament.rounds.length <= 1}
                      className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-danger active:opacity-60 disabled:opacity-40"
                    >
                      Delete {slate}
                    </button>
                  </div>
                </div>
              ) : null}

              {tournament.scoring.mode === 'time' && !isPast && !finished ? (
                <RoundTimer
                  scoring={tournament.scoring}
                  timer={round.timer}
                  onStart={() => dispatch({ type: 'START_TIMER', roundIndex })}
                  onPause={() => dispatch({ type: 'PAUSE_TIMER', roundIndex })}
                  onReset={() => dispatch({ type: 'RESET_TIMER', roundIndex })}
                />
              ) : null}

              {round.matches.map((m, i) => {
                const scored = m.scoreA !== null && m.scoreB !== null;
                const remark =
                  i === 0 && fitRemark ? fitRemark : finished && !scored ? { text: 'Not played', tone: 'faint' as const } : null;
                return (
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
                    label={stage?.labels[i]}
                    remark={remark?.text}
                    remarkTone={remark?.tone}
                    onRemark={i === 0 && fitRemark ? () => setRoundsOpen(true) : undefined}
                    live={Boolean(stage) && !finished && !isPast && !scored}
                    seedOf={stage ? seedOf : undefined}
                  />
                );
              })}

              {/* The rest of the draw, so "who do we play next" is on the
                  same screen as the game deciding it. */}
              {stage && !isPast ? (
                <BracketView tournament={tournament} colors={colors} fromGame={roundIndex + 1} />
              ) : null}

              {/* In a bracket everyone not in it is out for the night, so the
                  big "back on for" card would be answering the wrong question. */}
              <RestingRow
                resting={round.resting}
                names={names}
                colors={colors}
                backOn={stage || finished ? undefined : backOn}
              />

              {canAdd || freshGame ? (
                <div
                  className={`mt-4 flex items-center ${canAdd && freshGame ? 'justify-between' : 'justify-center'}`}
                >
                  {freshGame ? (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'UNDO_ADVANCE' })}
                      className="inline-flex h-11 items-center gap-1.5 px-1 text-sm font-medium text-ink-faint active:opacity-60"
                    >
                      <ArrowLeft size="sm" />
                      Back to {slate} {tournament.currentRound}
                    </button>
                  ) : null}
                  {/* One round was never meant to be a commitment, so the way
                      to keep going stays one tap away before the plan runs out. */}
                  {canAdd ? (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'ADD_ROUND' })}
                      className="inline-flex h-11 items-center gap-1.5 px-1 text-sm font-semibold text-accent-text active:opacity-60"
                    >
                      <Plus className="h-4 w-4" />
                      Add a {counterNoun(tournament).toLowerCase()}
                    </button>
                  ) : null}
                </div>
              ) : null}
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

      {showBar ? (
        <BottomBar className="xl:ml-[max(0px,calc((100vw-72rem)/2))] xl:mr-auto xl:max-w-[34rem]">
          {isPast ? (
            <SecondaryButton onClick={() => setViewing(null)}>
              Back to {slate} {tournament.currentRound + 1}
            </SecondaryButton>
          ) : finished ? (
            <SecondaryButton onClick={() => dispatch({ type: 'REOPEN' })}>
              Reopen session
            </SecondaryButton>
          ) : (
            <>
              {/* An unplayable roster must explain itself: a grey button with
                  no reason is the one thing this bar must never show. */}
              {blocker ? (
                <p className="mb-2 text-center text-xs text-ink-dim">{blocker}</p>
              ) : null}

              {currentStage ? (
                <div className="flex items-center gap-4">
                  <QuietButton
                    onClick={cancelFinals}
                    className="w-auto! flex-none whitespace-nowrap px-1! text-sm!"
                  >
                    Cancel finals
                  </QuietButton>
                  <PrimaryButton
                    className="min-w-0 flex-1"
                    disabled={!canAdvance(tournament)}
                    onClick={() => dispatch({ type: 'ADVANCE_ROUND' })}
                  >
                    {nextLabel}
                    <ArrowRight />
                  </PrimaryButton>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  {/* The way a leaderboard night gets an ending. */}
                  {canStartKnockout(tournament) ? (
                    <BarAction
                      icon={<Trophy className="h-5 w-5" />}
                      label="Finals"
                      onClick={() => setFinalsOpen(true)}
                    />
                  ) : null}
                  {/* Stopping half way through a round is the normal way a
                      padel night ends. The sheet says exactly what is dropped,
                      so the standings on screen are the final ones. */}
                  <BarAction
                    icon={<Flag className="h-5 w-5" />}
                    label="Finish"
                    onClick={() =>
                      setFinishAsk(
                        isLastRound(tournament) && canAdvance(tournament) ? 'plan-complete' : 'early',
                      )
                    }
                  />
                  {/* The last game of the plan does NOT finish the session on
                      one tap. Everybody starts a night at one round and keeps
                      adding, so this button says "Finish" every second game —
                      and a mis-tap used to lock the table with no warning. */}
                  <PrimaryButton
                    className="ml-2 min-w-0 flex-1"
                    disabled={!canAdvance(tournament)}
                    onClick={() =>
                      isLastRound(tournament)
                        ? setFinishAsk('plan-complete')
                        : dispatch({ type: 'ADVANCE_ROUND' })
                    }
                  >
                    {nextLabel}
                    <ArrowRight />
                  </PrimaryButton>
                </div>
              )}
            </>
          )}
        </BottomBar>
      ) : null}

      {roundsOpen ? (
        <RoundsSheet
          tournament={tournament}
          onClose={() => setRoundsOpen(false)}
          onChangeRounds={(rounds) => dispatch({ type: 'SET_PLANNED_ROUNDS', rounds })}
          onChangeCourtEnd={(at) => dispatch({ type: 'SET_COURT_END', at })}
          onOpenRoster={() => {
            setRoundsOpen(false);
            setRosterOpen(true);
          }}
          onUndoAdvance={
            tournament.currentRound > 0 && !finished
              ? () => {
                  dispatch({ type: 'UNDO_ADVANCE' });
                  setViewing(null);
                }
              : undefined
          }
          undoLabel={`${slate} ${tournament.currentRound}`}
        />
      ) : null}

      {finalsOpen ? (
        <KnockoutSheet
          tournament={tournament}
          colors={colors}
          onClose={() => setFinalsOpen(false)}
          onStart={(size, thirdPlace) => dispatch({ type: 'START_KNOCKOUT', size, thirdPlace })}
          onCancel={() => dispatch({ type: 'CANCEL_KNOCKOUT' })}
          onFinishEarly={() => {
            setFinalsOpen(false);
            setFinishAsk('early');
          }}
        />
      ) : null}

      {finishAsk ? (
        <FinishSheet
          reason={finishAsk}
          dropped={dropped}
          gamesPerRound={perRound}
          noun={slate}
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
