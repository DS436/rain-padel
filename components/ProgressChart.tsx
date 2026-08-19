'use client';

import { useMemo, useState } from 'react';
import type { Id } from '@/lib/types';
import type { Progression, PlayerSeries } from '@/lib/progression';

/**
 * The shape of the night.
 *
 * Cumulative points, one line per player, drawn in the avatar colours so the
 * chart and the table read as the same object. Tap a name to bring one line
 * forward — with eight players every line crossing every other line is
 * unreadable, and picking one out is the whole reason anybody looks at this.
 */

const W = 320;
const H = 168;
const PAD = { top: 12, right: 10, bottom: 20, left: 26 };

export function ProgressChart({
  progression,
  colors,
  onPickPlayer,
}: {
  progression: Progression;
  colors: Map<Id, string>;
  onPickPlayer?: (playerId: Id) => void;
}) {
  const [focus, setFocus] = useState<Id | null>(null);
  const { playedGames, series, peak } = progression;

  const paths = useMemo(
    () => series.map((s) => ({ s, d: pathFor(s, playedGames, peak) })),
    [series, playedGames, peak],
  );

  if (playedGames === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface/60 px-4 py-8 text-center">
        <p className="text-sm text-ink-dim">The graph draws itself as scores come in.</p>
      </section>
    );
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const gridSteps = 3;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Points as the night went
        </h3>
        <span className="nums text-xs text-ink-faint">
          {playedGames} game{playedGames === 1 ? '' : 's'}
        </span>
      </header>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full overflow-visible"
        role="img"
        aria-label="Cumulative points per player, game by game"
      >
        <defs>
          <linearGradient id="rp-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {Array.from({ length: gridSteps + 1 }, (_, i) => {
          const y = PAD.top + (innerH * i) / gridSteps;
          const value = Math.round((peak * (gridSteps - i)) / gridSteps);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--color-line)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 5}
                y={y + 3}
                textAnchor="end"
                fontSize="8"
                fill="var(--color-ink-faint)"
              >
                {value}
              </text>
            </g>
          );
        })}

        {playedGames > 1
          ? Array.from({ length: playedGames }, (_, g) => (
              <text
                key={g}
                x={PAD.left + (innerW * g) / (playedGames - 1)}
                y={H - 6}
                textAnchor="middle"
                fontSize="8"
                fill="var(--color-ink-faint)"
              >
                {g + 1}
              </text>
            ))
          : null}

        {/* leader's area wash, drawn first so every line sits on top of it */}
        {paths[0] && focus === null ? (
          <path
            d={`${areaFor(leaderOf(series), playedGames, peak)}`}
            fill="url(#rp-fade)"
            stroke="none"
          />
        ) : null}

        {paths.map(({ s, d }) => {
          const dim = focus !== null && focus !== s.playerId;
          return (
            <path
              key={s.playerId}
              d={d}
              fill="none"
              stroke={colors.get(s.playerId) ?? 'var(--color-ink-dim)'}
              strokeWidth={focus === s.playerId ? 2.6 : 1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={dim ? 0.15 : 1}
              className="transition-all duration-300"
            />
          );
        })}

        {series.map((s) => {
          const last = s.points[s.points.length - 1];
          if (!last) return null;
          const dim = focus !== null && focus !== s.playerId;
          return (
            <circle
              key={s.playerId}
              cx={xFor(s.points.length - 1, playedGames)}
              cy={yFor(last.total, peak)}
              r={focus === s.playerId ? 4 : 2.5}
              fill={colors.get(s.playerId) ?? 'var(--color-ink-dim)'}
              opacity={dim ? 0.15 : 1}
              className="transition-all duration-300"
            />
          );
        })}
      </svg>

      <ul className="flex flex-wrap gap-1.5">
        {series.map((s) => {
          const on = focus === s.playerId;
          const total = s.points[s.points.length - 1]?.total ?? 0;
          return (
            <li key={s.playerId}>
              <button
                type="button"
                onClick={() => {
                  if (on && onPickPlayer) onPickPlayer(s.playerId);
                  setFocus(on ? null : s.playerId);
                }}
                aria-pressed={on}
                className={`flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors ${
                  on ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-surface text-ink-dim'
                }`}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: colors.get(s.playerId) }}
                />
                {s.name}
                <span className="nums text-ink-faint">{total}</span>
                <Drift value={s.drift} />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-ink-faint">
        Tap a name to trace one line, tap it again to open their night.
      </p>
    </section>
  );
}

/** Places gained since halfway — the up/down everyone wants to see. */
export function Drift({ value }: { value: number }) {
  if (value === 0) return null;
  const up = value > 0;
  return (
    <span
      className={`nums inline-flex items-center gap-0.5 ${up ? 'text-accent' : 'text-danger'}`}
      title={up ? `Up ${value} since halfway` : `Down ${-value} since halfway`}
    >
      {up ? '▲' : '▼'}
      {Math.abs(value)}
    </span>
  );
}

function leaderOf(series: PlayerSeries[]): PlayerSeries {
  return series.reduce((best, s) =>
    (s.points[s.points.length - 1]?.total ?? 0) > (best.points[best.points.length - 1]?.total ?? 0)
      ? s
      : best,
  );
}

function xFor(i: number, games: number): number {
  const innerW = W - PAD.left - PAD.right;
  return games <= 1 ? PAD.left + innerW / 2 : PAD.left + (innerW * i) / (games - 1);
}

function yFor(value: number, peak: number): number {
  const innerH = H - PAD.top - PAD.bottom;
  return PAD.top + innerH - (innerH * value) / Math.max(1, peak);
}

function pathFor(s: PlayerSeries, games: number, peak: number): string {
  return s.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i, games).toFixed(1)} ${yFor(p.total, peak).toFixed(1)}`)
    .join(' ');
}

function areaFor(s: PlayerSeries, games: number, peak: number): string {
  if (s.points.length === 0) return '';
  const base = H - PAD.bottom;
  const line = pathFor(s, games, peak);
  return `${line} L${xFor(s.points.length - 1, games).toFixed(1)} ${base} L${xFor(0, games).toFixed(1)} ${base} Z`;
}
