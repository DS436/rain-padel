'use client';

import { useRef, useState } from 'react';
import type { Id, Scoring } from '@/lib/types';
import { TeamSide, Versus } from '@/components/TeamSide';
import { Check } from '@/components/icons';

/**
 * Score entry. This is the interaction repeated forty times a night, so it is
 * worth the code.
 *
 * The two sides are side-by-side panels with their own number underneath, and
 * the grid below drives whichever one is lit. Nothing on the card is separable
 * from the people it belongs to — a thumb landing wrong used to hand the other
 * pair fourteen points in silence.
 *
 * The pad is the eight-column grid and nothing else. It used to have three
 * shapes — a sideways tape and a pick-the-winner mode alongside it — which
 * meant a picker on the card's header line and two more layouts to keep
 * correct, to reach a target the grid already hits: press a number outright,
 * or press and drag across and the score follows your thumb. One pad, always
 * in the same place, is worth more at the side of a court than three.
 *
 * There is no keyboard anywhere: nobody wants a number pad while holding a
 * racket.
 *
 * `touch-action: pan-y` on the grid is what lets tap and drag coexist. A drag
 * that starts vertically still scrolls the page, because the pad is tall and
 * there are two courts below it; a drag that starts sideways is ours, and from
 * then on the browser sends us the vertical component too, so you can sweep
 * diagonally across all four rows in one movement.
 *
 * The grid does NOT go away once both numbers are in. A mis-tap is the normal
 * failure here — you meant 14 and your thumb found 13 — and the card used to
 * collapse to a read-only summary the instant it was scored, so the fix meant
 * leaving the round and coming back. It now stays live until the round is
 * advanced, which is the moment the organiser actually means "that's final".
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
  const [side, setSide] = useState<'A' | 'B'>('A');
  const [freed, setFreed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

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
  const nameOf = (ids: readonly [Id, Id]) =>
    ids.map((id) => names.get(id) ?? 'Unknown').join(' · ');
  const drivingLabel = nameOf(side === 'A' ? teamA : teamB);

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
    if (!cell || !gridRef.current?.contains(cell)) return null;
    const n = Number(cell.getAttribute('data-score'));
    return Number.isFinite(n) ? n : null;
  };

  const track = (e: React.PointerEvent) => {
    const v = valueAt(e.clientX, e.clientY);
    if (v !== null && v !== current) commit(v);
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
      {/* The header line the pad picker used to share. A scored card keeps its
          pad, so this is the only thing saying the number is already in. */}
      <div className="flex items-center justify-between px-3.5 pt-3">
        <span aria-hidden className="disp text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint">
          {court}
        </span>
        {unscored ? null : (
          <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-accent">
            <Check size="sm" />
            Scored · tap to change
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
          onSelect={() => setSide('A')}
        />
        <Versus />
        <TeamSide
          players={teamB}
          names={names}
          colors={colors}
          score={scoreB}
          selected={side === 'B'}
          onSelect={() => setSide('B')}
        />
      </div>

      <div className="px-2 pb-3 pt-2.5">
        <div
          ref={gridRef}
          role="group"
          aria-label={`Score for ${drivingLabel}`}
          className="grid select-none grid-cols-8 gap-1"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={(e) => {
            // Capture so the drag keeps reporting to this element even once
            // the finger has travelled outside it.
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
          {Array.from({ length: max + 1 }, (_, n) => (
            <button
              key={n}
              type="button"
              data-score={n}
              aria-pressed={current === n}
              // Everything happens on the pointer handlers above; this keeps
              // the keyboard path working without double-committing a tap.
              onClick={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  commit(n);
                }
              }}
              className={`nums disp flex min-h-[46px] items-center justify-center rounded-[11px] border text-base font-bold ${cellTone(
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
              : 'Slide across, or tap a number'}
          </span>
        )}
        {scoring.mode === 'points' ? (
          <button
            type="button"
            onClick={() => setFreed((f) => !f)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[10.5px] font-medium text-ink-faint"
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
      </div>
    </div>
  );
}
