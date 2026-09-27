'use client';

import { Sheet } from '@/components/Sheet';
import { PrimaryButton, QuietButton, SecondaryButton } from '@/components/ui';
import { ArrowRight } from '@/components/icons';

/**
 * The "are you sure" between a padel night and its final standings.
 *
 * Finishing used to be a single tap on the last game of the plan, which is a
 * cliff: nobody sets the round count correctly at the start — they set it to
 * one and keep going — so "Finish session" appears under your thumb every
 * couple of games, and one mis-tap locks the table. This makes it a decision
 * with the alternative sitting right next to it, because in practice the
 * answer at the end of a plan is usually "actually, one more".
 *
 * Play-another is the prominent button for exactly that reason. Finishing is
 * always reversible — a finished session reopens — but it still ends the
 * evening on screen, and undoing something is worse than never doing it. The
 * sentence under the title says exactly what finishing drops, so the grey
 * button is never a guess.
 */
export function FinishSheet({
  reason,
  dropped,
  gamesPerRound,
  noun = 'round',
  onFinish,
  onPlayAnother,
  onClose,
}: {
  /** 'plan-complete' = the last planned game is scored. 'early' = stopping short. */
  reason: 'plan-complete' | 'early';
  /** planned games that would be thrown away. Only meaningful when 'early'. */
  dropped: number;
  gamesPerRound: number;
  /** What one more of them is called here — "round" or "game". */
  noun?: 'round' | 'game';
  onFinish: () => void;
  onPlayAnother: () => void;
  onClose: () => void;
}) {
  // A round of several games is still "another round" — the count is what
  // the organiser dialled, not something to make them multiply.
  const more = `Play another ${gamesPerRound > 1 ? 'round' : noun}`;
  const kept = 'Every score so far is kept and the table as it stands becomes the result.';

  const description =
    reason === 'early'
      ? dropped > 0
        ? `${dropped} planned game${dropped === 1 ? ' hasn’t' : 's haven’t'} been played. ${kept}`
        : kept
      : `That was every game you planned. ${kept}`;

  return (
    <Sheet
      title={reason === 'early' ? 'Finish here?' : 'That was the last game'}
      description={description}
      onClose={onClose}
      showClose={false}
    >
      <div className="flex flex-col gap-2.5 pt-1">
        <PrimaryButton onClick={onPlayAnother}>
          {more}
          <ArrowRight />
        </PrimaryButton>
        <SecondaryButton onClick={onFinish}>Finish the session</SecondaryButton>
        <QuietButton onClick={onClose}>Not yet</QuietButton>
      </div>
    </Sheet>
  );
}
