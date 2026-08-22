'use client';

import { useEffect, useRef, useState } from 'react';
import type { Scoring } from '@/lib/types';

/**
 * Score entry (spec 8.3). This is the interaction repeated forty times a night,
 * so it is worth the code.
 *
 * Three ways in, because the right one depends on the score and the moment:
 *   - TAP    every legal number laid out at once. 14 is one touch, not
 *            fourteen — this is the default and the reason the old ± nudge
 *            buttons are gone.
 *   - SLIDE  the drag control, kept for scanning a whole race at speed.
 *   - TYPE   a keyboard, for the score nobody wants to hunt for on a grid.
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
 * against, so the grid runs to `FREE_MAX` and the keyboard covers the rest.
 */

export type EntryMode = 'tap' | 'slide' | 'type';

/** How far the tap grid runs when no target bounds it (time scoring). */
const FREE_MAX = 16;

export function ScoreStepper({
  scoring,
  scoreA,
  scoreB,
  onChange,
  labelA,
  labelB,
  entryMode,
  onEntryMode,
}: {
  scoring: Scoring;
  scoreA: number | null;
  scoreB: number | null;
  onChange: (a: number | null, b: number | null) => void;
  labelA: string;
  labelB: string;
  /** Controlled from LiveView so picking "type" once applies to every court. */
  entryMode?: EntryMode;
  onEntryMode?: (m: EntryMode) => void;
}) {
  const [side, setSide] = useState<'A' | 'B'>('A');
  const [freed, setFreed] = useState(false);
  const [ownMode, setOwnMode] = useState<EntryMode>('tap');

  const mode = entryMode ?? ownMode;
  const setMode = onEntryMode ?? setOwnMode;

  const linked = scoring.mode === 'points' && !freed;
  const target = scoring.mode === 'points' ? scoring.target : 0;
  // The grid and the slider need an upper bound. In points mode it is the
  // target — that is the whole point of the request. In time mode there is no
  // target, so the grid is a convenience and typing is the escape hatch.
  const max = scoring.mode === 'points' ? target : FREE_MAX;
  const unscored = scoreA === null || scoreB === null;

  // An untouched card must never read as a scored draw, so the slider sits at
  // the midpoint while the numbers still show em-dashes.
  const current = side === 'A' ? scoreA : scoreB;
  const driven = current ?? (linked ? Math.round(target / 2) : 0);

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

      <EntryModePicker value={mode} onChange={setMode} />

      {mode === 'tap' ? (
        <NumberGrid
          max={max}
          value={current}
          onPick={commit}
          label={`Score for ${side === 'A' ? labelA : labelB}`}
        />
      ) : mode === 'slide' ? (
        <input
          type="range"
          className="score-range"
          min={0}
          max={max}
          step={1}
          value={Math.min(max, driven)}
          aria-label={`Score for ${side === 'A' ? labelA : labelB}`}
          onChange={(e) => commit(Number(e.target.value))}
          // Touching the track commits the value under the thumb even when it
          // does not move. Without this an untouched card cannot be scored as
          // a draw by dragging to the middle — the slider already sits at
          // target/2, so no change event ever fires, and 12-12 is exactly the
          // result someone would try to enter that way.
          onPointerDown={() => {
            if (current === null) commit(driven);
          }}
        />
      ) : (
        <div className="flex items-center justify-center gap-3">
          <TypedScore
            value={scoreA}
            max={linked ? target : undefined}
            label={`Score for ${labelA}`}
            onFocus={() => setSide('A')}
            onCommit={(v) => (linked ? onChange(v, target - v) : onChange(v, scoreB ?? 0))}
          />
          <span aria-hidden className="text-ink-faint">
            –
          </span>
          <TypedScore
            value={scoreB}
            max={linked ? target : undefined}
            label={`Score for ${labelB}`}
            onFocus={() => setSide('B')}
            onCommit={(v) => (linked ? onChange(target - v, v) : onChange(scoreA ?? 0, v))}
          />
        </div>
      )}

      <div className="flex min-h-6 items-center justify-between gap-3 text-xs">
        {mismatched ? (
          <span className="nums text-warn">
            Total {total}, target {target} — saved anyway
          </span>
        ) : (
          <span className="truncate text-ink-faint">
            Entering for {side === 'A' ? labelA : labelB}
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

/* --------------------------------------------------------------------- */

function EntryModePicker({
  value,
  onChange,
}: {
  value: EntryMode;
  onChange: (m: EntryMode) => void;
}) {
  const options: { value: EntryMode; label: string }[] = [
    { value: 'tap', label: 'Tap' },
    { value: 'slide', label: 'Slide' },
    { value: 'type', label: 'Type' },
  ];

  return (
    <div role="tablist" aria-label="How to enter the score" className="flex gap-1 self-center">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-lg px-3 text-xs font-medium transition-colors ${
            value === o.value ? 'bg-surface-2 text-ink' : 'text-ink-faint'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Every legal score, laid out at once.
 *
 * Eight to a row keeps a 24-point race to four rows on a phone and a 32-point
 * one to five, which is the difference between a grid you read and a grid you
 * scroll. The cells are square rather than 44px tall for the same reason —
 * a 25-cell grid at full tap height pushes the second court off the screen.
 */
function NumberGrid({
  max,
  value,
  onPick,
  label,
}: {
  max: number;
  value: number | null;
  onPick: (v: number) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-8 gap-1">
      {Array.from({ length: max + 1 }, (_, n) => {
        const on = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            aria-pressed={on}
            className={`nums flex aspect-square min-h-10 items-center justify-center rounded-lg border text-base tabular-nums transition-colors ${
              on
                ? 'border-accent bg-accent text-accent-ink font-semibold'
                : 'border-line bg-surface-2 text-ink active:bg-surface'
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The keyboard route.
 *
 * Kept as local text rather than driven straight from the prop, because
 * committing on every keystroke makes "1" then "4" pass through a saved 1 —
 * which in linked mode instantly rewrites the other side to target − 1. The
 * value commits on blur and on Enter, and the prop wins again once it settles.
 */
function TypedScore({
  value,
  max,
  label,
  onFocus,
  onCommit,
}: {
  value: number | null;
  max?: number;
  label: string;
  onFocus: () => void;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setDraft(null);
  }, [value]);

  const shown = draft ?? (value === null ? '' : String(value));

  const commit = () => {
    editing.current = false;
    const n = Number(draft);
    setDraft(null);
    if (draft === null || draft.trim() === '' || !Number.isFinite(n)) return;
    const clamped = Math.max(0, Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.round(n)));
    onCommit(clamped);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      value={shown}
      aria-label={label}
      placeholder="–"
      onFocus={() => {
        editing.current = true;
        onFocus();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className="nums min-h-12 w-24 rounded-xl border border-line bg-ground text-center text-3xl font-semibold tabular-nums text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
    />
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
