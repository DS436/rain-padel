'use client';

import { useMemo, useState } from 'react';
import type { Id, StandingRow, Tournament } from '@/lib/types';
import { AvatarStack, PlayerAvatar } from '@/components/PlayerAvatar';
import { NightCharts } from '@/components/NightCharts';
import { PlayerSpotlight } from '@/components/PlayerSpotlight';
import { CrownIcon } from '@/components/icons';
import { Meta, SectionLabel, Sparkline } from '@/components/ui';
import { buildProgression, type PlayerSeries } from '@/lib/progression';
import { computeTeamStandings } from '@/lib/standings';

/** How many games the sparkline shows. Six is what fits in 44px. */
const FORM_GAMES = 6;

/** The last few games a player actually appeared in, newest last. */
function form(series: PlayerSeries | undefined): (number | null)[] {
  if (!series) return [];
  return series.points.slice(-FORM_GAMES).map((g) => g.scored);
}

type SortKey = 'points' | 'wins';

/**
 * The scoreboard. Points stay the headline and the accent colour, because that
 * is what actually decides an Americano — W/D/L are context, not the ranking.
 * Sorting by wins is offered because people ask for it, but it never changes
 * what the format is scored on.
 *
 * Every row is a button: the table answers who is winning, and tapping through
 * to the spotlight answers how, which is the question that actually gets asked
 * out loud between games.
 */
export function StandingsTable({
  tournament,
  rows,
  names,
  colors,
  showLegend = true,
  showChart = true,
}: {
  tournament: Tournament;
  rows: StandingRow[];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  showLegend?: boolean;
  showChart?: boolean;
}) {
  const [sort, setSort] = useState<SortKey>('points');
  const [open, setOpen] = useState<Id | null>(null);

  const progression = useMemo(() => buildProgression(tournament), [tournament]);
  const seriesById = useMemo(
    () => new Map(progression.series.map((s) => [s.playerId, s] as const)),
    [progression],
  );
  const teamRows = useMemo(
    () => (tournament.mode === 'teams' ? computeTeamStandings(tournament) : []),
    [tournament],
  );

  const ordered = useMemo(() => {
    if (sort === 'points') return rows;
    return [...rows].sort(
      (a, b) => b.wins - a.wins || b.draws - a.draws || b.points - a.points || a.position - b.position,
    );
  }, [rows, sort]);

  // Bars are scaled against the race target, so a 16-point night and a
  // 32-point night do not both render as full-height bars.
  const scale = useMemo(
    () =>
      tournament.scoring.mode === 'points'
        ? tournament.scoring.target
        : Math.max(1, ...progression.series.flatMap((s) => s.points.map((g) => g.scored ?? 0))),
    [tournament.scoring, progression],
  );

  const openRow = open ? rows.find((r) => r.playerId === open) : null;
  const openSeries = open ? seriesById.get(open) : null;

  return (
    <div className="flex flex-col gap-4">
      {showChart ? (
        <NightCharts
          progression={progression}
          colors={colors}
          onPickPlayer={(id) => setOpen(id)}
        />
      ) : null}

      {tournament.mode === 'teams' ? (
        <section className="flex flex-col gap-1.5">
          <SectionLabel className="text-[9.5px]">Teams</SectionLabel>
          <ul>
            {teamRows.map((t) => (
              <li key={t.teamId}>
                <button
                  type="button"
                  onClick={() => setOpen(t.players[0])}
                  className={`flex min-h-12 w-full items-center gap-2.5 border-t border-line-soft px-1 py-2.5 text-left active:opacity-70 ${
                    t.position <= 3 ? 'bg-accent/[0.035]' : ''
                  }`}
                >
                  <span
                    className={`nums disp w-4 flex-none text-center text-[13px] font-bold ${
                      t.position <= 3 ? 'text-accent' : 'text-ink-faint'
                    }`}
                  >
                    {t.position}
                  </span>
                  <AvatarStack
                    people={t.players.map((id) => ({
                      name: names.get(id) ?? '?',
                      color: colors.get(id),
                    }))}
                    size="xs"
                    ring="var(--color-ground)"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span
                      className={`truncate text-[13.5px] font-medium ${
                        t.active ? 'text-ink' : 'text-ink-faint line-through'
                      }`}
                    >
                      {t.name}
                    </span>
                    <Meta>
                      {t.wins}W {t.draws}D {t.losses}L
                    </Meta>
                  </span>
                  <span className="nums disp w-[34px] flex-none text-right text-xl font-bold text-accent">
                    {t.points}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* The board itself. One row per player: rank, face, the record as a
          line of mono under the name, six bars of form, and the number that
          decides it all — no column headers to read across, because a phone
          row is not a spreadsheet row. */}
      <div>
        <div className="flex items-center justify-between pb-1.5">
          <SectionLabel className="text-[9.5px]">Player</SectionLabel>
          <span className="flex items-center gap-[15px]">
            <SectionLabel className="text-[9.5px]">Form</SectionLabel>
            <button
              type="button"
              onClick={() => setSort((k) => (k === 'points' ? 'wins' : 'points'))}
              title={sort === 'points' ? 'Sort by wins' : 'Sort by points'}
              aria-label={sort === 'points' ? 'Sorted by points — sort by wins' : 'Sorted by wins — sort by points'}
              className="disp w-[34px] text-right text-[9.5px] font-bold uppercase tracking-[0.18em] text-accent"
            >
              {sort === 'points' ? 'Pts' : 'Wins'}
            </button>
          </span>
        </div>

        <ul>
          {ordered.map((r) => {
            // Rank and crown always come from the canonical points standing,
            // never from the row's position on screen. A crown is a medal, and
            // the medal is decided on points — sorting by wins reorders the
            // list but must not hand bronze to someone who did not earn it.
            const rank = r.position;
            const podium = rank <= 3;
            const diff = r.points - r.conceded;
            const series = seriesById.get(r.playerId);
            return (
              <li key={r.playerId}>
                <button
                  type="button"
                  onClick={() => setOpen(r.playerId)}
                  className={`flex min-h-12 w-full items-center gap-2.5 border-t border-line-soft px-1 py-2.5 text-left active:opacity-70 ${
                    podium ? 'bg-accent/[0.035]' : ''
                  }`}
                >
                  <span
                    className={`nums disp w-4 flex-none text-center text-[13px] font-bold ${
                      podium ? 'text-accent' : 'text-ink-faint'
                    }`}
                  >
                    {rank}
                  </span>

                  <PlayerAvatar
                    name={names.get(r.playerId) ?? r.name}
                    color={colors.get(r.playerId)}
                    size="sm"
                    dimmed={!r.active}
                    className="!h-7 !w-7 !text-[11px]"
                  />

                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`truncate text-[13.5px] font-medium ${
                          r.active ? 'text-ink' : 'text-ink-faint line-through'
                        }`}
                      >
                        {names.get(r.playerId) ?? r.name}
                      </span>
                      {rank === 1 && r.played > 0 ? (
                        <CrownIcon className="h-3 w-3 flex-none" />
                      ) : null}
                    </span>
                    <Meta>
                      {r.played === 0
                        ? 'yet to play'
                        : `${r.wins}W ${r.draws}D ${r.losses}L · ${diff > 0 ? `+${diff}` : diff}`}
                    </Meta>
                  </span>

                  <Sparkline
                    values={form(series)}
                    max={scale}
                    hot={podium}
                    className="w-11 flex-none"
                  />

                  <span
                    className={`nums disp w-[34px] flex-none text-right text-xl font-bold ${
                      podium ? 'text-accent' : 'text-ink-dim'
                    }`}
                  >
                    {sort === 'points' ? r.points : r.wins}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {showLegend ? <Legend /> : null}

      {openRow && openSeries ? (
        <PlayerSpotlight
          tournament={tournament}
          row={openRow}
          series={openSeries}
          names={names}
          colors={colors}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}



/**
 * The one thing the table cannot say for itself.
 *
 * The chip glossary that used to live here is gone: the record now reads
 * "5W 0D 1L · +24" on the row itself, which needs no key. What is left is the
 * rule people genuinely get wrong — that this is scored on points, not wins.
 */
function Legend() {
  return (
    <p className="text-[11px] leading-relaxed text-ink-faint">
      Ranked on points, not wins — losing 11–13 still banks 11. The crown follows the points
      standing whichever way you sort. Tap anyone to see their night.
    </p>
  );
}
