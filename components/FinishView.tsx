'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Id, StandingRow, Tournament } from '@/lib/types';
import { Button } from '@/components/ui';
import { StandingsTable } from '@/components/StandingsTable';
import { PlayerSpotlight } from '@/components/PlayerSpotlight';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Crown, isCrownTier } from '@/components/Crown';
import { buildProgression } from '@/lib/progression';
import { finishLines, shareText, superlatives, ordinal, type Superlative } from '@/lib/awards';
import { rematchQuery, resultsCsv } from '@/lib/format';
import { gamesPerRound } from '@/lib/cycles';

/**
 * The last screen of the night, and the one that gets read out loud.
 *
 * The scoreboard is already on the Standings tab, so repeating it here as a
 * table would be pointless. What this adds is the part people actually want at
 * the end: a line for every finishing place, the awards nobody plays for, and
 * every way out of the session in one place — copy it, export it, run it back,
 * play one more round, or go home.
 */
export function FinishView({
  tournament,
  rows,
  names,
  colors,
  onReopen,
  onPlayAnother,
}: {
  tournament: Tournament;
  rows: StandingRow[];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  onReopen: () => void;
  onPlayAnother: () => void;
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

  return (
    <div className="flex flex-col gap-6">
      {winner ? (
        <header className="flex flex-col items-center gap-1 pt-2 text-center">
          <span aria-hidden className="text-4xl">
            🏆
          </span>
          <h2 className="text-pretty text-2xl font-semibold leading-tight">
            {names.get(winner.playerId) ?? winner.name} wins the night
          </h2>
          <p className="nums text-sm text-ink-dim">
            {winner.points} points from {winner.played} game{winner.played === 1 ? '' : 's'}
          </p>
        </header>
      ) : null}

      <Podium rows={rows.slice(0, 3)} names={names} colors={colors} />

      {awards.length > 0 ? <Awards awards={awards} colors={colors} /> : null}

      <FinalBoard
        rows={rows}
        lines={lines}
        names={names}
        colors={colors}
        onOpen={(id) => setOpen(id)}
      />

      <details className="rounded-2xl border border-line bg-surface/60 p-4">
        <summary className="cursor-pointer text-sm text-ink-dim">
          The full table and the graphs
        </summary>
        <div className="pt-4">
          <StandingsTable tournament={tournament} rows={rows} names={names} colors={colors} />
        </div>
      </details>

      <div className="flex flex-col gap-2">
        <Button onClick={() => void copy()} className="w-full">
          {copied ? 'Copied' : 'Copy results'}
        </Button>
        <Button variant="ghost" onClick={downloadCsv} className="w-full">
          Download CSV
        </Button>
        <Button variant="ghost" onClick={onPlayAnother} className="w-full">
          Play another round{perRound > 1 ? ` (${perRound} more games)` : ''}
        </Button>
        <Link href={`/new?${rematchQuery(tournament)}`} className="block">
          <Button variant="ghost" className="w-full">
            New session, same {tournament.mode === 'teams' ? 'teams' : 'players'}
          </Button>
        </Link>
        <Link href="/" className="block">
          <Button variant="ghost" className="w-full">
            Finish and go home
          </Button>
        </Link>
        <button
          type="button"
          onClick={onReopen}
          className="min-h-11 text-sm text-ink-faint underline underline-offset-4"
        >
          Reopen to fix a score
        </button>
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
 * The standings at the size they deserve — one big row per place, each with the
 * line that says what that place actually means. Tapping opens the same night
 * breakdown the scoreboard opens, so this is a scoreboard you can read from
 * across a table rather than a second, different one.
 */
function FinalBoard({
  rows,
  lines,
  names,
  colors,
  onOpen,
}: {
  rows: StandingRow[];
  lines: ReturnType<typeof finishLines>;
  names: Map<Id, string>;
  colors: Map<Id, string>;
  onOpen: (id: Id) => void;
}) {
  const lineOf = new Map(lines.map((l) => [l.playerId, l] as const));

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        Final standings
      </h3>
      <ol className="flex flex-col gap-2">
        {rows.map((r) => {
          const line = lineOf.get(r.playerId);
          const podium = r.position <= 3;
          return (
            <li key={r.playerId}>
              <button
                type="button"
                onClick={() => onOpen(r.playerId)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-opacity active:opacity-70 ${
                  podium ? 'border-accent/30 bg-accent/[0.06]' : 'border-line bg-surface/60'
                }`}
              >
                <span className="flex w-9 shrink-0 flex-col items-center">
                  {isCrownTier(r.position) ? (
                    <Crown tier={r.position} className="h-6 w-6" />
                  ) : (
                    <span className="nums text-2xl font-semibold text-ink-faint">{r.position}</span>
                  )}
                </span>

                <PlayerAvatar
                  name={names.get(r.playerId) ?? r.name}
                  color={colors.get(r.playerId)}
                  dimmed={!r.active}
                />

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-lg font-semibold">
                      {names.get(r.playerId) ?? r.name}
                    </span>
                    {line?.badge ? (
                      <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                        {line.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-pretty text-xs leading-snug text-ink-dim">
                    {line?.line ?? `${ordinal(r.position)} on ${r.points} points.`}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end">
                  <span className="nums text-3xl font-semibold leading-none text-accent">
                    {r.points}
                  </span>
                  <span className="nums text-[10px] text-ink-faint">
                    {r.wins}W {r.draws}D {r.losses}L
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The awards nobody plays for. Every one is a number already on the board. */
function Awards({ awards, colors }: { awards: Superlative[]; colors: Map<Id, string> }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        Awards
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {awards.map((a, i) => (
          <li
            key={a.key}
            className="rp-rise flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span aria-hidden className="text-xl">
              {a.emoji}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[10px] uppercase tracking-wider text-ink-faint">{a.title}</span>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colors.get(a.playerId) }}
                />
                <span className="truncate text-sm font-medium">{a.name}</span>
              </span>
              <span className="nums truncate text-[11px] text-ink-faint">{a.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 2 – 1 – 3, the way a podium actually looks. */
function Podium({
  rows,
  names,
  colors,
}: {
  rows: StandingRow[];
  names: Map<Id, string>;
  colors: Map<Id, string>;
}) {
  if (!rows[0]) return null;

  const order = [rows[1], rows[0], rows[2]].filter(Boolean) as StandingRow[];
  const heights: Record<number, string> = { 1: 'h-24', 2: 'h-16', 3: 'h-12' };

  return (
    <ol className="flex w-full items-end justify-center gap-2">
      {order.map((r) => (
        <li key={r.playerId} className="flex w-24 flex-col items-center gap-2">
          <PlayerAvatar
            name={names.get(r.playerId) ?? r.name}
            color={colors.get(r.playerId)}
            size="lg"
          />
          <span className="max-w-full truncate text-sm text-ink-dim">
            {names.get(r.playerId) ?? r.name}
          </span>
          <div
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-t-xl border border-b-0 pt-2 ${
              heights[r.position] ?? 'h-12'
            } ${r.position === 1 ? 'border-accent/40 bg-accent/10' : 'border-line bg-surface-2'}`}
          >
            {isCrownTier(r.position) ? <Crown tier={r.position} className="h-6 w-6" /> : null}
            <span className="nums text-lg font-semibold">{r.points}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
