'use client';

import { useEffect, useRef, useState } from 'react';
import type { Id, Scoring } from '@/lib/types';
import { TeamSide, Versus } from '@/components/TeamSide';
import { Check } from '@/components/icons';

/**
 * Score entry. This is the interaction repeated forty times a night, so it is
 * worth the code.
 *
 * The two sides are side-by-side panels with their own number underneath. The
 * number pad is NOT on the card until you tap one of them: a fresh round shows
 * the two pairs and nothing you can score by accident. Tapping a pair opens
 * the pad driving that pair; tapping it again, or Done, puts the pad away.
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
 * at arm's length.
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

export function ScoreStepper({
  scoring,
  scoreA,
  scoreB,
  onChange,
  teamA,
  teamB,
  names,
  colors,
  court,
}: {
  scoring: Scoring;
  scoreA: number | null;
  scoreB: number | null;
  onChange: (a: number | null, b: number | null) => void;
  teamA: readonly [Id, Id];
  teamB: readonly [Id, Id];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  /** "Court 1", or the bracket's name for this game. */
  court: string;
}) {
  /** The side the pad is driving; null while the pad is put away. */
  const [side, setSide] = useState<'A' | 'B' | null>(null);
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
    ids.map((id) => names.get(id) ?? 'Unknown').join(' · ');
  const drivingLabel = side ? nameOf(side === 'A' ? teamA : teamB) : '';

  /** Tapping the lit pair again puts the pad away. */
  const pick = (next: 'A' | 'B') => {
    if (side === next) {
      setSide(null);
      return;
    }
    setSide(next);
  };

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

  const cellTone = (isCurrent: boolean, isMirror: boolean) =>
    isCurrent
      ? 'border-accent bg-accent text-accent-ink'
      : isMirror
        ? 'border-accent/45 bg-accent/[0.12] text-accent'
        : 'border-line bg-surface-2 text-ink';

  const isMirror = (n: number) => linked && !unscored && target - n === current && n !== current;

  return (
    <div className="flex flex-col">
      {/* With the pad put away this line is the only instruction on the card,
          and on a scored card the only thing saying the number is in. */}
      <div className="flex items-center justify-between px-3.5 pt-3">
        <span aria-hidden className="disp text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint">
          {court}
        </span>
        {unscored ? (
          side ? null : (
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              Tap a pair to score
            </span>
          )
        ) : (
          <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-accent">
            <Check size="sm" />
            {side ? 'Scored' : 'Scored · tap a pair to change'}
          </span>
        )}
      </div>

      <div className="flex items-stretch gap-2 px-3.5 pt-2.5">
        <TeamSide
          players={teamA}
          names={names}
          colors={colors}
          score={scoreA}
          selected={side === 'A'}
          onSelect={() => pick('A')}
        />
        <Versus />
        <TeamSide
          players={teamB}
          names={names}
          colors={colors}
          score={scoreB}
          selected={side === 'B'}
          onSelect={() => pick('B')}
        />
      </div>

      {side === null ? (
        <div className="pb-3.5" />
      ) : (
        <>
          <div className="px-2 pb-3 pt-2.5">
            <div
              role="group"
              aria-label={`Score for ${drivingLabel}`}
              className="grid select-none grid-cols-6 gap-2"
            >
              {Array.from({ length: max + 1 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={current === n}
                  // Click, not pointerdown: the browser drops the click when
                  // the touch became a scroll, which is the whole fix.
                  onClick={(e) => commit(n, e.timeStamp)}
                  className={`nums disp flex min-h-[54px] items-center justify-center rounded-[12px] border text-lg font-bold ${cellTone(
                    current === n,
                    isMirror(n),
                  )}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2.5 border-t border-line-soft px-3.5">
            {mismatched ? (
              <span className="nums font-mono text-[10px] font-medium text-warn">
                Total {total}, target {target} — saved anyway
              </span>
            ) : (
              <span className="nums truncate font-mono text-[10px] font-medium text-ink-faint">
                {scoring.mode === 'points'
                  ? `${total} / ${target} · ${linked ? 'linked' : 'free'}`
                  : 'Tap a number'}
              </span>
            )}
            <div className="flex shrink-0 items-center gap-3">
              {scoring.mode === 'points' ? (
                <button
                  type="button"
                  onClick={() => setFreed((f) => !f)}
                  className="inline-flex min-h-11 items-center gap-1.5 text-[10.5px] font-medium text-ink-faint"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    aria-hidden
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 14 4 9l5-5" />
                    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                  </svg>
                  {freed ? 'Back to linked' : 'Ended early?'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSide(null)}
                className="inline-flex min-h-11 min-w-14 items-center justify-center rounded-lg px-3 text-xs font-semibold text-accent active:bg-accent/10"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
