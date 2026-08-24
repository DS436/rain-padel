'use client';

import { useMemo } from 'react';
import type { Id, StandingRow, Tournament } from '@/lib/types';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Crown, isCrownTier } from '@/components/Crown';
import { shortGameLabel } from '@/lib/cycles';
import { knockoutStageOf } from '@/lib/knockout';

/**
 * The right-hand column on a big screen.
 *
 * The session view was built thumb-first and capped at `max-w-lg`, which is
 * right on a phone and absurd on the laptop that is usually sitting on the
 * bench next to the court — one narrow strip of app and 900 empty pixels
 * either side. This fills them with the two things people crane over the
 * organiser's shoulder to see: what just happened, and where that leaves the
 * table.
 *
 * Hidden below `xl`. It is extra, never the only place something appears.
 */

/** How many past games to list. Enough to cover the last round or two. */
const LOG_LIMIT = 14;

interface LogEntry {
  key: string;
  label: string;
  teamA: readonly [Id, Id];
  teamB: readonly [Id, Id];
  scoreA: number;
  scoreB: number;
  current: boolean;
}

function buildLog(t: Tournament): LogEntry[] {
  const out: LogEntry[] = [];

  // Newest first: the last thing entered is the thing being talked about.
  for (let i = t.rounds.length - 1; i >= 0 && out.length < LOG_LIMIT; i--) {
    const round = t.rounds[i]!;
    const stage = knockoutStageOf(t, i);
    for (const m of round.matches) {
      if (m.scoreA === null || m.scoreB === null) continue;
      out.push({
        key: m.id,
        label: stage
          ? (stage.labels[round.matches.indexOf(m)] ?? stage.name)
          // shortGameLabel handles the single-slate case itself now: "R5" for a
          // Mexicano round, "G5" for a ladder game, "R2 G1/3" inside a cycle.
          : `${shortGameLabel(t, i)} · C${m.courtIndex + 1}`,
        teamA: m.teamA,
        teamB: m.teamB,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        current: i === t.currentRound,
      });
    }
  }
  return out.slice(0, LOG_LIMIT);
}

export function SessionAside({
  tournament,
  rows,
  names,
  colors,
  onOpenRound,
}: {
  tournament: Tournament;
  rows: StandingRow[];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  /** Absent on the spectator view, where nothing is editable. */
  onOpenRound?: (index: number) => void;
}) {
  const log = useMemo(() => buildLog(tournament), [tournament]);
  const nameOf = (ids: readonly [Id, Id]) =>
    ids.map((id) => names.get(id) ?? 'Unknown').join(' · ');

  return (
    <aside className="hidden xl:flex xl:sticky xl:top-32 xl:h-fit xl:flex-col xl:gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Latest scores
          {log.length > 0 ? (
            <span className="nums font-normal normal-case tracking-normal">
              {log.length === LOG_LIMIT ? `last ${LOG_LIMIT}` : `${log.length} played`}
            </span>
          ) : null}
        </h2>

        {log.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-faint">
            Nothing scored yet. Games appear here as you enter them, newest first.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {log.map((e) => {
              const aWon = e.scoreA > e.scoreB;
              const drawn = e.scoreA === e.scoreB;
              const Row = (
                <>
                  <span className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-ink-faint">
                    {e.label}
                    {e.current ? <span className="text-accent">· now</span> : null}
                  </span>
                  <Side
                    label={nameOf(e.teamA)}
                    score={e.scoreA}
                    ids={e.teamA}
                    colors={colors}
                    names={names}
                    won={aWon}
                    drawn={drawn}
                  />
                  <Side
                    label={nameOf(e.teamB)}
                    score={e.scoreB}
                    ids={e.teamB}
                    colors={colors}
                    names={names}
                    won={!aWon && !drawn}
                    drawn={drawn}
                  />
                </>
              );
              const shell =
                'flex w-full flex-col rounded-xl border border-line bg-surface px-3 py-2 text-left';
              return (
                <li key={e.key}>
                  {onOpenRound ? (
                    <button
                      type="button"
                      onClick={() => onOpenRound(indexOfEntry(tournament, e.key))}
                      className={`${shell} transition-colors hover:border-accent/40 active:opacity-70`}
                    >
                      {Row}
                    </button>
                  ) : (
                    <div className={shell}>{Row}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {tournament.status === 'finished' ? 'Final table' : 'Table so far'}
        </h2>
        <ol className="flex flex-col gap-1">
          {rows.map((r) => (
            <li
              key={r.playerId}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${
                r.position <= 3 ? 'bg-surface' : 'bg-surface/50'
              }`}
            >
              <span className="flex w-5 justify-center">
                {isCrownTier(r.position) ? (
                  <Crown tier={r.position} className="h-4 w-4" />
                ) : (
                  <span className="nums text-xs text-ink-faint">{r.position}</span>
                )}
              </span>
              <PlayerAvatar
                name={names.get(r.playerId) ?? r.name}
                color={colors.get(r.playerId)}
                size="sm"
                dimmed={!r.active}
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  r.active ? 'text-ink' : 'text-ink-faint line-through'
                }`}
              >
                {names.get(r.playerId) ?? r.name}
              </span>
              <span className="nums text-base font-semibold text-accent">{r.points}</span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

/** Which round a logged match belongs to, for the tap-through. */
function indexOfEntry(t: Tournament, matchId: Id): number {
  return Math.max(
    0,
    t.rounds.findIndex((r) => r.matches.some((m) => m.id === matchId)),
  );
}

function Side({
  label,
  ids,
  names,
  colors,
  score,
  won,
  drawn,
}: {
  label: string;
  ids: readonly [Id, Id];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  score: number;
  won: boolean;
  drawn: boolean;
}) {
  return (
    <span className="flex items-center gap-2 py-0.5">
      <span className="flex shrink-0 -space-x-1">
        {ids.map((id) => (
          <PlayerAvatar key={id} name={names.get(id) ?? '?'} color={colors.get(id)} size="sm" />
        ))}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-xs ${won ? 'font-medium text-ink' : 'text-ink-dim'}`}
      >
        {label}
      </span>
      <span
        className={`nums shrink-0 text-sm font-semibold ${
          won ? 'text-accent' : drawn ? 'text-ink' : 'text-ink-dim'
        }`}
      >
        {score}
      </span>
    </span>
  );
}
