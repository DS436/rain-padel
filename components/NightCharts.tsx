'use client';

import { useMemo, useState } from 'react';
import type { Id } from '@/lib/types';
import type { Progression, PlayerSeries, Spread } from '@/lib/progression';
import { spreads } from '@/lib/progression';
import { Drift } from '@/components/Drift';

/**
 * The shape of the night, three ways.
 *
 * One chart could only ever answer one question, and there are three worth
 * asking between games:
 *
 *   RACE   cumulative points. Who is winning, and by how much.
 *   PLACES rank game by game. Who is CLIMBING — which is the question people
 *          actually shout at each other, and which the race chart hides,
 *          because two lines can be four points apart and six places apart.
 *   STEADY every game a player scored, on one axis. Who turns up every time
 *          versus who wins one 21–3 and loses the rest.
 *
 * The focused player is shared state across all three, so tapping a name and
 * flicking between charts follows the same person rather than resetting. Tap a
 * focused name again and their full night opens.
 */

type ChartKind = 'race' | 'places' | 'steady';

const W = 320;
const H = 168;
const PAD = { top: 12, right: 10, bottom: 20, left: 26 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

const CHARTS: { value: ChartKind; label: string; caption: string }[] = [
  { value: 'race', label: 'Race', caption: 'Points as the night went.' },
  { value: 'places', label: 'Places', caption: 'Position after every game — higher is better.' },
  {
    value: 'steady',
    label: 'Steady',
    caption:
      'Average score, with the worst-to-best band behind it. A small swing is a reliable night; three games is the fewest that counts.',
  },
];

export function NightCharts({
  progression,
  colors,
  onPickPlayer,
}: {
  progression: Progression;
  colors: Map<Id, string>;
  onPickPlayer?: (playerId: Id) => void;
}) {
  const [kind, setKind] = useState<ChartKind>('race');
  const [focus, setFocus] = useState<Id | null>(null);
  const { playedGames, series } = progression;

  const rows = useMemo(() => spreads(progression), [progression]);

  if (playedGames === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface/60 px-4 py-8 text-center">
        <p className="text-sm text-ink-dim">The graphs draw themselves as scores come in.</p>
      </section>
    );
  }

  const chart = CHARTS.find((c) => c.value === kind)!;
  const colorOf = (id: Id) => colors.get(id) ?? 'var(--color-ink-dim)';

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-4">
      <header className="flex items-center justify-between gap-3">
        <div role="tablist" aria-label="Which graph" className="flex gap-1">
          {CHARTS.map((c) => (
            <button
              key={c.value}
              role="tab"
              type="button"
              aria-selected={kind === c.value}
              onClick={() => setKind(c.value)}
              className={`min-h-9 rounded-lg px-3 text-xs font-medium transition-colors ${
                kind === c.value ? 'bg-surface-2 text-ink' : 'text-ink-faint'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <span className="nums shrink-0 text-xs text-ink-faint">
          {playedGames} game{playedGames === 1 ? '' : 's'}
        </span>
      </header>

      {kind === 'race' ? (
        <RaceChart progression={progression} focus={focus} colorOf={colorOf} />
      ) : kind === 'places' ? (
        <PlacesChart progression={progression} focus={focus} colorOf={colorOf} />
      ) : (
        <SteadyChart rows={rows} focus={focus} colorOf={colorOf} onFocus={setFocus} />
      )}

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
        {chart.caption} Tap a name to trace one line, tap it again to open their night.
      </p>
    </section>
  );
}

/* -------------------------------- race -------------------------------- */

function RaceChart({
  progression,
  focus,
  colorOf,
}: {
  progression: Progression;
  focus: Id | null;
  colorOf: (id: Id) => string;
}) {
  const { playedGames, series, peak } = progression;
  const gridSteps = 3;

  return (
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
        const y = PAD.top + (INNER_H * i) / gridSteps;
        return (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" />
            <text x={PAD.left - 5} y={y + 3} textAnchor="end" fontSize="8" fill="var(--color-ink-faint)">
              {Math.round((peak * (gridSteps - i)) / gridSteps)}
            </text>
          </g>
        );
      })}

      <GameAxis playedGames={playedGames} />

      {/* leader's area wash, drawn first so every line sits on top of it */}
      {focus === null ? (
        <path d={areaFor(leaderOf(series), playedGames, peak)} fill="url(#rp-fade)" stroke="none" />
      ) : null}

      {series.map((s) => (
        <path
          key={s.playerId}
          d={s.points
            .map(
              (p, i) =>
                `${i === 0 ? 'M' : 'L'}${xFor(i, playedGames).toFixed(1)} ${yForValue(p.total, peak).toFixed(1)}`,
            )
            .join(' ')}
          fill="none"
          stroke={colorOf(s.playerId)}
          strokeWidth={focus === s.playerId ? 2.6 : 1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={dimmed(focus, s.playerId) ? 0.15 : 1}
          className="transition-all duration-300"
        />
      ))}

      {series.map((s) => {
        const last = s.points[s.points.length - 1];
        if (!last) return null;
        return (
          <circle
            key={s.playerId}
            cx={xFor(s.points.length - 1, playedGames)}
            cy={yForValue(last.total, peak)}
            r={focus === s.playerId ? 4 : 2.5}
            fill={colorOf(s.playerId)}
            opacity={dimmed(focus, s.playerId) ? 0.15 : 1}
            className="transition-all duration-300"
          />
        );
      })}
    </svg>
  );
}

/* ------------------------------- places ------------------------------- */

/**
 * A bump chart: rank on the y axis, first place pinned to the top.
 *
 * Ranks are integers over a small range, so lines land exactly on top of each
 * other whenever two players are level. The dots are what keep it readable —
 * they say "somebody is here" even where three lines overlap.
 */
function PlacesChart({
  progression,
  focus,
  colorOf,
}: {
  progression: Progression;
  focus: Id | null;
  colorOf: (id: Id) => string;
}) {
  const { playedGames, series } = progression;
  const places = Math.max(1, series.length);
  const yForRank = (rank: number) =>
    places <= 1 ? PAD.top + INNER_H / 2 : PAD.top + (INNER_H * (rank - 1)) / (places - 1);

  // Label the top, the bottom and (when there is room) the middle, rather than
  // every place — sixteen row labels on a phone is a grey smear.
  const ticks = places <= 6 ? Array.from({ length: places }, (_, i) => i + 1)
    : [1, Math.round((places + 1) / 2), places];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-44 w-full overflow-visible"
      role="img"
      aria-label="Finishing position after each game, per player"
    >
      {ticks.map((rank) => {
        const y = yForRank(rank);
        return (
          <g key={rank}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" />
            <text x={PAD.left - 5} y={y + 3} textAnchor="end" fontSize="8" fill="var(--color-ink-faint)">
              {rank}
            </text>
          </g>
        );
      })}

      <GameAxis playedGames={playedGames} />

      {series.map((s) => (
        <path
          key={s.playerId}
          d={s.points
            .map(
              (p, i) =>
                `${i === 0 ? 'M' : 'L'}${xFor(i, playedGames).toFixed(1)} ${yForRank(p.rank || places).toFixed(1)}`,
            )
            .join(' ')}
          fill="none"
          stroke={colorOf(s.playerId)}
          strokeWidth={focus === s.playerId ? 2.6 : 1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={dimmed(focus, s.playerId) ? 0.12 : 0.9}
          className="transition-all duration-300"
        />
      ))}

      {series.map((s) =>
        s.points.map((p, i) => (
          <circle
            key={`${s.playerId}-${i}`}
            cx={xFor(i, playedGames)}
            cy={yForRank(p.rank || places)}
            r={focus === s.playerId ? 3.4 : 2}
            fill={colorOf(s.playerId)}
            stroke="var(--color-ground)"
            strokeWidth="0.8"
            opacity={dimmed(focus, s.playerId) ? 0.12 : 1}
            className="transition-all duration-300"
          />
        )),
      )}
    </svg>
  );
}

/* ------------------------------- steady ------------------------------- */

/**
 * Who turns up every game.
 *
 * One row per player, steadiest at the top: the band is their worst-to-best
 * range and the filled marker is the average, so a short band means the score
 * barely moved all night. HTML rather than SVG because every row needs a name
 * next to it, and text in SVG cannot be truncated by the layout.
 */
function SteadyChart({
  rows,
  focus,
  colorOf,
  onFocus,
}: {
  rows: Spread[];
  focus: Id | null;
  colorOf: (id: Id) => string;
  onFocus: (id: Id | null) => void;
}) {
  const ceiling = Math.max(1, ...rows.map((r) => r.high));
  const pct = (v: number) => `${(v / ceiling) * 100}%`;

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-dim">Nobody has finished a game yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const on = focus === r.playerId;
        return (
          <li key={r.playerId}>
            <button
              type="button"
              onClick={() => onFocus(on ? null : r.playerId)}
              aria-pressed={on}
              className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors ${
                on ? 'bg-surface-2' : ''
              } ${focus !== null && !on ? 'opacity-40' : ''}`}
            >
              <span className="w-16 shrink-0 truncate text-xs text-ink-dim">{r.name}</span>

              <span className="relative h-5 min-w-0 flex-1 rounded-full bg-surface-2">
                {/* worst-to-best band */}
                <span
                  className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-45"
                  style={{
                    left: pct(r.low),
                    width: pct(Math.max(0.4, r.high - r.low)),
                    backgroundColor: colorOf(r.playerId),
                  }}
                />
                {/* the average */}
                <span
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{
                    left: pct(r.mean),
                    backgroundColor: colorOf(r.playerId),
                    borderColor: 'var(--color-ground)',
                  }}
                />
              </span>

              <span className="nums w-24 shrink-0 text-right text-[11px] leading-tight text-ink-faint">
                <span className="text-ink-dim">{r.mean}</span> avg
                <br />
                {r.rated
                  ? `±${r.deviation} swing`
                  : `only ${r.games} game${r.games === 1 ? '' : 's'}`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------- shared ------------------------------- */

function GameAxis({ playedGames }: { playedGames: number }) {
  if (playedGames <= 1) return null;
  // Above about a dozen games the labels collide, so thin them out evenly.
  const step = Math.ceil(playedGames / 12);
  return (
    <>
      {Array.from({ length: playedGames }, (_, g) =>
        g % step === 0 || g === playedGames - 1 ? (
          <text
            key={g}
            x={xFor(g, playedGames)}
            y={H - 6}
            textAnchor="middle"
            fontSize="8"
            fill="var(--color-ink-faint)"
          >
            {g + 1}
          </text>
        ) : null,
      )}
    </>
  );
}

function dimmed(focus: Id | null, id: Id): boolean {
  return focus !== null && focus !== id;
}

function leaderOf(series: PlayerSeries[]): PlayerSeries {
  return series.reduce((best, s) =>
    (s.points[s.points.length - 1]?.total ?? 0) > (best.points[best.points.length - 1]?.total ?? 0)
      ? s
      : best,
  );
}

function xFor(i: number, games: number): number {
  return games <= 1 ? PAD.left + INNER_W / 2 : PAD.left + (INNER_W * i) / (games - 1);
}

function yForValue(value: number, peak: number): number {
  return PAD.top + INNER_H - (INNER_H * value) / Math.max(1, peak);
}

function areaFor(s: PlayerSeries, games: number, peak: number): string {
  if (s.points.length === 0) return '';
  const base = H - PAD.bottom;
  const line = s.points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${xFor(i, games).toFixed(1)} ${yForValue(p.total, peak).toFixed(1)}`,
    )
    .join(' ');
  return `${line} L${xFor(s.points.length - 1, games).toFixed(1)} ${base} L${xFor(0, games).toFixed(1)} ${base} Z`;
}
