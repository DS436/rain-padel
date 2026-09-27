'use client';

import { useEffect, useRef, useState } from 'react';
import type { Id, Scoring } from '@/lib/types';
import { TeamSide } from '@/components/TeamSide';

/**
 * Score entry. This is the interaction repeated forty times a night, so it is
 * worth the code.
 *
 * The two pairs are stacked rows with their own number on the right. The
 * number pad is NOT on the card until you tap one of them: a fresh round shows
 * the two pairs and nothing you can score by accident. Tapping a pair opens
 * the pad driving that pair; tapping it again, or Done, puts the pad away.
 * Which pair is lit is the card's owner's state (`side`), because the heading
 * above the card changes with it.
 *
 * The pad used to be live the instant a round appeared and committed on
 * pointer-DOWN, with press-and-drag to slide the score. On a sweaty phone at
 * the side of a court that meant every scroll that began on the pad, and every
 * finger still on the glass as a new round rendered, wrote a score. So a
 * number now only counts as a real tap: it goes through the button's click,
 * which the browser already withholds when the touch turns into a scroll, and
 * a tap that lands within a moment of the pad opening is ignored as the tail
 * of the tap that opened it. Drag-to-slide went with it — it was the same
 * sensitivity by design.
 *
 * The cells are big (six to a row) because the thumb is wet and the phone is
 * at arm's length. In linked mode each cell also carries, small underneath,
 * the number the OTHER pair ends up with — so "10" reads as 10–6 before you
 * tap it, and nobody has to do the subtraction mid-rally.
 *
 * The pad stays open after a number goes in. A mis-tap is the normal failure
 * here — you meant 14 and your thumb found 13 — and the fix should be one more
 * tap, not a trip out of the round. Nothing is final until the round advances.
 *
 * Points mode is LINKED: one value drives both sides, so the pair always sums
 * to the target and an invalid total is unreachable. Either number can be the
 * one you drive — tapping a side selects it. Forcing team A to be canonical
 * would double the mental load, because the organiser looks at the court and
 * thinks "the top pair got 14" or "the bottom pair got 10" with equal odds.
 *
 * Spec 9.6 wants an off-target total accepted for a match that stopped early,
 * which linked mode makes impossible — hence the "ended early" escape hatch to
 * FREE mode. Time mode is always free: there is no target to complement
 * against, so the pad simply grows as the numbers do.
 */

/** Where the pad starts when no target bounds it (time scoring). */
const FREE_BASE = 17;
/** Cells per row. Six keeps each cell wide enough for a wet thumb. */
const COLUMNS = 6;
/** A tap on the pad this soon after it opened is the opening tap bleeding through. */
const SETTLE_MS = 350;

export type Side = 'A' | 'B';

export function ScoreStepper({
  scoring,
  scoreA,
  scoreB,
  onChange,
  teamA,
  teamB,
  names,
  colors,
  side,
  onSide,
  seedOf,
}: {
  scoring: Scoring;
  scoreA: number | null;
  scoreB: number | null;
  onChange: (a: number | null, b: number | null) => void;
  teamA: readonly [Id, Id];
  teamB: readonly [Id, Id];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  /** The side the pad is driving; null while the pad is put away. */
  side: Side | null;
  onSide: (side: Side | null) => void;
  /** A bracket game shows each pair's seed in front of the faces. */
  seedOf?: (ids: readonly [Id, Id]) => number | null;
}) {
  const [freed, setFreed] = useState(false);
  /** When the pad last appeared, on the same clock as an event's timeStamp. */
  const openedAt = useRef(0);
  const open = side !== null;
  useEffect(() => {
    if (open) openedAt.current = performance.now();
  }, [open]);

  const linked = scoring.mode === 'points' && !freed;
  const target = scoring.mode === 'points' ? scoring.target : 0;

  // The pad needs an upper bound. In points mode it is the target — that is
  // the whole point of a linked pair. In time mode nothing bounds it, so it
  // grows a row at a time as the scores climb rather than capping the night at
  // some number somebody picked years ago.
  const highest = Math.max(scoreA ?? 0, scoreB ?? 0);
  const max =
    scoring.mode === 'points'
      ? target
      : Math.max(FREE_BASE, Math.ceil((highest + 2) / COLUMNS) * COLUMNS - 1);

  const current = side === 'A' ? scoreA : side === 'B' ? scoreB : null;
  const unscored = scoreA === null || scoreB === null;
  const nameOf = (ids: readonly [Id, Id]) =>
    ids.map((id) => names.get(id) ?? 'Unknown').join(' & ');
  const drivingLabel = side ? nameOf(side === 'A' ? teamA : teamB) : '';

  /** Tapping the lit pair again puts the pad away. */
  const pick = (next: Side) => onSide(side === next ? null : next);

  /** Commit a value for the SELECTED side. Linked mode fills in the other. */
  const commit = (raw: number, at: number) => {
    if (side === null || at - openedAt.current < SETTLE_MS) return;
    const v = Math.max(0, Math.round(raw));
    if (linked) {
      const clamped = Math.min(target, v);
      if (side === 'A') onChange(clamped, target - clamped);
      else onChange(target - clamped, clamped);
      return;
    }
    // Free mode: the other side keeps whatever it had, defaulting to 0 so a
    // half-entered card still counts as scored rather than blocking the round.
    if (side === 'A') onChange(v, scoreB ?? 0);
    else onChange(scoreA ?? 0, v);
  };

  const total = (scoreA ?? 0) + (scoreB ?? 0);
  const mismatched = scoring.mode === 'points' && !unscored && total !== target;

  const row = (which: Side) => {
    const ids = which === 'A' ? teamA : teamB;
    const other = side !== null && side !== which;
    return (
      <TeamSide
        players={ids}
        names={names}
        colors={colors}
        score={which === 'A' ? scoreA : scoreB}
        selected={side === which}
        nameTone={other ? 'dim' : 'normal'}
        scoreTone={other ? 'faint' : 'ink'}
        onSelect={() => pick(which)}
        seed={seedOf ? seedOf(ids) : undefined}
      />
    );
  };

  return (
    <div className="flex flex-col divide-y divide-line">
      {row('A')}
      {row('B')}

      {side === null ? null : (
        <div>
          <div className="px-3 pt-3">
            <div
              role="group"
              aria-label={`Score for ${drivingLabel}`}
              className="grid select-none grid-cols-6 gap-1.5"
            >
              {Array.from({ length: max + 1 }, (_, n) => {
                const on = current === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    aria-label={linked ? `${n} to ${target - n}` : String(n)}
                    // Click, not pointerdown: the browser drops the click when
                    // the touch became a scroll, which is the whole fix.
                    onClick={(e) => commit(n, e.timeStamp)}
                    className={`nums flex h-[50px] flex-col items-center justify-center gap-px rounded-[10px] ${
                      on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink active:opacity-70'
                    }`}
                  >
                    <span className={`text-[17px] leading-none ${on ? 'font-semibold' : 'font-medium'}`}>
                      {n}
                    </span>
                    {/* What the other pair gets for this tap. Only a linked pad
                        knows — in free mode the other number is its own. */}
                    {linked ? (
                      <span
                        aria-hidden
                        className={`text-[10px] leading-none ${on ? 'opacity-70' : 'text-ink-faint'}`}
                      >
                        {target - n}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex h-12 items-center justify-between gap-3 px-4">
            {scoring.mode === 'points' ? (
              <button
                type="button"
                onClick={() => setFreed((f) => !f)}
                aria-pressed={freed}
                className="-ml-1 inline-flex min-h-11 flex-none items-center px-1 text-sm text-ink-dim active:opacity-60"
              >
                {freed ? 'Back to linked' : 'Ended early?'}
              </button>
            ) : (
              <span />
            )}
            {/* Said quietly: an off-target total is allowed (a game that
                stopped early), it is just worth a second look. */}
            {mismatched ? (
              <span className="nums min-w-0 truncate text-xs text-warn">
                {total} of {target} · saved anyway
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onSide(null)}
              className="-mr-1 inline-flex min-h-11 min-w-11 flex-none items-center justify-center px-1 text-sm font-semibold text-accent-text active:opacity-60"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
