'use client';

import { useMemo, useState } from 'react';
import type { Id, StandingRow, Tournament } from '@/lib/types';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Crown, isCrownTier } from '@/components/Crown';
import { ProgressChart, Drift } from '@/components/ProgressChart';
import { PlayerSpotlight } from '@/components/PlayerSpotlight';
import { buildProgression } from '@/lib/progression';
import { computeTeamStandings } from '@/lib/standings';

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

  const openRow = open ? rows.find((r) => r.playerId === open) : null;
  const openSeries = open ? seriesById.get(open) : null;

  return (
    <div className="flex flex-col gap-4">
      {showChart ? (
        <ProgressChart
          progression={progression}
          colors={colors}
          onPickPlayer={(id) => setOpen(id)}
        />
      ) : null}

      {tournament.mode === 'teams' ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Teams</h3>
          <ul className="flex flex-col gap-1.5">
            {teamRows.map((t) => (
              <li key={t.teamId}>
                <button
                  type="button"
                  onClick={() => setOpen(t.players[0])}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:opacity-70 ${
                    t.position <= 3 ? 'bg-surface' : 'bg-surface/60'
                  }`}
                >
                  <span className="flex w-6 justify-center">
                    {isCrownTier(t.position) ? (
                      <Crown tier={t.position} />
                    ) : (
                      <span className="nums text-sm text-ink-faint">{t.position}</span>
                    )}
                  </span>
                  <span className="flex -space-x-1.5">
                    {t.players.map((id) => (
                      <PlayerAvatar
                        key={id}
                        name={names.get(id) ?? '?'}
                        color={colors.get(id)}
                        size="sm"
                        dimmed={!t.active}
                      />
                    ))}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`truncate text-[15px] ${t.active ? 'text-ink' : 'text-ink-faint line-through'}`}>
                      {t.name}
                    </span>
                    <span className="nums text-[11px] text-ink-faint">
                      {t.wins}W {t.draws}D {t.losses}L
                    </span>
                  </span>
                  <span className="nums text-xl font-semibold text-accent">{t.points}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <table className="w-full border-separate border-spacing-y-1.5">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-ink-faint">
            <th scope="col" className="w-9 pl-1 text-left font-medium">
              #
            </th>
            <th scope="col" className="pl-1 text-left font-medium">
              Players
            </th>
            <Th active={sort === 'wins'} onClick={() => setSort('wins')} title="Sort by wins">
              W
            </Th>
            <Th>D</Th>
            <Th>L</Th>
            <th scope="col" className="w-11 text-center font-medium">
              +/−
            </th>
            <Th active={sort === 'points'} onClick={() => setSort('points')} title="Sort by points">
              P
            </Th>
          </tr>
        </thead>

        <tbody>
          {ordered.map((r, i) => {
            // Rank and crown always come from the canonical points standing,
            // never from the row's position on screen. A crown is a medal, and
            // the medal is decided on points — sorting by wins reorders the
            // list but must not hand bronze to someone who did not earn it.
            const rank = r.position;
            const podium = rank <= 3;
            const diff = r.points - r.conceded;
            const series = seriesById.get(r.playerId);
            return (
              <tr
                key={r.playerId}
                onClick={() => setOpen(r.playerId)}
                className={`cursor-pointer active:opacity-70 ${podium ? 'bg-surface' : 'bg-surface/60'} ${
                  // the podium cut-off line only makes sense while the list is
                  // in podium order
                  sort === 'points' && i === 2 ? '[&>td]:border-b [&>td]:border-line' : ''
                }`}
              >
                <td className="w-9 rounded-l-xl py-2.5 pl-1">
                  <span className="flex items-center justify-center">
                    {isCrownTier(rank) ? (
                      <Crown tier={rank} />
                    ) : (
                      <span className="nums text-sm text-ink-faint">{rank}</span>
                    )}
                  </span>
                </td>

                <td className="py-2.5 pl-1">
                  <span className="flex items-center gap-2.5">
                    <PlayerAvatar
                      name={names.get(r.playerId) ?? r.name}
                      color={colors.get(r.playerId)}
                      dimmed={!r.active}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span
                        className={`truncate text-[15px] ${
                          r.active ? 'text-ink' : 'text-ink-faint line-through'
                        }`}
                      >
                        {names.get(r.playerId) ?? r.name}
                      </span>
                      {r.played === 0 ? (
                        <span className="text-[11px] text-ink-faint">yet to play</span>
                      ) : series ? (
                        <span className="flex items-center gap-1 text-[11px] text-ink-faint">
                          <Drift value={series.drift} />
                          {series.streak >= 2 ? `${series.streak} in a row` : null}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </td>

                <Td>{r.wins}</Td>
                <Td>{r.draws}</Td>
                <Td>{r.losses}</Td>
                <td className="nums w-11 text-center text-sm text-ink-dim">
                  {diff > 0 ? `+${diff}` : diff}
                </td>
                <td className="nums w-12 rounded-r-xl pr-2 text-right text-xl font-semibold text-accent">
                  {r.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

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

function Th({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <th scope="col" className="w-7 text-center font-medium">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          title={title}
          aria-pressed={active}
          className={`w-full py-1 ${active ? 'text-accent' : 'text-ink-faint'}`}
        >
          {children}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="nums w-7 text-center text-sm text-ink-dim">{children}</td>;
}

function Legend() {
  const items = [
    ['W', 'Win'],
    ['D', 'Draw'],
    ['L', 'Loss'],
    ['P', 'Points'],
  ] as const;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        Information
      </h3>
      <ul className="flex flex-wrap gap-2">
        {items.map(([k, v]) => (
          <li
            key={k}
            className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-xs text-ink-dim"
          >
            <span className="font-semibold text-ink">{k}</span>
            {v}
          </li>
        ))}
        <li className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-xs text-ink-dim">
          <span className="font-semibold text-ink">+/−</span>
          Points scored minus points conceded
        </li>
      </ul>
      <p className="text-xs text-ink-faint">
        Ranked on points, not wins — losing 11–13 still banks 11. Crowns follow the points
        standing whichever way you sort. Tap anyone to see their night.
      </p>
    </section>
  );
}
