'use client';

import { useState } from 'react';
import type { Id, Match, Round, Tournament } from '@/lib/types';
import { slateNoun } from '@/lib/cycles';
import { formatSpec, isAdaptive } from '@/lib/formats';
import { knockoutStageOf, type KnockoutStage } from '@/lib/knockout';
import { ChevronDown } from '@/components/icons';

type Status = 'played' | 'unscored' | 'live' | 'next' | 'later';

const STATUS_WORDS: Record<Status, string> = {
  played: 'Played',
  unscored: 'Not scored',
  live: 'On court now',
  next: 'Up next',
  later: 'Later',
};

const scored = (m: Match) => m.scoreA !== null && m.scoreB !== null;

/**
 * The whole night as a plain list: a heading per game, then one row per court.
 *
 * Each match is a single row — court, both pairs, the score between them — so
 * this is the thing you hand to somebody who asks "when am I on?". The game on
 * court now is the only card with an accent ring, and the games already played
 * early in the night fold into one row at the top: by game six nobody is
 * scrolling back to game one, and four screens of history pushed the answer
 * off the bottom.
 *
 * The names are set at 14px, not the 12px everything else on a dense list
 * would take. This is the screen somebody holds up so four people can read it
 * off a bench, and a name nobody can read is the one thing the row cannot
 * afford to lose. They wrap to a second line rather than truncate for the same
 * reason — "Christopher & M…" tells the wrong person they are on next.
 */
export function ScheduleTab({
  tournament,
  names,
  onOpenRound,
}: {
  tournament: Tournament;
  names: Map<Id, string>;
  onOpenRound: (index: number) => void;
}) {
  const [unfolded, setUnfolded] = useState(false);
  const nameOf = (id: Id) => names.get(id) ?? 'Unknown';
  const finished = tournament.status === 'finished';
  const current = tournament.currentRound;
  const rounds = tournament.rounds;

  const statusOf = (round: Round): Status => {
    const i = round.index;
    if (finished || i < current) return round.matches.every(scored) ? 'played' : 'unscored';
    if (i === current) return 'live';
    return i === current + 1 ? 'next' : 'later';
  };

  // Fold the run of played games at the start of the night, keeping the most
  // recent one in view — it is the result people are still talking about.
  // A fold of one game saves nothing, so it takes two to fold.
  const keepFrom = finished ? rounds.length - 1 : current - 1;
  let folded = 0;
  while (folded < keepFrom && rounds[folded]?.matches.every(scored)) folded++;
  if (folded < 2) folded = 0;
  const shown = unfolded ? rounds : rounds.slice(folded);

  return (
    <div className="flex flex-col">
      {isAdaptive(tournament.format) ? (
        <p className="mb-3 px-1 text-[13px] leading-relaxed text-ink-faint">
          {formatSpec(tournament.format).name} builds each {slateNoun(tournament)} from the last
          one&rsquo;s result, so the next one only exists once this one is scored. They appear here
          as they are played.
        </p>
      ) : null}

      {folded > 0 ? (
        <button
          type="button"
          onClick={() => setUnfolded((v) => !v)}
          aria-expanded={unfolded}
          className="card flex min-h-12 w-full items-center gap-2.5 px-4 text-left text-sm text-ink-dim active:bg-surface-2"
        >
          <span className="flex-1">
            {plural(slateNoun(tournament))} 1–{folded} · played
          </span>
          <ChevronDown
            size="sm"
            className={`text-ink-faint transition-transform ${unfolded ? 'rotate-180' : ''}`}
          />
        </button>
      ) : null}

      {shown.map((round, n) => {
        const status = statusOf(round);
        const past = status === 'played' || status === 'unscored';
        const stage = knockoutStageOf(tournament, round.index);
        return (
          <section key={round.index}>
            <div
              className={`mx-1 mb-2 flex items-baseline justify-between gap-3 ${
                n === 0 && folded === 0 ? 'mt-1' : 'mt-5'
              }`}
            >
              <h3 className={`text-[15px] font-semibold ${past ? 'text-ink-dim' : 'text-ink'}`}>
                {stage ? stage.name : `${capitalise(slateNoun(tournament))} ${round.index + 1}`}
              </h3>
              <span
                className={`text-[13px] ${
                  status === 'live' ? 'font-semibold text-accent-text' : 'text-ink-faint'
                }`}
              >
                {STATUS_WORDS[status]}
              </span>
            </div>

            <div
              className={`card divide-y divide-line overflow-hidden ${
                status === 'live'
                  ? 'shadow-[var(--rp-shadow),inset_0_0_0_1.5px_var(--color-accent)]'
                  : ''
              }`}
            >
              {round.matches.map((m, mi) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  status={status}
                  label={matchLabel(stage, mi)}
                  nameOf={nameOf}
                  onOpen={() => onOpenRound(round.index)}
                />
              ))}
              {round.resting.length > 0 ? (
                <div className="flex min-h-9 items-center px-4 text-xs text-ink-faint">
                  {round.resting.length === 1 ? 'Sits out' : 'Sit out'} ·{' '}
                  {round.resting.map(nameOf).join(', ')}
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MatchRow({
  match: m,
  status,
  label,
  nameOf,
  onOpen,
}: {
  match: Match;
  status: Status;
  label: string | null;
  nameOf: (id: Id) => string;
  onOpen: () => void;
}) {
  const done = scored(m);
  const past = status === 'played' || status === 'unscored';
  const left = m.teamA.map(nameOf).join(' & ');
  const right = m.teamB.map(nameOf).join(' & ');
  // A score once there is one; a blank scoreline on the court being played
  // (in ink — it is about to fill) or left unscored (faint); "v" for later.
  const middle = done
    ? `${m.scoreA} – ${m.scoreB}`
    : status === 'live' || status === 'unscored'
      ? '– – –'
      : 'v';
  const middleTone = done || status === 'live' ? 'text-ink' : 'text-ink-faint';
  const nameTone = past ? 'text-ink-dim' : 'text-ink';

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label ? `${label}: ` : ''}Court ${m.courtIndex + 1}, ${left} against ${right}${
        done ? `, ${m.scoreA} to ${m.scoreB}` : status === 'live' ? ', playing now' : ', to come'
      }`}
      className="flex min-h-12 w-full flex-col justify-center gap-0.5 px-4 py-2 text-left active:bg-surface-2"
    >
      {label ? <span className="pl-[26px] text-xs text-ink-faint">{label}</span> : null}
      <span className="flex w-full items-center gap-3">
        {/* The court is what tells two simultaneous games apart; the game
            number is already the heading. */}
        <span className="nums w-3.5 flex-none text-xs text-ink-faint">{m.courtIndex + 1}</span>
        <span className={`line-clamp-2 min-w-0 flex-1 text-sm leading-snug ${nameTone}`}>
          {left}
        </span>
        <span
          className={`nums w-[52px] flex-none text-center text-[15px] font-semibold ${middleTone}`}
        >
          {middle}
        </span>
        <span
          className={`line-clamp-2 min-w-0 flex-1 text-right text-sm leading-snug ${nameTone}`}
        >
          {right}
        </span>
      </span>
    </button>
  );
}

/**
 * A bracket match's own name, when the heading does not already say it. The
 * last bracket game can hold both the final and the third-place match, and
 * "Court 2" alone would not tell anybody which one they are in.
 */
function matchLabel(stage: KnockoutStage | null, index: number): string | null {
  if (!stage || !stage.isFinal || stage.labels.length < 2) return null;
  return stage.labels[index] ?? null;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function plural(noun: 'round' | 'game'): string {
  return noun === 'round' ? 'Rounds' : 'Games';
}
