'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Tournament } from '@/lib/types';
import type { CareerStats, PlayerProfile } from '@/lib/players';
import { careerStats } from '@/lib/players';
import {
  leaderboard,
  MIN_NIGHTS_FOR_CROWN,
  recentNights,
  type BoardRow,
  type BoardSort,
} from '@/lib/dashboard';
import { getStore } from '@/lib/store/factory';
import { getPlayerStore } from '@/lib/store/playerStore';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Group, GroupLabel, ListRow, PageTitle, Segmented, TopBar } from '@/components/ui';
import { squadColors } from '@/components/PlayersView';

const SORTS: { value: BoardSort; label: string; unit: (n: number) => string }[] = [
  { value: 'average', label: 'Per game', unit: () => 'per game' },
  { value: 'titles', label: 'Wins', unit: (n) => (n === 1 ? 'win' : 'wins') },
  { value: 'sessions', label: 'Nights', unit: (n) => (n === 1 ? 'night' : 'nights') },
  { value: 'points', label: 'Points', unit: () => 'points' },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The number on the right of a row, in the column the board is ranked on. */
function figure(c: CareerStats, by: BoardSort): string {
  return by === 'average' ? c.average.toFixed(1) : c[by].toLocaleString('en-GB');
}

/**
 * The line under a name: the context for the number on the right, never the
 * number itself again.
 */
function contextLine(c: CareerStats, by: BoardSort): string {
  const nights = plural(c.sessions, 'night', 'nights');
  const games = plural(c.games, 'game', 'games');
  const perGame = `${c.average.toFixed(1)} per game`;
  switch (by) {
    case 'average':
      return c.titles > 0 ? `${nights} · ${plural(c.titles, 'win', 'wins')}` : nights;
    case 'titles':
      return `${nights} · ${plural(c.podiums, 'podium', 'podiums')}`;
    case 'sessions':
      return `${games} · ${perGame}`;
    case 'points':
      return `${nights} · ${perGame}`;
  }
}

/**
 * Results — the whole board behind the home screen's "Top of the board" card.
 *
 * The card names one person; this is everyone under them. It opens on per
 * game because that is what the card ranks on, and the top row here is the
 * card's person by construction (`currentLeader` reads it off the same
 * `leaderboard`). The other three columns are the totals the group argues
 * about — who has won most, who turns up most, whose pile is biggest.
 *
 * On per game, anyone short of the two-night minimum is listed under the
 * board rather than dropped from it: they have played, and a page that
 * silently leaves somebody off reads as a bug.
 */
export function ResultsView() {
  const [sessions, setSessions] = useState<Tournament[] | null>(null);
  const [squad, setSquad] = useState<PlayerProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [by, setBy] = useState<BoardSort>('average');

  useEffect(() => {
    let cancelled = false;
    Promise.all([getStore().listAll(), getPlayerStore().list()])
      .then(([all, people]) => {
        if (cancelled) return;
        setSessions(all);
        setSquad(people);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSessions((s) => s ?? []);
        setError(e instanceof Error ? e.message : 'Could not reach the database.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const all = useMemo(() => sessions ?? [], [sessions]);
  const careers = useMemo(() => careerStats(squad, all), [squad, all]);
  const board = useMemo(() => leaderboard(squad, careers, by), [squad, careers, by]);
  const colors = useMemo(() => squadColors(squad), [squad]);
  const nights = useMemo(() => recentNights(all).length, [all]);

  const loading = sessions === null;
  const sort = SORTS.find((s) => s.value === by)!;
  const empty = board.ranked.length === 0 && board.unranked.length === 0;

  return (
    <>
      <DevStoreBanner />
      <main className="mx-auto flex w-full max-w-lg flex-col pb-16">
        <TopBar back={{ href: '/sessions', label: 'Home' }} />
        <PageTitle
          sub={loading ? ' ' : `Across ${plural(nights, 'night', 'nights')}`}
        >
          Results
        </PageTitle>

        <div className="px-6 pt-5">
          {error ? <p className="mb-3 px-1 text-[13px] text-danger">{error}</p> : null}

          <Segmented options={SORTS} value={by} onChange={setBy} />

          {loading ? (
            <p className="mt-4 px-1 text-sm text-ink-faint">Loading…</p>
          ) : empty ? (
            <p className="card mt-4 px-5 py-6 text-center text-sm leading-relaxed text-ink-dim">
              Nobody on the board yet. Pick people from the squad when you set up a night and
              their results land here.
            </p>
          ) : (
            <>
              {board.ranked.length > 0 ? (
                <Group as="ul" className="mt-4">
                  {board.ranked.map((row) => (
                    <BoardLine
                      key={row.profileId}
                      row={row}
                      by={by}
                      unit={sort.unit}
                      color={colors.get(row.profileId)}
                    />
                  ))}
                </Group>
              ) : (
                <p className="mt-4 px-1 text-sm text-ink-faint">
                  Nobody has played {MIN_NIGHTS_FOR_CROWN} nights yet.
                </p>
              )}

              {board.unranked.length > 0 ? (
                <>
                  <GroupLabel>
                    Placed after {MIN_NIGHTS_FOR_CROWN} nights
                  </GroupLabel>
                  <Group as="ul">
                    {board.unranked.map((row) => (
                      <BoardLine
                        key={row.profileId}
                        row={row}
                        by={by}
                        unit={sort.unit}
                        color={colors.get(row.profileId)}
                      />
                    ))}
                  </Group>
                </>
              ) : null}
            </>
          )}

          {!loading && !empty ? (
            <p className="mt-4 px-1 text-[13px] leading-relaxed text-ink-faint">
              {by === 'average'
                ? 'Ranked on points per game, so turning up every week is not the same as winning. Wins are nights finished top.'
                : by === 'titles'
                  ? 'Wins are nights finished top of the table. Podiums are nights finished in the top three.'
                  : 'Everyone saved in the squad, counted across every night they were picked for.'}
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}

function BoardLine({
  row,
  by,
  unit,
  color,
}: {
  row: BoardRow;
  by: BoardSort;
  unit: (n: number) => string;
  color: string | undefined;
}) {
  const placed = row.position > 0;
  const top = row.position === 1;
  const value = row.stats[by];
  return (
    <li>
      <ListRow
        minH="min-h-[60px]"
        lead={
          <span className="flex items-center gap-3">
            <span
              className={`nums w-5 text-center text-sm ${
                top ? 'font-semibold text-accent-text' : 'text-ink-faint'
              }`}
            >
              {placed ? row.position : '–'}
            </span>
            <PlayerAvatar name={row.name} color={color} size="row" />
          </span>
        }
        title={row.name}
        sub={contextLine(row.stats, by)}
        trailing={
          <span className="flex-none text-right">
            {/* One blue number on the page, the leader's, as on the home card. */}
            <span
              className={`nums block text-[17px] font-semibold ${top ? 'text-accent-text' : ''}`}
            >
              {figure(row.stats, by)}
            </span>
            <span className="block text-xs text-ink-faint">{unit(value)}</span>
          </span>
        }
      />
    </li>
  );
}
