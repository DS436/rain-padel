'use client';

import { useMemo } from 'react';
import type { Id, StandingRow, Tournament } from '@/lib/types';
import { Sheet } from '@/components/Sheet';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Crown, isCrownTier } from '@/components/Crown';
import { Drift } from '@/components/Drift';
import { chemistry, type PlayerSeries } from '@/lib/progression';
import { teamOfPlayer } from '@/lib/standings';

/**
 * One player's night, opened by tapping their row.
 *
 * The scoreboard is deliberately still. This is the one screen that moves,
 * because the movement carries the meaning: the bars grow from the baseline in
 * the order the games were played, so you watch the night happen rather than
 * read a table of it. A run of wins gets a warm frame and a pulse; a run of
 * losses gets a cold one and says so plainly — there is no consolation copy,
 * which people see straight through.
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
  const best = Math.max(1, ...played.map((p) => p.scored ?? 0));
  const average = row.played === 0 ? 0 : Math.round((row.points / row.played) * 10) / 10;
  const diff = row.points - row.conceded;

  const hot = series.streak >= 2;
  const cold = series.streak <= -2;
  const tone = hot
    ? 'border-accent/40 bg-accent/10'
    : cold
      ? 'border-danger/30 bg-danger/5'
      : 'border-line bg-surface/60';

  return (
    <Sheet title={name} onClose={onClose}>
      <div className="flex flex-col gap-5 pb-2">
        <section className={`relative flex items-center gap-4 rounded-2xl border p-4 ${tone}`}>
          <span className={`relative rounded-full ${hot ? 'rp-pulse' : ''}`}>
            <PlayerAvatar name={name} color={colors.get(row.playerId)} size="lg" />
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-center gap-2">
              {isCrownTier(row.position) ? <Crown tier={row.position} className="h-5 w-5" /> : null}
              <span className="nums text-sm text-ink-dim">
                {ordinal(row.position)} of {tournament.players.length}
              </span>
              <Drift value={series.drift} />
            </span>
            <p className="text-pretty text-[15px] font-medium leading-snug">{headline(series, row)}</p>
            {team ? (
              <p className="truncate text-xs text-ink-faint">
                Playing as {team.name}
              </p>
            ) : null}
          </div>

          {hot ? (
            <span aria-hidden className="rp-spark absolute right-4 top-2 text-lg">
              🔥
            </span>
          ) : null}
        </section>

        <section className="grid grid-cols-3 gap-2">
          <Stat label="Points" value={String(row.points)} accent />
          <Stat label="Per game" value={average.toFixed(1)} />
          <Stat label="Diff" value={diff > 0 ? `+${diff}` : String(diff)} />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Game by game
          </h3>
          <ul className="flex h-28 items-stretch gap-1.5">
            {series.points.map((p, i) => {
              const resting = p.result === 'rest';
              const height = resting ? 6 : Math.max(8, ((p.scored ?? 0) / best) * 100);
              const fill = resting
                ? 'bg-surface-2'
                : p.result === 'win'
                  ? 'bg-accent'
                  : p.result === 'draw'
                    ? 'bg-ink-dim'
                    : 'bg-danger/70';
              return (
                <li key={i} className="flex h-full flex-1 flex-col items-center gap-1">
                  {/* the track is what gives the bar a height to be a
                      percentage OF — without it the bar collapses to nothing */}
                  <span className="flex min-h-0 w-full flex-1 items-end">
                    <span
                      className={`rp-grow w-full rounded-t-md ${fill}`}
                      style={{ height: `${height}%`, animationDelay: `${i * 55}ms` }}
                      title={
                        resting
                          ? `Game ${i + 1}: resting`
                          : `Game ${i + 1}: ${p.scored}–${p.conceded}`
                      }
                    />
                  </span>
                  <span className="nums text-[10px] text-ink-faint">
                    {resting ? '·' : p.scored}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-faint">
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-accent align-middle" />
              won {row.wins}
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-ink-dim align-middle" />
              drew {row.draws}
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-danger/70 align-middle" />
              lost {row.losses}
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-surface-2 align-middle" />
              rested {series.points.length - played.length}
            </span>
          </p>
        </section>

        {tournament.mode === 'individual' && (bestPartner || nemesis) ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Who it went well with
            </h3>
            <div className="flex flex-col gap-2">
              {bestPartner ? (
                <Relation
                  label="Best alongside"
                  playerId={bestPartner}
                  names={names}
                  colors={colors}
                />
              ) : null}
              {nemesis ? (
                <Relation label="Toughest across the net" playerId={nemesis} names={names} colors={colors} />
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </Sheet>
  );
}

function Relation({
  label,
  playerId,
  names,
  colors,
}: {
  label: string;
  playerId: Id;
  names: Map<Id, string>;
  colors: Map<Id, string>;
}) {
  const name = names.get(playerId) ?? 'Unknown';
  return (
    <div className="rp-rise flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <PlayerAvatar name={name} color={colors.get(playerId)} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{name}</span>
        <span className="text-xs text-ink-faint">{label}</span>
      </span>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded-xl border px-3 py-3 ${
        accent ? 'border-accent/30 bg-accent/10' : 'border-line bg-surface'
      }`}
    >
      <span className={`nums text-2xl font-semibold ${accent ? 'text-accent' : 'text-ink'}`}>
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</span>
    </div>
  );
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

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
