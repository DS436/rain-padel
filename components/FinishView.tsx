'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Id, StandingRow, Tournament } from '@/lib/types';
import { StandingsTable } from '@/components/StandingsTable';
import { PlayerSpotlight } from '@/components/PlayerSpotlight';
import { AvatarStack, PlayerAvatar } from '@/components/PlayerAvatar';
import { BracketView } from '@/components/BracketView';
import { Meta, Rail, SectionLabel } from '@/components/ui';
import {
  Activity,
  Copy,
  CrownIcon,
  Equal,
  Flame,
  Grid,
  RotateCcw,
  Share,
  TrendingDown,
  TrendingUp,
  Zap,
} from '@/components/icons';
import { champion, podiumPairs } from '@/lib/knockout';
import { buildProgression } from '@/lib/progression';
import { finishLines, shareText, superlatives, type Superlative } from '@/lib/awards';
import { rematchQuery, resultsCsv } from '@/lib/format';
import { counterNoun, gamesPerRound } from '@/lib/cycles';

/**
 * The last screen of the night, and the one that gets read out loud.
 *
 * The redesign gives it a headline: one card with the winner's face, their
 * name at 27px and the three places that bracket the night — the runner-up,
 * third, and whoever came last, because the bottom of the table is a running
 * joke worth putting on the screen. Under it the awards scroll sideways, then
 * the final table, then every way out of the session in one block.
 */
export function FinishView({
  tournament,
  rows,
  names,
  colors,
  onReopen,
  onPlayAnother,
  onShare,
}: {
  tournament: Tournament;
  rows: StandingRow[];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  /**
   * All three are absent on the read-only spectator view: a viewer can copy the
   * results and export them, but reopening the night is the organiser's call.
   */
  onReopen?: () => void;
  onPlayAnother?: () => void;
  onShare?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<Id | null>(null);

  const progression = useMemo(() => buildProgression(tournament), [tournament]);
  const lines = useMemo(
    () => finishLines(tournament, rows, progression),
    [tournament, rows, progression],
  );
  const awards = useMemo(
    () => superlatives(tournament, rows, progression),
    [tournament, rows, progression],
  );
  const seriesById = useMemo(
    () => new Map(progression.series.map((s) => [s.playerId, s] as const)),
    [progression],
  );

  const winner = rows[0];
  const perRound = gamesPerRound(tournament);
  // When a bracket was played, the final decided the night — the points table
  // becomes the qualifying table it always was, and stays below.
  const champions = useMemo(() => champion(tournament), [tournament]);
  const bracketPodium = useMemo(() => podiumPairs(tournament), [tournament]);

  // The three places worth quoting next to the winner's: second, third, last.
  const bookends = useMemo(() => {
    const picks = [rows[1], rows[2], rows.length > 3 ? rows[rows.length - 1] : undefined];
    return picks.filter((r): r is StandingRow => Boolean(r));
  }, [rows]);

  async function copy() {
    const text = shareText(tournament, rows, progression);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy the results:', text);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function downloadCsv() {
    const blob = new Blob([resultsCsv(tournament)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament.name.replace(/[^\w-]+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const openRow = open ? rows.find((r) => r.playerId === open) : null;
  const openSeries = open ? seriesById.get(open) : null;

  const played = new Date(tournament.createdAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------ hero ------------------------------ */}
      {champions || winner ? (
        <header className="overflow-hidden rounded-[22px] border border-accent/30 bg-gradient-to-b from-accent/[0.16] to-accent/[0.02]">
          <div className="px-4 pb-4 pt-4 text-center">
            <p className="disp text-[9.5px] font-bold uppercase tracking-[0.2em] text-accent">
              {tournament.name} · {played}
            </p>

            {champions ? (
              <>
                <span className="my-3 inline-flex">
                  <AvatarStack
                    people={champions.players.map((id) => ({
                      name: names.get(id) ?? '?',
                      color: colors.get(id),
                    }))}
                    size="md"
                    ring="var(--color-ground)"
                  />
                </span>
                <h2 className="disp text-pretty text-[27px] font-bold leading-[1.05] tracking-[-0.025em]">
                  {champions.name} take the title
                </h2>
                <p className="nums disp mt-1.5 text-sm font-semibold text-accent">
                  Seeded {champions.seed} · won the final
                </p>
              </>
            ) : winner ? (
              <>
                <span className="relative my-3 inline-flex">
                  <PlayerAvatar
                    name={names.get(winner.playerId) ?? winner.name}
                    color={colors.get(winner.playerId)}
                    size="xl"
                  />
                  <CrownIcon className="absolute -right-2 -top-2 h-5 w-5" />
                </span>
                <h2 className="disp text-pretty text-[27px] font-bold leading-[1.05] tracking-[-0.025em]">
                  {names.get(winner.playerId) ?? winner.name} wins
                </h2>
                <p className="nums disp mt-1.5 text-sm font-semibold text-accent">
                  {winner.points} pts · {winner.wins}W {winner.draws}D {winner.losses}L
                </p>
              </>
            ) : null}
          </div>

          {bookends.length > 0 ? (
            <div className="flex border-t border-accent/[0.18]">
              {bookends.map((r) => (
                <span
                  key={r.playerId}
                  className="flex-1 border-r border-accent/[0.18] px-1.5 py-2.5 text-center last:border-r-0"
                >
                  <span className="nums disp block text-base font-bold">{r.points}</span>
                  <span className="block truncate text-[9.5px] font-medium text-ink-dim">
                    {r.position} · {names.get(r.playerId) ?? r.name}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </header>
      ) : null}

      {/* ----------------------------- bracket ---------------------------- */}
      {bracketPodium.length > 0 ? (
        <section className="flex flex-col gap-1.5">
          <SectionLabel className="text-[9.5px]">The finals</SectionLabel>
          <ol className="flex flex-col gap-1.5">
            {bracketPodium.map(({ place, pair }) => (
              <li
                key={pair.seed}
                className={`flex min-h-12 items-center gap-2.5 rounded-[14px] border px-3 py-2.5 ${
                  place === 1 ? 'border-accent/40 bg-accent/10' : 'border-line bg-surface'
                }`}
              >
                <span
                  className={`nums disp w-4 flex-none text-center text-[13px] font-bold ${
                    place <= 3 ? 'text-accent' : 'text-ink-faint'
                  }`}
                >
                  {place}
                </span>
                <AvatarStack
                  people={pair.players.map((id) => ({
                    name: names.get(id) ?? '?',
                    color: colors.get(id),
                  }))}
                  size="xs"
                  ring="var(--color-surface)"
                />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                  {pair.name}
                </span>
                {place === 1 ? <CrownIcon className="h-3.5 w-3.5 flex-none" /> : null}
              </li>
            ))}
          </ol>
          <details className="rounded-2xl border border-line bg-surface px-3.5 py-2.5">
            <summary className="cursor-pointer text-[13px] text-ink-dim">The whole bracket</summary>
            <div className="pt-3.5">
              <BracketView tournament={tournament} colors={colors} />
            </div>
          </details>
        </section>
      ) : null}

      {awards.length > 0 ? <Awards awards={awards} colors={colors} names={names} /> : null}

      <FinalBoard
        rows={rows}
        lines={lines}
        names={names}
        colors={colors}
        series={seriesById}
        onOpen={(id) => setOpen(id)}
        qualifying={champions !== null}
      />

      <details className="rounded-2xl border border-line bg-surface px-3.5 py-2.5">
        <summary className="cursor-pointer text-[13px] text-ink-dim">
          The full table and the graphs
        </summary>
        <div className="pt-3.5">
          <StandingsTable tournament={tournament} rows={rows} names={names} colors={colors} />
        </div>
      </details>

      {/* ----------------------------- actions ---------------------------- */}
      <div className="flex flex-col gap-[7px] pt-1">
        <div className="flex gap-[7px]">
          <button
            type="button"
            onClick={() => void copy()}
            className="disp inline-flex min-h-[50px] flex-1 items-center justify-center gap-[7px] rounded-[14px] bg-accent text-[14.5px] font-bold text-accent-ink transition-opacity active:opacity-80"
          >
            <Copy size="sm" />
            {copied ? 'Copied' : 'Copy results'}
          </button>
          {onShare ? (
            <button
              type="button"
              onClick={onShare}
              aria-label="Share a read-only link"
              className="inline-flex min-h-[50px] w-[52px] flex-none items-center justify-center rounded-[14px] border border-line bg-surface text-ink-dim"
            >
              <Share />
            </button>
          ) : null}
        </div>

        {onReopen ? (
          <Link
            href={`/new?${rematchQuery(tournament)}`}
            className="inline-flex min-h-12 items-center justify-center gap-[7px] rounded-[14px] border border-line bg-surface text-[13.5px] font-semibold text-ink"
          >
            <RotateCcw size="sm" />
            Run it back
          </Link>
        ) : null}

        <div className="flex flex-wrap justify-center gap-x-4 pt-0.5">
          <button
            type="button"
            onClick={downloadCsv}
            className="min-h-11 px-2 text-[11.5px] font-medium text-ink-faint"
          >
            CSV
          </button>
          {onPlayAnother ? (
            <button
              type="button"
              onClick={onPlayAnother}
              className="min-h-11 px-2 text-[11.5px] font-medium text-ink-faint"
            >
              Add {counterNoun(tournament).toLowerCase()}
              {perRound > 1 ? ` · ${perRound} games` : ''}
            </button>
          ) : null}
          {onReopen ? (
            <button
              type="button"
              onClick={onReopen}
              className="min-h-11 px-2 text-[11.5px] font-medium text-ink-faint"
            >
              Reopen
            </button>
          ) : null}
        </div>
      </div>

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
 * The standings, one row per place, each with the line that says what that
 * place actually means. Tapping opens the same night breakdown the scoreboard
 * opens, so this is a scoreboard you can read from across a table rather than
 * a second, different one.
 */
function FinalBoard({
  rows,
  lines,
  names,
  colors,
  series,
  onOpen,
  qualifying = false,
}: {
  rows: StandingRow[];
  lines: ReturnType<typeof finishLines>;
  names: Map<Id, string>;
  colors: Map<Id, string>;
  series: Map<Id, { drift: number }>;
  onOpen: (id: Id) => void;
  /** true when a bracket decided the night and this is the group table */
  qualifying?: boolean;
}) {
  const lineOf = new Map(lines.map((l) => [l.playerId, l] as const));

  return (
    <section>
      <SectionLabel className="mb-0.5 text-[9.5px]">
        {qualifying ? 'The table that seeded it' : 'Final table'}
      </SectionLabel>
      <ol>
        {rows.map((r) => {
          const line = lineOf.get(r.playerId);
          const drift = series.get(r.playerId)?.drift ?? 0;
          const diff = r.points - r.conceded;
          return (
            <li key={r.playerId}>
              <button
                type="button"
                onClick={() => onOpen(r.playerId)}
                className="flex min-h-12 w-full items-center gap-2.5 border-t border-line-soft py-2.5 text-left active:opacity-70"
              >
                <span
                  className={`nums disp w-[18px] flex-none text-center text-[15px] font-bold ${
                    r.position <= 3 ? 'text-accent' : 'text-ink-faint'
                  }`}
                >
                  {r.position}
                </span>

                <PlayerAvatar
                  name={names.get(r.playerId) ?? r.name}
                  color={colors.get(r.playerId)}
                  size="sm"
                  dimmed={!r.active}
                  className="!h-7 !w-7 !text-[11px]"
                />

                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="flex items-baseline gap-1.5">
                    <span className="disp truncate text-sm font-bold">
                      {names.get(r.playerId) ?? r.name}
                    </span>
                    {line?.badge ? (
                      <span className="flex-none rounded-full bg-accent/15 px-1.5 text-[9px] uppercase tracking-wider text-accent">
                        {line.badge}
                      </span>
                    ) : null}
                  </span>
                  <Meta>
                    {r.wins}W {r.draws}D {r.losses}L · {diff > 0 ? `+${diff}` : diff}
                  </Meta>
                </span>

                <span className="flex w-4 flex-none items-center justify-center">
                  {r.position === 1 ? (
                    <CrownIcon className="h-3.5 w-3.5" />
                  ) : drift >= 2 ? (
                    <TrendingUp size="sm" className="text-accent" />
                  ) : drift <= -2 ? (
                    <TrendingDown size="sm" className="text-ink-faint" />
                  ) : null}
                </span>

                <span className="nums disp w-[34px] flex-none text-right text-xl font-bold text-accent">
                  {r.points}
                </span>
              </button>
              {/* The sentence that names the place, kept for the podium and
                  for anyone with a badge — on ten rows it would be a wall. */}
              {line?.line && (r.position <= 3 || line.badge) ? (
                <p className="pb-2 pl-[50px] text-[11px] leading-snug text-ink-dim">{line.line}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="pt-2 text-[11px] leading-relaxed text-ink-faint">
        Ranked on points, not wins. Tap anyone to see their night.
      </p>
    </section>
  );
}

/**
 * The awards nobody plays for, as a rail you flick through.
 *
 * Every one is a number already on the board. The icons are the mock's — a
 * flat set at 15px in a tinted square — rather than the emoji the award data
 * carries, because eight different emoji faces at eight different weights is
 * the one place this screen used to stop looking like one design.
 */
const AWARD_ICONS: Record<string, React.ComponentType<{ size?: 'sm' | 'md' }>> = {
  metronome: Equal,
  rollercoaster: Activity,
  climber: TrendingUp,
  faller: TrendingDown,
  streak: Flame,
  hammer: Zap,
  wall: Grid,
};

function Awards({
  awards,
  colors,
  names,
}: {
  awards: Superlative[];
  colors: Map<Id, string>;
  names: Map<Id, string>;
}) {
  return (
    <section>
      <SectionLabel className="mb-2 text-[9.5px]">Awards</SectionLabel>
      <Rail className="snap-x snap-mandatory">
        {awards.map((a, i) => {
          const Icon = AWARD_ICONS[a.key] ?? Zap;
          return (
            <div
              key={a.key}
              className="rp-rise flex w-[130px] flex-none snap-start flex-col gap-[7px] rounded-[14px] border border-line bg-surface p-2.5"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-accent/[0.11] text-accent">
                <Icon size="sm" />
              </span>
              <span className="disp text-[9px] font-bold uppercase leading-tight tracking-[0.14em] text-ink-faint">
                {a.title}
              </span>
              <span className="flex items-center gap-1.5">
                <PlayerAvatar
                  name={names.get(a.playerId) ?? a.name}
                  color={colors.get(a.playerId)}
                  size="xs"
                />
                <span className="truncate text-[12.5px] font-semibold">{a.name}</span>
              </span>
              <Meta className="text-accent">{a.detail}</Meta>
            </div>
          );
        })}
      </Rail>
    </section>
  );
}
