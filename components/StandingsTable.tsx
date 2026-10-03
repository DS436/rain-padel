'use client';

import { useMemo, useState } from 'react';
import type { Id, StandingRow, Tournament } from '@/lib/types';
import { AvatarStack, PlayerAvatar } from '@/components/PlayerAvatar';
import { NightCharts } from '@/components/NightCharts';
import { PlayerSpotlight } from '@/components/PlayerSpotlight';
import { Drift } from '@/components/Drift';
import { Group, GroupLabel } from '@/components/ui';
import { buildProgression, type PlayerSeries } from '@/lib/progression';
import { computeTeamStandings } from '@/lib/standings';

/**
 * Places gained since the previous game — the arrow on each row.
 *
 * Read off the progression's per-game ranks rather than the standings, because
 * the standings only know where everyone is now. Zero until there are two
 * scored games to compare, and zero for anyone who has not moved.
 */
function movement(series: PlayerSeries | undefined): number {
  if (!series || series.points.length < 2) return 0;
  const now = series.points[series.points.length - 1]!;
  const before = series.points[series.points.length - 2]!;
  if (!now.rank || !before.rank) return 0;
  return before.rank - now.rank;
}

/**
 * The scoreboard.
 *
 * A row is place, face, name, which way they moved since the last game, the
 * record — played, won, drew, lost — and points. The record came back after
 * the cobalt redesign dropped it: people read it off the results table, and
 * "one tap away in the spotlight" was one tap too many. Points stay the bold
 * number, because points are what decide an Americano; the form bars and the
 * sort-by-wins toggle stay gone.
 *
 * Only the leader's row is tinted. One tinted row per card is a redesign
 * rule, and a medal colour on the top three was three things competing to be
 * the headline.
 *
 * Every row is a button: the table answers who is winning, and tapping through
 * to the spotlight answers how, which is the question that actually gets asked
 * out loud between games. The chart does the same — tap a line to follow it,
 * tap it again to open that player.
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

  const openRow = open ? rows.find((r) => r.playerId === open) : null;
  const openSeries = open ? seriesById.get(open) : null;
  // The tint belongs to one row, and only once somebody has actually scored —
  // a first place on nil points is alphabetical order, not a lead.
  const leader = rows[0] && rows[0].played > 0 ? rows[0].playerId : null;

  return (
    <div className="flex flex-col gap-3">
      {showChart ? (
        <NightCharts
          progression={progression}
          leaderId={rows[0]?.playerId}
          onPickPlayer={(id) => setOpen(id)}
        />
      ) : null}

      {/* Fixed pairs: the pair is the unit that actually competes, so it gets
          its own table above the individual one. Both members always score
          the same, so a tap opens the first of them. */}
      {tournament.mode === 'teams' && teamRows.length > 0 ? (
        <section>
          <GroupLabel className="!mt-2">Pairs</GroupLabel>
          <Group as="ul">
            <Header />
            {teamRows.map((t, i) => (
              <li key={t.teamId}>
                <button
                  type="button"
                  onClick={() => setOpen(t.players[0])}
                  className={`flex min-h-12 w-full items-center gap-2 px-4 py-2 text-left active:bg-surface-2 ${
                    i === 0 && t.played > 0 ? 'bg-accent-soft' : ''
                  }`}
                >
                  <span className="nums w-4 flex-none text-sm text-ink-faint">{t.position}</span>
                  <AvatarStack
                    people={t.players.map((id) => ({
                      name: names.get(id) ?? '?',
                      color: colors.get(id),
                    }))}
                    size="sm"
                    ring={i === 0 && t.played > 0 ? 'var(--color-accent-soft)' : 'var(--color-surface)'}
                  />
                  <span
                    className={`min-w-0 flex-1 truncate text-[15px] ${
                      i === 0 && t.played > 0 ? 'font-semibold' : 'font-medium'
                    } ${t.active ? 'text-ink' : 'text-ink-faint line-through'}`}
                  >
                    {t.name}
                  </span>
                  <Record played={t.played} wins={t.wins} draws={t.draws} losses={t.losses} />
                  <span className="nums w-7 flex-none text-right text-base font-semibold">
                    {t.points}
                  </span>
                </button>
              </li>
            ))}
          </Group>
          <GroupLabel>Players</GroupLabel>
        </section>
      ) : null}

      <Group as="ul">
        <Header drift />
        {rows.map((r) => {
          const lead = r.playerId === leader;
          const name = names.get(r.playerId) ?? r.name;
          const moved = movement(seriesById.get(r.playerId));
          return (
            <li key={r.playerId}>
              <button
                type="button"
                onClick={() => setOpen(r.playerId)}
                aria-label={`${r.position}. ${name}, ${r.points} points, played ${r.played}, won ${r.wins}, drew ${r.draws}, lost ${r.losses}${
                  moved > 0 ? `, up ${moved}` : moved < 0 ? `, down ${-moved}` : ''
                }`}
                className={`flex min-h-12 w-full items-center gap-2 px-4 py-1.5 text-left active:bg-surface-2 ${
                  lead ? 'bg-accent-soft' : ''
                }`}
              >
                {/* Rank always comes from the canonical points standing, never
                    from the row's position on screen. */}
                <span className="nums w-4 flex-none text-sm text-ink-faint">{r.position}</span>
                <PlayerAvatar name={name} color={colors.get(r.playerId)} size="md" dimmed={!r.active} />
                <span
                  className={`min-w-0 flex-1 truncate text-[15px] ${lead ? 'font-semibold' : 'font-medium'} ${
                    r.active ? 'text-ink' : 'text-ink-faint line-through'
                  }`}
                >
                  {name}
                </span>
                <span className="w-6 flex-none">
                  <Drift value={moved} since="the last game" />
                </span>
                <Record played={r.played} wins={r.wins} draws={r.draws} losses={r.losses} />
                <span className="nums w-7 flex-none text-right text-base font-semibold">
                  {r.points}
                </span>
              </button>
            </li>
          );
        })}
      </Group>

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

const RECORD_CELL = 'nums w-5 text-center';

/**
 * Played, won, drew, lost — small and grey, so points stay the number the eye
 * lands on. Kept tight (one 20px cell each) so a name still fits on a phone.
 */
function Record({
  played,
  wins,
  draws,
  losses,
}: {
  played: number;
  wins: number;
  draws: number;
  losses: number;
}) {
  return (
    <span className="flex flex-none text-[13px] text-ink-dim" aria-hidden>
      <span className={RECORD_CELL}>{played}</span>
      <span className={RECORD_CELL}>{wins}</span>
      <span className={RECORD_CELL}>{draws}</span>
      <span className={RECORD_CELL}>{losses}</span>
    </span>
  );
}

/**
 * Column labels, right-aligned on the same cells as the rows beneath them. The
 * name side needs no label, so one spacer covers rank, face and name.
 */
function Header({ drift = false }: { drift?: boolean }) {
  return (
    <li
      aria-hidden
      className="flex items-center gap-2 px-4 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint"
    >
      <span className="flex-1" />
      {drift ? <span className="w-6 flex-none" /> : null}
      <span className="flex flex-none">
        <span className={RECORD_CELL}>P</span>
        <span className={RECORD_CELL}>W</span>
        <span className={RECORD_CELL}>D</span>
        <span className={RECORD_CELL}>L</span>
      </span>
      <span className="w-7 flex-none text-right">Pts</span>
    </li>
  );
}

/**
 * The one thing the table cannot say for itself: that this is scored on
 * points, not wins — the rule people genuinely get wrong.
 */
function Legend() {
  return (
    <p className="px-1 text-xs leading-relaxed text-ink-faint">
      Ranked on points, not wins — losing 11–13 still banks 11. Tap anyone to see their night.
    </p>
  );
}
