'use client';

import { useRef, useState } from 'react';
import type { Scoring } from '@/lib/types';

/**
 * Score entry. This is the interaction repeated forty times a night, so it is
 * worth the code.
 *
 * ONE control, not three. It used to offer tap, slide and type behind a mode
 * picker, which meant the first thing you did on every court was answer a
 * question about how you were going to answer the next question. The keyboard
 * is gone entirely — nobody wants a number pad while holding a racket — and
 * tap and slide have been merged into the same surface: press a number to
 * choose it, or press and drag across the pad and the score follows your thumb
 * the whole way. There is no mode, so there is nothing to get wrong.
 *
 * `touch-action: pan-y` is what makes both work at once. A drag that starts
 * vertically still scrolls the page, because the pad is tall and there are two
 * courts below it; a drag that starts sideways is ours, and from then on the
 * browser sends us the vertical component too, so you can sweep diagonally
 * across all four rows in one movement.
 *
 * Points mode is LINKED: one value drives both sides, so the pair always sums
 * to the target and an invalid total is unreachable. Either number can be the
 * one you drive — pressing a side selects it. Forcing team A to be canonical
 * would double the mental load, because the organiser looks at the court and
 * thinks "the top pair got 14" or "the bottom pair got 10" with equal odds.
 *
 * Spec 9.6 wants an off-target total accepted for a match that stopped early,
 * which linked mode makes impossible — hence the "ended early" escape hatch to
 * FREE mode. Time mode is always free: there is no target to complement
 * against, so the pad simply grows as the numbers do.
 */

/** Where the pad starts when no target bounds it (time scoring). */
const FREE_BASE = 16;
/** Cells per row. Eight keeps a 24-point race to four rows on a phone. */
const COLUMNS = 8;

export function ScoreStepper({
  scoring,
  scoreA,
  scoreB,
  onChange,
  labelA,
  labelB,
}: {
  scoring: Scoring;
  scoreA: number | null;
  scoreB: number | null;
  onChange: (a: number | null, b: number | null) => void;
  labelA: string;
  labelB: string;
}) {
  const [side, setSide] = useState<'A' | 'B'>('A');
  const [freed, setFreed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pad = useRef<HTMLDivElement>(null);

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
      : Math.max(FREE_BASE, Math.ceil((highest + 2) / COLUMNS) * COLUMNS);

  const current = side === 'A' ? scoreA : scoreB;
  const unscored = scoreA === null || scoreB === null;

  /** Commit a value for the SELECTED side. Linked mode fills in the other. */
  const commit = (raw: number) => {
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

  /**
   * The number under a point on the screen.
   *
   * Read off the DOM rather than off the pad's geometry: the cells are a CSS
   * grid, so the browser already knows exactly where each one is, and asking
   * it keeps this correct through every wrap, gap and font-size change.
   */
  const valueAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y);
    const cell = el instanceof Element ? el.closest('[data-score]') : null;
    if (!cell || !pad.current?.contains(cell)) return null;
    const n = Number(cell.getAttribute('data-score'));
    return Number.isFinite(n) ? n : null;
  };

  const track = (e: React.PointerEvent) => {
    const v = valueAt(e.clientX, e.clientY);
    if (v !== null && v !== current) commit(v);
  };

  const total = (scoreA ?? 0) + (scoreB ?? 0);
  const mismatched = scoring.mode === 'points' && !unscored && total !== target;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-4">
        <ScoreFace
          value={scoreA}
          selected={side === 'A'}
          onSelect={() => setSide('A')}
          label={labelA}
        />
        <span aria-hidden className="text-2xl text-ink-faint">
          –
        </span>
        <ScoreFace
          value={scoreB}
          selected={side === 'B'}
          onSelect={() => setSide('B')}
          label={labelB}
        />
      </div>

      <div
        ref={pad}
        role="group"
        aria-label={`Score for ${side === 'A' ? labelA : labelB}`}
        className="grid select-none grid-cols-8 gap-1"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          // Capture so the drag keeps reporting to this element even once the
          // finger has travelled outside it.
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          const v = valueAt(e.clientX, e.clientY);
          if (v !== null) commit(v);
        }}
        onPointerMove={(e) => {
          if (dragging) track(e);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {Array.from({ length: max + 1 }, (_, n) => {
          const on = current === n;
          // The other side's number in linked mode: shown faintly so you can
          // see the complement move as you drag without hunting for it.
          const mirrored = linked && !unscored && target - n === current && !on;
          return (
            <button
              key={n}
              type="button"
              data-score={n}
              aria-pressed={on}
              // Everything happens on the pointer handlers above; this keeps
              // the keyboard path working without double-committing a tap.
              onClick={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  commit(n);
                }
              }}
              className={`nums pointer-events-auto flex aspect-square min-h-10 items-center justify-center rounded-lg border text-base tabular-nums transition-colors ${
                on
                  ? 'border-accent bg-accent font-semibold text-accent-ink'
                  : mirrored
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-line bg-surface-2 text-ink'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-6 items-center justify-between gap-3 text-xs">
        {mismatched ? (
          <span className="nums text-warn">
            Total {total}, target {target} — saved anyway
          </span>
        ) : (
          <span className="truncate text-ink-faint">
            {unscored ? 'Tap a number, or drag across' : `Entering for ${side === 'A' ? labelA : labelB}`}
          </span>
        )}
        {scoring.mode === 'points' ? (
          <button
            type="button"
            onClick={() => setFreed((f) => !f)}
            className="shrink-0 text-ink-faint underline underline-offset-4"
          >
            {freed ? 'Back to linked' : 'Ended early?'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ScoreFace({
  value,
  selected,
  onSelect,
  label,
}: {
  value: number | null;
  selected: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Enter the score for ${label}`}
      className={`flex min-w-20 justify-center rounded-xl border px-3 py-1 transition-colors ${
        selected ? 'border-accent bg-accent/10' : 'border-transparent'
      }`}
    >
      <span className="nums text-5xl font-semibold tabular-nums">
        {value === null ? <span className="text-ink-faint">–</span> : value}
      </span>
    </button>
  );
}
