'use client';

import { useRef, useState } from 'react';
import type { Id, Scoring } from '@/lib/types';
import { TeamSide, Versus } from '@/components/TeamSide';

/**
 * Score entry. This is the interaction repeated forty times a night, so it is
 * worth the code.
 *
 * The two sides are side-by-side panels with their own number underneath, and
 * the pad below drives whichever one is lit. Nothing on the card is separable
 * from the people it belongs to — a thumb landing wrong used to hand the other
 * pair fourteen points in silence.
 *
 * The redesign gives the pad three shapes, because the right one depends on
 * the night:
 *
 *   Grid   — the eight-column block. Press and drag across it and the score
 *            follows your thumb, or press a number outright. The default,
 *            and the only one that shows the whole range at once.
 *   Tape   — one row, scrolled sideways, with the selected number blown up to
 *            68px. For a phone held one-handed, where a grid cell is a
 *            smaller target than a swipe along a rail.
 *   Winner — pick who won, then pick the scoreline. Two taps, no arithmetic,
 *            for the organiser who is being told "we won 11-5" across a court.
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

type Pad = 'grid' | 'tape' | 'winner';

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
  const [pad, setPad] = useState<Pad>('grid');
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

  // Winner mode works by complementing against a target, so it is only offered
  // where one exists — a free or timed card has nothing to complement against.
  const padsAvailable: Pad[] = linked ? ['grid', 'tape', 'winner'] : ['grid', 'tape'];
  const activePad: Pad = padsAvailable.includes(pad) ? pad : 'grid';

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

  /** Winner mode: the number tapped is what the LOSING side got. */
  const commitLoser = (lose: number) => {
    const l = Math.max(0, Math.min(target - 1, lose));
    const win = target - l;
    if (side === 'A') onChange(win, l);
    else onChange(l, win);
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

  /** Grid and tape share their three states, so they share the class that says so. */
  const cellTone = (isCurrent: boolean, isMirror: boolean) =>
    isCurrent
      ? 'border-accent bg-accent text-accent-ink'
      : isMirror
        ? 'border-accent/45 bg-accent/[0.12] text-accent'
        : 'border-line bg-surface-2 text-ink';

  const isMirror = (n: number) => linked && !unscored && target - n === current && n !== current;

  return (
    <div className="flex flex-col">
      {/* Pad picker, on the card's header line */}
      <div className="flex items-center justify-between px-3.5 pt-3">
        <span aria-hidden className="disp text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint">
          {court}
        </span>
        <div className="flex gap-0.5 rounded-[9px] bg-surface-2 p-0.5">
          {padsAvailable.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPad(p)}
              aria-pressed={activePad === p}
              className={`min-h-11 rounded-[7px] px-3 text-[10.5px] font-semibold capitalize ${
                activePad === p ? 'bg-line text-ink' : 'text-ink-faint'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
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

      {activePad === 'grid' ? (
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
      ) : null}

      {activePad === 'tape' ? (
        <div className="pb-3 pt-2.5">
          <div
            role="group"
            aria-label={`Score for ${drivingLabel}`}
            className="scr flex items-center gap-1.5 overflow-x-auto px-3.5 pb-1"
          >
            {Array.from({ length: max + 1 }, (_, n) => {
              const on = current === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => commit(n)}
                  style={{
                    width: on ? 68 : 48,
                    height: on ? 68 : 54,
                    fontSize: on ? 28 : 18,
                  }}
                  className={`nums disp inline-flex flex-none items-center justify-center rounded-xl border font-bold transition-all ${cellTone(
                    on,
                    isMirror(n),
                  )}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {activePad === 'winner' ? (
        <div className="px-3.5 pb-3 pt-2.5">
          <div className="mb-2 flex gap-1.5">
            {(['A', 'B'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                aria-pressed={side === s}
                className={`min-h-11 flex-1 truncate rounded-xl border px-2 text-xs font-semibold ${
                  side === s
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-line bg-surface-2 text-ink'
                }`}
              >
                {nameOf(s === 'A' ? teamA : teamB)}
              </button>
            ))}
          </div>
          <p className="pb-2 text-center text-[11px] text-ink-faint">
            <span className="font-semibold text-accent">{drivingLabel}</span> won — tap the score
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: target }, (_, lose) => {
              const on = !unscored && Math.min(scoreA!, scoreB!) === lose;
              return (
                <button
                  key={lose}
                  type="button"
                  aria-pressed={on}
                  onClick={() => commitLoser(lose)}
                  className={`nums disp flex min-h-11 items-center justify-center rounded-[11px] border text-[15px] font-bold ${cellTone(
                    on,
                    false,
                  )}`}
                >
                  {target - lose}–{lose}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

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
