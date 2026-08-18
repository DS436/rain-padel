'use client';

import { useState } from 'react';
import type { Scoring } from '@/lib/types';

/**
 * Score entry (spec 8.3). This is the interaction repeated forty times a night,
 * so it is worth the code.
 *
 * Points mode is LINKED: one value drives both sides, so the pair always sums
 * to the target and an invalid total is unreachable. Either number can be the
 * one you drive — tapping a side selects it. Forcing team A to be canonical
 * would double the mental load, because the organiser looks at the court and
 * thinks "the top pair got 14" or "the bottom pair got 10" with equal odds.
 *
 * Spec 9.6 wants an off-target total accepted for a match that stopped early,
 * which linked mode makes impossible — hence the "ended early" escape hatch to
 * FREE mode. Time mode is always free: there is no target to complement against.
 */
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

  const linked = scoring.mode === 'points' && !freed;
  const target = scoring.mode === 'points' ? scoring.target : 0;
  const unscored = scoreA === null || scoreB === null;

  // An untouched card must never read as a scored draw, so the slider sits at
  // the midpoint while the numbers still show em-dashes.
  const driven = unscored ? Math.round(target / 2) : side === 'A' ? scoreA : scoreB;

  const commitLinked = (raw: number) => {
    const v = Math.min(target, Math.max(0, Math.round(raw)));
    if (side === 'A') onChange(v, target - v);
    else onChange(target - v, v);
  };

  const total = (scoreA ?? 0) + (scoreB ?? 0);
  const mismatched = scoring.mode === 'points' && !unscored && total !== target;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-4">
        <ScoreFace
          value={scoreA}
          selected={linked && side === 'A'}
          selectable={linked}
          onSelect={() => setSide('A')}
          label={labelA}
        />
        <span aria-hidden className="text-2xl text-ink-faint">
          –
        </span>
        <ScoreFace
          value={scoreB}
          selected={linked && side === 'B'}
          selectable={linked}
          onSelect={() => setSide('B')}
          label={labelB}
        />
      </div>

      {linked ? (
        <div className="flex items-center gap-2">
          <NudgeButton label="−" onClick={() => commitLinked(driven - 1)} disabled={driven <= 0} />
          <input
            type="range"
            className="score-range flex-1"
            min={0}
            max={target}
            step={1}
            value={driven}
            aria-label={`Score for ${side === 'A' ? labelA : labelB}`}
            onChange={(e) => commitLinked(Number(e.target.value))}
            // Touching the track commits the value under the thumb even when it
            // does not move. Without this an untouched card cannot be scored as
            // a draw by dragging to the middle — the slider already sits at
            // target/2, so no change event ever fires, and 12-12 is exactly the
            // result someone would try to enter that way.
            onPointerDown={() => {
              if (unscored) commitLinked(driven);
            }}
          />
          <NudgeButton
            label="+"
            onClick={() => commitLinked(driven + 1)}
            disabled={driven >= target}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-6">
          <FreeStepper
            value={scoreA}
            onChange={(v) => onChange(v, scoreB ?? 0)}
            label={`Score for ${labelA}`}
          />
          <FreeStepper
            value={scoreB}
            onChange={(v) => onChange(scoreA ?? 0, v)}
            label={`Score for ${labelB}`}
          />
        </div>
      )}

      <div className="flex min-h-6 items-center justify-between gap-3 text-xs">
        {mismatched ? (
          <span className="nums text-warn">
            Total {total}, target {target} — saved anyway
          </span>
        ) : (
          <span />
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
  selectable,
  onSelect,
  label,
}: {
  value: number | null;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
  label: string;
}) {
  const content = (
    <span className="nums text-5xl font-semibold tabular-nums">
      {value === null ? <span className="text-ink-faint">–</span> : value}
    </span>
  );

  if (!selectable) {
    return <div className="flex min-w-20 justify-center px-3 py-1">{content}</div>;
  }

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
      {content}
    </button>
  );
}

function NudgeButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label === '−' ? 'One less' : 'One more'}
      className="min-h-11 min-w-11 rounded-xl border border-line bg-surface text-xl text-ink active:bg-surface-2 disabled:text-ink-faint"
    >
      {label}
    </button>
  );
}

function FreeStepper({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (v: number) => void;
  label: string;
}) {
  const v = value ?? 0;
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <NudgeButton label="−" onClick={() => onChange(Math.max(0, v - 1))} disabled={v <= 0} />
      <NudgeButton label="+" onClick={() => onChange(v + 1)} disabled={false} />
    </div>
  );
}
