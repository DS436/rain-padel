'use client';

import { useState } from 'react';
import type { Tournament } from '@/lib/types';
import { Button, Stepper } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { isPrecomputed } from '@/lib/formats';
import { useNow } from '@/components/useNow';
import { estimateDuration, formatDuration, minutesPerRound } from '@/lib/format';
import { gamesPerRound, gamesToRounds, roundsToGames } from '@/lib/cycles';
import {
  courtFit,
  epochToTimeString,
  formatTimeOfDay,
  roundsToFit,
  timeStringToEpoch,
} from '@/lib/court';


/**
 * Court time is the real constraint on a padel night, so this panel puts the
 * booking and the round count in one place: tell it when the court is up, and
 * it says whether the plan fits and offers the round count that would.
 *
 * The floor is `currentRound + 1` — you can always cut a session short after
 * the round being played, but never delete a round that already happened.
 */
export function RoundsSheet({
  tournament,
  onClose,
  onChangeRounds,
  onChangeCourtEnd,
}: {
  tournament: Tournament;
  onClose: () => void;
  onChangeRounds: (rounds: number) => void;
  onChangeCourtEnd: (at: number | null) => void;
}) {
  const now = useNow(1000);
  const perRound = gamesPerRound(tournament);

  // The organiser thinks in rounds; everything under here is still counted in
  // games, so this is the one place the two meet.
  const minRounds = gamesToRounds(tournament.currentRound + 1, perRound);
  const [rounds, setRounds] = useState(gamesToRounds(tournament.plannedRounds, perRound));

  const value = roundsToGames(rounds, perRound);
  const min = tournament.currentRound + 1;
  const remaining = Math.max(0, value - min);
  const delta = rounds - gamesToRounds(tournament.plannedRounds, perRound);

  // preview the fit for the number currently dialled in, not the saved one
  const preview = courtFit({ ...tournament, plannedRounds: value }, now);
  // roundsToFit answers in games. Round DOWN — suggesting the round that only
  // half fits is exactly the overrun this panel exists to prevent.
  const suggestion = Math.max(
    minRounds,
    Math.floor(roundsToFit(tournament, now) / perRound),
  );

  return (
    <Sheet title="Rounds & court time" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Court booked until
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={tournament.courtEndsAt ? epochToTimeString(tournament.courtEndsAt) : ''}
              onChange={(e) => {
                const at = timeStringToEpoch(e.target.value, now);
                if (at !== null) onChangeCourtEnd(at);
              }}
              className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-4 text-base text-ink focus:border-accent focus:outline-none"
            />
            {tournament.courtEndsAt ? (
              <button
                type="button"
                onClick={() => onChangeCourtEnd(null)}
                className="min-h-11 rounded-xl border border-line px-4 text-sm text-ink-faint active:bg-surface-2"
              >
                Clear
              </button>
            ) : null}
          </div>
          {tournament.courtEndsAt === null ? (
            <p className="text-xs text-ink-faint">
              Set this and the app will tell you whether the rounds fit.
            </p>
          ) : null}
        </section>

        <section className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="nums text-sm text-ink-dim">
              On game {min} of {value}
            </span>
            <span className="text-xs text-ink-faint">
              {perRound > 1
                ? `${perRound} games make a round · ${remaining} game${remaining === 1 ? '' : 's'} to go`
                : `${tournament.currentRound} finished · ${remaining} to go after this one`}
            </span>
          </div>
          <Stepper value={rounds} min={minRounds} max={20} onChange={setRounds} />
        </section>

        {preview ? (
          <FitLine
            status={preview.status}
            lines={[
              preview.remainingMs > 0
                ? `${formatDuration(Math.round(preview.remainingMs / 60_000))} of court time left.`
                : `Court time ran out ${formatDuration(Math.round(-preview.remainingMs / 60_000))} ago.`,
              preview.status === 'over'
                ? `${value - tournament.currentRound} games would finish at ${formatTimeOfDay(preview.projectedFinish)} — about ${formatDuration(Math.round(preview.overrunMs / 60_000))} late.`
                : `Finishing around ${formatTimeOfDay(preview.projectedFinish)}.`,
            ]}
          />
        ) : (
          <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-dim">
            {remaining === 0
              ? 'This will be the last game.'
              : `About ${estimateDuration(remaining, tournament.scoring)} of play left, at roughly ${minutesPerRound(tournament.scoring)} min a game.`}
          </p>
        )}

        {isPrecomputed(tournament.format) && rounds > 1 ? (
          <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-dim">
            One round is a full cycle, so round 2 onwards replays partnerships from a different
            starting point.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            disabled={delta === 0}
            onClick={() => {
              onChangeRounds(value);
              onClose();
            }}
          >
            {delta === 0
              ? 'No change'
              : delta > 0
                ? `Add ${delta} round${delta === 1 ? '' : 's'}`
                : `Remove ${Math.abs(delta)} round${Math.abs(delta) === 1 ? '' : 's'}`}
          </Button>

          {preview && suggestion !== rounds ? (
            <Button variant="ghost" className="w-full" onClick={() => setRounds(suggestion)}>
              Fit the court time — {suggestion} round{suggestion === 1 ? '' : 's'}
            </Button>
          ) : null}

          {minRounds < rounds ? (
            <button
              type="button"
              onClick={() => setRounds(minRounds)}
              className="min-h-11 text-sm text-ink-faint underline underline-offset-4"
            >
              Out of time — end after this round
            </button>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

function FitLine({ status, lines }: { status: 'fits' | 'tight' | 'over'; lines: string[] }) {
  const tone = {
    fits: 'border-accent/30 bg-accent/10 text-accent',
    tight: 'border-warn/40 bg-warn/10 text-warn',
    over: 'border-danger/40 bg-danger/10 text-danger',
  }[status];

  return (
    <div className={`flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm ${tone}`}>
      {lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}
