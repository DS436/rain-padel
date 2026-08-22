'use client';

import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui';

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
 * evening on screen, and undoing something is worse than never doing it.
 */
export function FinishSheet({
  reason,
  dropped,
  gamesPerRound,
  onFinish,
  onPlayAnother,
  onClose,
}: {
  /** 'plan-complete' = the last planned game is scored. 'early' = stopping short. */
  reason: 'plan-complete' | 'early';
  /** planned games that would be thrown away. Only meaningful when 'early'. */
  dropped: number;
  gamesPerRound: number;
  onFinish: () => void;
  onPlayAnother: () => void;
  onClose: () => void;
}) {
  const more =
    gamesPerRound > 1 ? `Play another round · ${gamesPerRound} more games` : 'Play another game';

  return (
    <Sheet title={reason === 'early' ? 'Finish here?' : 'That was the last game'} onClose={onClose}>
      <div className="flex flex-col gap-5 pb-2">
        <p className="text-pretty leading-relaxed text-ink-dim">
          {reason === 'early' ? (
            dropped > 0 ? (
              <>
                Ending now drops the{' '}
                <span className="nums font-semibold text-ink">{dropped}</span> unplayed game
                {dropped === 1 ? '' : 's'} left in the plan, and the standings on screen become the
                final ones.
              </>
            ) : (
              <>The standings on screen become the final ones.</>
            )
          ) : (
            <>
              You have played every game you planned. Finish here and the table is locked in — or
              keep the court and add another round.
            </>
          )}
        </p>

        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={onPlayAnother}>
            {more}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onFinish}>
            Finish the session
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 text-sm text-ink-faint underline underline-offset-4"
          >
            {reason === 'early' ? 'Keep playing' : 'Not yet'}
          </button>
        </div>

        <p className="text-xs leading-relaxed text-ink-faint">
          Nothing here is permanent — a finished session can be reopened, and the scores are never
          deleted.
        </p>
      </div>
    </Sheet>
  );
}
