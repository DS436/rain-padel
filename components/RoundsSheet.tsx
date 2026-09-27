'use client';

import { useState } from 'react';
import type { Tournament } from '@/lib/types';
import {
  Group,
  GroupLabel,
  ListRow,
  PrimaryButton,
  QuietButton,
  SecondaryButton,
  Stepper,
} from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { ArrowLeft, Users } from '@/components/icons';
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
 *
 * It is also where the plan's less frequent controls live, behind the title:
 * who is playing (somebody always leaves early and somebody always turns up
 * late), and stepping back a game after a Next that was tapped too soon.
 */
export function RoundsSheet({
  tournament,
  onClose,
  onChangeRounds,
  onChangeCourtEnd,
  onOpenRoster,
  onUndoAdvance,
  undoLabel,
}: {
  tournament: Tournament;
  onClose: () => void;
  onChangeRounds: (rounds: number) => void;
  onChangeCourtEnd: (at: number | null) => void;
  /** Opens the roster sheet in this sheet's place. */
  onOpenRoster?: () => void;
  /** Steps back to the previous game; omitted when there is none. */
  onUndoAdvance?: () => void;
  /** "Game 5" — the one stepping back returns to. */
  undoLabel?: string;
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

  const playing =
    tournament.mode === 'teams'
      ? tournament.teams.filter((t) => t.active).length
      : tournament.players.filter((p) => p.active).length;

  return (
    <Sheet title="Rounds & court time" onClose={onClose}>
      <div className="-mt-[18px] flex flex-col">
        <GroupLabel>Court time</GroupLabel>
        <Group>
          <div className="flex min-h-14 items-center gap-3 px-4">
            <label htmlFor="court-end" className="flex-1 text-[15px] font-medium">
              Court booked until
            </label>
            {tournament.courtEndsAt ? (
              <button
                type="button"
                onClick={() => onChangeCourtEnd(null)}
                className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-ink-dim active:opacity-60"
              >
                Clear
              </button>
            ) : null}
            <input
              id="court-end"
              type="time"
              value={tournament.courtEndsAt ? epochToTimeString(tournament.courtEndsAt) : ''}
              onChange={(e) => {
                const at = timeStringToEpoch(e.target.value, now);
                if (at !== null) onChangeCourtEnd(at);
              }}
              className="nums h-11 rounded-[10px] bg-surface-2 px-3 text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </Group>
        {tournament.courtEndsAt === null ? (
          <p className="mt-2 px-1 text-[13px] text-ink-faint">
            Set this and the app will tell you whether the rounds fit.
          </p>
        ) : null}

        <GroupLabel>Rounds</GroupLabel>
        <Group>
          <div className="flex min-h-16 items-center gap-3 py-2 pl-4 pr-2">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="nums text-[15px] font-medium">
                On game {min} of {value}
              </span>
              <span className="nums text-xs text-ink-faint">
                {perRound > 1
                  ? `${perRound} games make a round · ${remaining} game${remaining === 1 ? '' : 's'} to go`
                  : `${tournament.currentRound} finished · ${remaining} to go after this one`}
              </span>
            </span>
            <Stepper value={rounds} min={minRounds} max={20} onChange={setRounds} label="rounds" />
          </div>
        </Group>

        <div className="mt-2 flex flex-col gap-0.5 px-1 text-[13px]">
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
            <p className="text-ink-faint">
              {remaining === 0
                ? 'This will be the last game.'
                : `About ${estimateDuration(remaining, tournament.scoring)} of play left, at roughly ${minutesPerRound(tournament.scoring)} min a game.`}
            </p>
          )}
          {isPrecomputed(tournament.format) && rounds > 1 ? (
            <p className="text-ink-faint">
              One round is a full cycle, so round 2 onwards replays partnerships from a different
              starting point.
            </p>
          ) : null}
        </div>

        {onOpenRoster || onUndoAdvance ? (
          <Group className="mt-5">
            {onOpenRoster ? (
              <ListRow
                lead={<Users />}
                title={tournament.mode === 'teams' ? 'Teams' : 'Players'}
                sub={`${playing} playing · someone arrived or left?`}
                chevron
                onClick={onOpenRoster}
              />
            ) : null}
            {/* Next game is one tap and sits under the thumb, so the way back
                from a tap that came too soon stays one tap too. */}
            {onUndoAdvance ? (
              <ListRow
                lead={<ArrowLeft />}
                title={`Back to ${undoLabel ?? 'the last game'}`}
                sub="Undo a Next that came too soon"
                onClick={() => {
                  onUndoAdvance();
                  onClose();
                }}
              />
            ) : null}
          </Group>
        ) : null}

        <div className="mt-6 flex flex-col gap-2.5">
          <PrimaryButton
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
          </PrimaryButton>

          {preview && suggestion !== rounds ? (
            <SecondaryButton onClick={() => setRounds(suggestion)}>
              Fit the court time — {suggestion} round{suggestion === 1 ? '' : 's'}
            </SecondaryButton>
          ) : null}

          {minRounds < rounds ? (
            <QuietButton onClick={() => setRounds(minRounds)}>
              Out of time — end after this round
            </QuietButton>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

/** The fit, in words, coloured only when it needs attention. */
function FitLine({ status, lines }: { status: 'fits' | 'tight' | 'over'; lines: string[] }) {
  const tone = { fits: 'text-ink-dim', tight: 'text-warn', over: 'text-danger' }[status];
  return (
    <>
      {lines.map((l) => (
        <p key={l} className={`nums ${tone}`}>
          {l}
        </p>
      ))}
    </>
  );
}
