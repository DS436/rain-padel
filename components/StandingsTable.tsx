'use client';

import { useMemo, useState } from 'react';
import type { Id, StandingRow } from '@/lib/types';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Crown, isCrownTier } from '@/components/Crown';

type SortKey = 'points' | 'wins';

/**
 * The scoreboard. Points stay the headline and the accent colour, because that
 * is what actually decides an Americano — W/D/L are context, not the ranking.
 * Sorting by wins is offered because people ask for it, but it never changes
 * what the format is scored on.
 */
export function StandingsTable({
  rows,
  names,
  colors,
  showLegend = true,
}: {
  rows: StandingRow[];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  showLegend?: boolean;
}) {
  const [sort, setSort] = useState<SortKey>('points');

  const ordered = useMemo(() => {
    if (sort === 'points') return rows;
    return [...rows].sort(
      (a, b) =>
        b.wins - a.wins ||
        b.draws - a.draws ||
        b.points - a.points ||
        a.position - b.position,
    );
  }, [rows, sort]);

  return (
    <div className="flex flex-col gap-4">
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
            return (
              <tr
                key={r.playerId}
                className={`${podium ? 'bg-surface' : 'bg-surface/60'} ${
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
        standing whichever way you sort.
      </p>
    </section>
  );
}
