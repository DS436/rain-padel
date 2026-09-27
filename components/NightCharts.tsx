'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import type { Id } from '@/lib/types';
import type { Progression, PlayerSeries } from '@/lib/progression';
import { ordinal } from '@/lib/awards';
import { Segmented } from '@/components/ui';

/**
 * The shape of the night, two ways.
 *
 * One chart could only ever answer one question, and there are two worth
 * asking between games:
 *
 *   RACE   cumulative points. Who is winning, and by how much.
 *   PLACES rank game by game. Who is CLIMBING — which is the question people
 *          actually shout at each other, and which the race chart hides,
 *          because two lines can be four points apart and six places apart.
 *
 * A third, "Steady", drew each player's worst-to-best band against their
 * average. It answered a question nobody asked mid-night — the consistency
 * numbers still exist and still decide an award at the end, which is where
 * that reading belongs. The redesign's mock drew a Steady tab again; it stays
 * out for the same reason it left.
 *
 * The cobalt list draws one line in colour and every other line in faint
 * grey. A chart of nine coloured lines was a legend-reading exercise; nine
 * grey lines and one blue one answers "how is Elena doing against the field"
 * at a glance. The coloured line starts on the leader and follows whoever is
 * tapped — in the chart or by name — and the focused person is shared across
 * both charts, so flicking between them follows the same player rather than
 * resetting. Tap the focused line again, or the name over the chart, and
 * their full night opens.
 */

type ChartKind = 'race' | 'places';

/** The mock's plot box: 312 wide, lines between y 12 and 140. */
const W = 312;
const TOP = 12;
const BOTTOM = 140;
const INNER = BOTTOM - TOP;
const VIEWBOX = `0 -6 ${W} 158`;

const CHARTS: { value: ChartKind; label: string; caption: string }[] = [
  { value: 'race', label: 'Race', caption: 'Points after each game' },
  { value: 'places', label: 'Places', caption: 'Place after each game' },
];

export function NightCharts({
  progression,
  leaderId,
  onPickPlayer,
}: {
  progression: Progression;
  /** Who the coloured line starts on — the top of the standings. */
  leaderId?: Id;
  onPickPlayer?: (playerId: Id) => void;
}) {
  const [kind, setKind] = useState<ChartKind>('race');
  const [picked, setPicked] = useState<Id | null>(null);
  const { playedGames, series } = progression;

  if (playedGames === 0 || series.length === 0) {
    return (
      <section className="card px-4 py-8 text-center">
        <p className="text-[13px] text-ink-faint">The graph draws itself as scores come in.</p>
      </section>
    );
  }

  // A picked player who has since been removed falls back to the leader.
  const focused =
    series.find((s) => s.playerId === picked) ??
    series.find((s) => s.playerId === leaderId) ??
    leaderOf(series);
  const last = focused.points[focused.points.length - 1];
  const chart = CHARTS.find((c) => c.value === kind)!;
  const places = series.length;

  // Every line as the chart's own y values, one per column, so drawing and
  // hit-testing a tap read the same numbers.
  const lines: { id: Id; ys: number[] }[] = series.map((s) => ({
    id: s.playerId,
    ys:
      kind === 'race'
        ? // the race starts from nothing, so one game is already a line
          [0, ...s.points.map((p) => p.total)].map((v) => yForValue(v, progression.peak))
        : s.points.map((p) => yForRank(p.rank || places, places)),
  }));
  const columns = kind === 'race' ? playedGames + 1 : playedGames;

  /**
   * A tap picks the nearest line in the nearest game. Lines lie on top of
   * each other all the time — level on points, level on place — so a tie goes
   * to whoever is already focused, which makes "tap it again to open" work
   * even where three lines overlap.
   */
  function onChartClick(e: MouseEvent<SVGSVGElement>) {
    // A keyboard press has no position; treat it as "open the focused one".
    if (e.detail === 0) {
      onPickPlayer?.(focused.playerId);
      return;
    }
    const ctm = e.currentTarget.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const col = Math.min(
      columns - 1,
      Math.max(0, Math.round(columns <= 1 ? 0 : (pt.x / W) * (columns - 1))),
    );
    let best: { id: Id; d: number } | null = null;
    for (const l of lines) {
      const y = l.ys[col];
      if (y === undefined) continue;
      const d = Math.abs(y - pt.y);
      if (!best || d < best.d - 0.5 || (Math.abs(d - best.d) <= 0.5 && l.id === focused.playerId)) {
        best = { id: l.id, d };
      }
    }
    if (!best) return;
    if (best.id === focused.playerId) onPickPlayer?.(best.id);
    else setPicked(best.id);
  }

  const focusedLine = lines.find((l) => l.id === focused.playerId);
  const endY = focusedLine?.ys[focusedLine.ys.length - 1];

  return (
    <section className="flex flex-col gap-3">
      <Segmented
        options={CHARTS.map(({ value, label }) => ({ value, label }))}
        value={kind}
        onChange={setKind}
      />

      <div className="card p-4">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-[13px] text-ink-faint">{chart.caption}</span>
          <button
            type="button"
            onClick={() => onPickPlayer?.(focused.playerId)}
            // 13px words, a 44px target: the margin pulls the box back into line
            className="-my-3 inline-block max-w-[60%] truncate py-3 text-[13px] font-semibold leading-5 text-accent-text"
          >
            {focused.name}{' '}
            {kind === 'race' ? (last?.total ?? 0) : last?.rank ? ordinal(last.rank) : '–'}
          </button>
        </div>

        <svg
          viewBox={VIEWBOX}
          height="150"
          className="block w-full cursor-pointer overflow-visible"
          role="img"
          aria-label={
            kind === 'race'
              ? `Running points per player, game by game. ${focused.name} highlighted.`
              : `Place after each game, per player. ${focused.name} highlighted.`
          }
          onClick={onChartClick}
        >
          {[0, 1, 2].map((i) => {
            // the mock's three rules, 46 apart from the top of the plot
            const y = TOP + 46 * i;
            return (
              <line
                key={i}
                x1={0}
                x2={W}
                y1={y}
                y2={y}
                strokeWidth={1}
                style={{ stroke: 'var(--color-line)' }}
              />
            );
          })}

          {/* the field first, in grey, so the one coloured line sits on top */}
          {lines
            .filter((l) => l.id !== focused.playerId)
            .map((l) => (
              <polyline
                key={l.id}
                points={pointsOf(l.ys)}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: 'var(--color-ink-faint)', strokeWidth: 1.5, opacity: 0.4 }}
              />
            ))}

          {focusedLine ? (
            <>
              <polyline
                points={pointsOf(focusedLine.ys)}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: 'var(--color-accent)', strokeWidth: 2.5 }}
              />
              {endY !== undefined ? (
                <circle
                  cx={xFor(focusedLine.ys.length - 1, focusedLine.ys.length)}
                  cy={endY}
                  r={4}
                  style={{ fill: 'var(--color-accent)' }}
                />
              ) : null}
            </>
          ) : null}
        </svg>
      </div>
    </section>
  );
}

/* ------------------------------- shared ------------------------------- */

function pointsOf(ys: number[]): string {
  return ys.map((y, i) => `${xFor(i, ys.length).toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function leaderOf(series: PlayerSeries[]): PlayerSeries {
  return series.reduce((best, s) =>
    (s.points[s.points.length - 1]?.total ?? 0) > (best.points[best.points.length - 1]?.total ?? 0)
      ? s
      : best,
  );
}

function xFor(i: number, count: number): number {
  return count <= 1 ? W / 2 : (W * i) / (count - 1);
}

function yForValue(value: number, peak: number): number {
  return BOTTOM - (INNER * value) / Math.max(1, peak);
}

/**
 * A bump chart's y: first place pinned to the top line, last to the bottom.
 * Ranks are integers over a small range, so lines land exactly on top of each
 * other whenever two players are level — the grey field reads as a band, and
 * the one coloured line is still findable inside it.
 */
function yForRank(rank: number, places: number): number {
  return places <= 1 ? TOP + INNER / 2 : TOP + (INNER * (rank - 1)) / (places - 1);
}
