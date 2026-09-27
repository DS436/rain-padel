'use client';

import { useMemo } from 'react';
import type { Id, StandingRow, Tournament } from '@/lib/types';
import { Sheet } from '@/components/Sheet';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Drift } from '@/components/Drift';
import { X } from '@/components/icons';
import { chemistry, type PlayerSeries } from '@/lib/progression';
import { ordinal } from '@/lib/awards';
import { teamOfPlayer } from '@/lib/standings';

/** Above this many games the partner faces no longer fit under the bars. */
const FACES_UP_TO = 12;

/**
 * One player's night, opened by tapping their row.
 *
 * The scoreboard is deliberately still. This is the one screen that moves,
 * because the movement carries the meaning: the bars grow from the baseline in
 * the order the games were played, so you watch the night happen rather than
 * read a table of it. A run of wins pulses the face; a run of losses is said
 * plainly in the line under the stats — there is no consolation copy, which
 * people see straight through.
 *
 * The cobalt list's version draws its own head (face, name, place and points,
 * a round close button) instead of the sheet's title, then three grey tiles,
 * the bars, and one tinted row: who this player scored best with. A bar is in
 * the accent when the game was at or above their own average and in the soft
 * tint when below — the question the bars answer is "which games carried the
 * night", and a win/loss colouring answered a different one the record line
 * already answers in words.
 */
export function PlayerSpotlight({
  tournament,
  row,
  series,
  names,
  colors,
  onClose,
}: {
  tournament: Tournament;
  row: StandingRow;
  series: PlayerSeries;
  names: Map<Id, string>;
  colors: Map<Id, string>;
  onClose: () => void;
}) {
  const name = names.get(row.playerId) ?? row.name;
  const { bestPartner, nemesis } = useMemo(() => chemistry(series), [series]);
  const team = tournament.mode === 'teams' ? teamOfPlayer(tournament, row.playerId) : null;

  const played = series.points.filter((p) => p.result !== 'rest');
  const rested = series.points.length - played.length;
  const best = Math.max(1, ...played.map((p) => p.scored ?? 0));
  const exactAverage = row.played === 0 ? 0 : row.points / row.played;
  const average = Math.round(exactAverage * 10) / 10;
  const diff = row.points - row.conceded;
  const hot = series.streak >= 2;
  const faces = series.points.length <= FACES_UP_TO;

  // The middle tile is the run they are on when there is one worth naming,
  // and the points difference otherwise — a "1 win in a row" tile says less
  // than the diff it would be standing in for.
  const runTile =
    series.streak >= 2
      ? { value: String(series.streak), label: 'wins in a row' }
      : series.streak <= -2
        ? { value: String(-series.streak), label: 'losses in a row' }
        : { value: diff > 0 ? `+${diff}` : String(diff), label: 'point difference' };

  const partner = bestPartner ? pairing(series, bestPartner) : null;
  const rival = nemesis ? rivalry(series, nemesis) : null;

  return (
    <Sheet title={name} onClose={onClose} hideTitle>
      <div className="flex flex-col pb-2">
        <header className="flex items-center gap-3.5">
          <span className={`relative flex-none rounded-full ${hot ? 'rp-pulse' : ''}`}>
            <PlayerAvatar name={name} color={colors.get(row.playerId)} size="xl" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xl font-semibold">{name}</span>
            <span className="nums flex items-center gap-1.5 text-sm text-ink-faint">
              <span className="truncate">
                {ordinal(row.position)} {tournament.status === 'finished' ? 'overall' : 'tonight'} ·{' '}
                {row.points} point{row.points === 1 ? '' : 's'}
              </span>
              <Drift value={series.drift} />
            </span>
            {team ? (
              <span className="truncate text-xs text-ink-faint">Playing as {team.name}</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 inline-flex h-11 w-11 flex-none items-center justify-center"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-dim">
              <X size="sm" />
            </span>
          </button>
        </header>

        <p className="mt-4 text-pretty text-[15px] leading-snug text-ink-dim">
          {headline(series, row)}
        </p>

        <section className="mt-4 grid grid-cols-3 gap-2">
          <Stat value={average.toFixed(1)} label="per game" />
          <Stat value={runTile.value} label={runTile.label} />
          <Stat value={String(row.played)} label={row.played === 1 ? 'game' : 'games'} />
        </section>

        {series.points.length > 0 ? (
          <section className="mt-5">
            <h3 className="mb-2.5 text-[13px] font-normal text-ink-faint">Game by game</h3>
            <ul className={`flex h-24 items-end ${series.points.length > 8 ? 'gap-1.5' : 'gap-2.5'}`}>
              {series.points.map((p, i) => {
                const resting = p.result === 'rest';
                const scored = p.scored ?? 0;
                // 72px is the tallest bar: the 96px row less the number over it.
                const height = resting ? 4 : Math.max(6, Math.round((scored / best) * 72));
                const strong = !resting && scored >= exactAverage;
                return (
                  <li key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span
                      className={`nums text-xs font-semibold ${resting ? 'text-ink-faint' : 'text-ink'}`}
                    >
                      {resting ? '–' : scored}
                    </span>
                    <span
                      className={`rp-grow block w-full rounded-md ${
                        resting ? 'bg-surface-2' : strong ? 'bg-accent' : 'bg-accent-soft'
                      }`}
                      style={{ height: `${height}px`, animationDelay: `${i * 55}ms` }}
                      title={
                        resting
                          ? `Game ${i + 1}: resting`
                          : `Game ${i + 1}: ${p.scored}–${p.conceded}${
                              p.partner ? ` with ${names.get(p.partner) ?? 'Unknown'}` : ''
                            }`
                      }
                    />
                  </li>
                );
              })}
            </ul>
            {faces ? (
              <ul
                aria-hidden
                className={`mt-1.5 flex ${series.points.length > 8 ? 'gap-1.5' : 'gap-2.5'}`}
              >
                {series.points.map((p, i) => (
                  <li key={i} className="flex min-w-0 flex-1 justify-center">
                    {p.partner ? (
                      <PlayerAvatar
                        name={names.get(p.partner) ?? '?'}
                        color={colors.get(p.partner)}
                        size="xs"
                      />
                    ) : (
                      <span className="h-5 w-5" />
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="nums mt-2.5 text-xs text-ink-faint">
              Won {row.wins} · drew {row.draws} · lost {row.losses}
              {rested > 0 ? ` · rested ${rested}` : ''}
            </p>
          </section>
        ) : null}

        {tournament.mode === 'individual' && partner && bestPartner ? (
          <div className="rp-rise mt-5 flex items-center gap-3 rounded-xl bg-accent-soft px-4 py-3.5">
            <PlayerAvatar
              name={names.get(bestPartner) ?? '?'}
              color={colors.get(bestPartner)}
              size="pick"
            />
            <span className="min-w-0 flex-1 truncate text-sm">
              Best alongside{' '}
              <span className="font-semibold">{names.get(bestPartner) ?? 'Unknown'}</span>
            </span>
            <span className="nums flex-none text-sm font-semibold text-accent-text">
              {partner.average.toFixed(1)} avg
            </span>
          </div>
        ) : null}

        {tournament.mode === 'individual' && rival && nemesis ? (
          <div className="rp-rise mt-2 flex items-center gap-3 px-4 py-2">
            <PlayerAvatar name={names.get(nemesis) ?? '?'} color={colors.get(nemesis)} size="pick" />
            <span className="min-w-0 flex-1 truncate text-sm">
              Toughest across the net{' '}
              <span className="font-semibold">{names.get(nemesis) ?? 'Unknown'}</span>
            </span>
            <span className="nums flex-none text-sm text-ink-faint">
              lost {rival.lost} of {rival.games}
            </span>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="nums text-[22px] font-semibold leading-tight">{value}</div>
      <div className="mt-0.5 text-xs text-ink-faint">{label}</div>
    </div>
  );
}

/** Points a game with this partner — the number the "best alongside" row quotes. */
function pairing(series: PlayerSeries, partnerId: Id): { average: number } | null {
  const games = series.points.filter((p) => p.partner === partnerId && p.scored !== null);
  if (games.length === 0) return null;
  return { average: games.reduce((a, p) => a + (p.scored ?? 0), 0) / games.length };
}

/** Games against this opponent, and how many of them were lost. */
function rivalry(series: PlayerSeries, opponentId: Id): { lost: number; games: number } | null {
  const games = series.points.filter((p) => p.opponents.includes(opponentId));
  if (games.length === 0) return null;
  return { lost: games.filter((p) => p.result === 'loss').length, games: games.length };
}

/** Say what actually happened. No participation trophies, no pile-on either. */
function headline(series: PlayerSeries, row: StandingRow): string {
  if (row.played === 0) return 'Yet to play a game.';
  if (series.streak >= 3) return `${series.streak} in a row. Nobody wants this court right now.`;
  if (series.streak === 2) return 'Two on the bounce.';
  if (series.streak <= -3) return `${-series.streak} losses on the trot. It turns.`;
  if (series.streak === -2) return 'Two tight ones gone the other way.';
  if (series.drift >= 2) return `Up ${series.drift} places since halfway.`;
  if (series.drift <= -2) return `Down ${-series.drift} places since halfway.`;
  if (row.position === 1) return 'Top of the table and holding.';
  return `${row.wins} won, ${row.losses} lost, ${row.points} banked.`;
}
