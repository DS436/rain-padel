'use client';

import { useMemo, useState } from 'react';
import type { Id, KnockoutSize, Tournament } from '@/lib/types';
import {
  GroupLabel,
  Group,
  PrimaryButton,
  QuietButton,
  Segmented,
  SwitchRow,
} from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { BracketView } from '@/components/BracketView';
import { AvatarStack } from '@/components/PlayerAvatar';
import {
  KNOCKOUT_SIZES,
  canPlayThirdPlace,
  courtsNeeded,
  maxKnockoutSize,
  seedPairs,
  unitsNeeded,
} from '@/lib/knockout';
import { activeTeams } from '@/lib/rounds';

/**
 * Turning a leaderboard into a night with an ending.
 *
 * The one thing this screen has to do before anybody commits is show WHO goes
 * through and who they play, because "top four" means something different in
 * teams mode and individuals mode and nobody should have to find that out by
 * pressing the button.
 *
 * Once the bracket is running the same sheet is the whole draw — the Round tab
 * shows the game on court and what is still to come, this shows everything
 * including what has been played — and the way to call the finals off.
 */
export function KnockoutSheet({
  tournament,
  colors,
  onClose,
  onStart,
  onCancel,
  onFinishEarly,
}: {
  tournament: Tournament;
  colors: Map<Id, string>;
  onClose: () => void;
  onStart: (size: KnockoutSize, thirdPlace: boolean) => void;
  onCancel: () => void;
  /** Stop the night where it stands, bracket unfinished. */
  onFinishEarly?: () => void;
}) {
  const running = tournament.knockout !== null;
  const available =
    tournament.mode === 'teams'
      ? activeTeams(tournament).length
      : tournament.players.filter((p) => p.active).length;

  // Every game of a bracket round happens at once, so the venue caps the
  // bracket as hard as the roster does: four quarter-finals need four courts.
  const courtCap = maxKnockoutSize(tournament.courts);
  const fits = (s: KnockoutSize) => unitsNeeded(tournament, s) <= available && s <= courtCap;
  const sizes = KNOCKOUT_SIZES.filter(fits);
  const largest = sizes.at(-1) ?? 2;
  const [size, setSize] = useState<KnockoutSize>(tournament.knockout?.size ?? largest);
  const [thirdPlace, setThirdPlace] = useState(
    tournament.knockout?.thirdPlace ?? canPlayThirdPlace(tournament, largest),
  );

  const preview = useMemo(
    () => (running ? null : seedPairs(tournament, size)),
    [running, tournament, size],
  );

  const nameOf = (id: Id) => tournament.players.find((p) => p.id === id)?.name ?? '?';

  if (running) {
    return (
      <Sheet title="The finals" onClose={onClose}>
        <div className="-mt-5 flex flex-col gap-4 pb-2">
          <BracketView tournament={tournament} colors={colors} />
          <QuietButton
            className="text-danger!"
            onClick={() => {
              if (
                window.confirm(
                  'Cancel the finals? The bracket games are dropped and the night goes back to a plain leaderboard. Group scores are kept.',
                )
              ) {
                onCancel();
                onClose();
              }
            }}
          >
            Cancel the finals
          </QuietButton>
          {/* Last orders can arrive before the final does. Finishing keeps
              every score and ends the night on the table as it stands. */}
          {onFinishEarly && tournament.status === 'live' ? (
            <QuietButton className="-mt-4" onClick={onFinishEarly}>
              Finish the night here
            </QuietButton>
          ) : null}
        </div>
      </Sheet>
    );
  }

  const stageWord = size === 2 ? 'final' : size === 4 ? 'semi-finals' : 'quarter-finals';

  return (
    <Sheet
      title="Finish with a knockout"
      description="The table so far seeds the bracket, then it's sudden death."
      onClose={onClose}
    >
      <div className="flex flex-col pb-2">
        {/* Only the sizes that can actually be played are offered — one that
            doesn't fit the roster or the courts is not a choice, it's a trap. */}
        {sizes.length > 1 ? (
          <Segmented
            value={String(size)}
            onChange={(v) => setSize(Number(v) as KnockoutSize)}
            options={sizes.map((s) => ({ value: String(s), label: `${s} pairs` }))}
          />
        ) : null}
        <p className="mt-2.5 px-1 text-[13px] text-ink-faint">
          {tournament.mode === 'teams'
            ? `${available} team${available === 1 ? '' : 's'} still in — a bracket of ${size} needs ${unitsNeeded(tournament, size)}.`
            : `${available} player${available === 1 ? '' : 's'} still in — ${size} pairs means the top ${unitsNeeded(tournament, size)} qualify.`}
          {/* A bracket round is played all at once, so a bigger one is not a
              matter of will — there is nowhere to put the other game. */}
          {courtCap < 8
            ? ` ${tournament.courts === 1 ? 'One court' : `${tournament.courts} courts`}, so the biggest bracket that fits is ${courtCap}${courtCap === 2 ? ' — a straight final' : ''}: a bracket of ${courtCap === 2 ? 4 : 8} would be ${courtsNeeded(courtCap === 2 ? 4 : 8)} games at the same time.`
            : ''}
        </p>

        <GroupLabel>Who goes through</GroupLabel>
        {preview ? (
          <Group as="ul">
            {preview.map((p) => (
              <li key={p.seed} className="flex h-[52px] items-center gap-2.5 px-4">
                <span className="nums w-[18px] flex-none text-xs text-ink-faint">{p.seed}</span>
                <AvatarStack
                  people={p.players.map((id) => ({ name: nameOf(id), color: colors.get(id) }))}
                />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.name}</span>
              </li>
            ))}
          </Group>
        ) : (
          <p className="px-1 text-sm text-warn">
            Not enough of the roster left to fill a bracket of {size}.
          </p>
        )}
        {preview && tournament.mode === 'individual' ? (
          <p className="mt-2 px-1 text-[13px] text-ink-faint">
            Qualifiers are folded strongest with weakest, so no pair starts as a certainty.
          </p>
        ) : null}

        {canPlayThirdPlace(tournament, size) ? (
          <Group className="mt-3">
            <SwitchRow
              title="Third-place play-off"
              sub="On the court the final isn’t using"
              on={thirdPlace}
              onChange={setThirdPlace}
            />
          </Group>
        ) : null}

        <PrimaryButton
          className="mt-6"
          disabled={!preview}
          onClick={() => {
            onStart(size, thirdPlace);
            onClose();
          }}
        >
          Start the {stageWord}
        </PrimaryButton>
        <p className="mt-2.5 text-center text-[13px] text-ink-faint">
          Everything played so far is kept and becomes the qualifying table. Any games still in
          the plan are dropped.
        </p>
      </div>
    </Sheet>
  );
}
