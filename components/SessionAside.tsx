'use client';

import { useMemo } from 'react';
import type { Id, StandingRow, Tournament } from '@/lib/types';
import { AvatarStack, PlayerAvatar } from '@/components/PlayerAvatar';
import { Group, GroupLabel } from '@/components/ui';
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
 *
 * Drawn in the same grouped-list language as the phone screens — a grey label
 * over a white card of hairline-split rows — so the laptop reads as the same
 * app with more room, not as a second dashboard bolted on beside it.
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
    ids.map((id) => names.get(id) ?? 'Unknown').join(' & ');
  // Same rule as the scoreboard: one tinted row, and only once there is a lead.
  const leader = rows[0] && rows[0].played > 0 ? rows[0].playerId : null;

  return (
    <aside className="hidden xl:sticky xl:top-32 xl:flex xl:h-fit xl:flex-col">
      <section>
        <GroupLabel
          className="!mt-0"
          aside={
            log.length > 0
              ? log.length === LOG_LIMIT
                ? `Last ${LOG_LIMIT}`
                : `${log.length} played`
              : undefined
          }
        >
          Latest scores
        </GroupLabel>

        {log.length === 0 ? (
          <p className="card px-4 py-3.5 text-sm text-ink-faint">
            Nothing scored yet. Games appear here as you enter them, newest first.
          </p>
        ) : (
          <Group as="ul">
            {log.map((e) => {
              const aWon = e.scoreA > e.scoreB;
              const drawn = e.scoreA === e.scoreB;
              const body = (
                <>
                  <span className="mb-1 flex items-center gap-1.5 text-xs text-ink-faint">
                    {e.label}
                    {e.current ? <span className="font-semibold text-accent-text">· now</span> : null}
                  </span>
                  <Side
                    label={nameOf(e.teamA)}
                    score={e.scoreA}
                    ids={e.teamA}
                    colors={colors}
                    names={names}
                    won={aWon}
                  />
                  <Side
                    label={nameOf(e.teamB)}
                    score={e.scoreB}
                    ids={e.teamB}
                    colors={colors}
                    names={names}
                    won={!aWon && !drawn}
                  />
                </>
              );
              const shell = 'flex w-full flex-col px-4 py-2.5 text-left';
              return (
                <li key={e.key}>
                  {onOpenRound ? (
                    <button
                      type="button"
                      onClick={() => onOpenRound(indexOfEntry(tournament, e.key))}
                      className={`${shell} hover:bg-surface-2/60 active:bg-surface-2`}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className={shell}>{body}</div>
                  )}
                </li>
              );
            })}
          </Group>
        )}
      </section>

      <section>
        <GroupLabel>{tournament.status === 'finished' ? 'Final table' : 'Table so far'}</GroupLabel>
        <Group as="ul">
          {rows.map((r) => {
            const lead = r.playerId === leader;
            return (
              <li
                key={r.playerId}
                className={`flex min-h-11 items-center gap-3 px-4 py-1.5 ${lead ? 'bg-accent-soft' : ''}`}
              >
                <span className="nums w-4 flex-none text-sm text-ink-faint">{r.position}</span>
                <PlayerAvatar
                  name={names.get(r.playerId) ?? r.name}
                  color={colors.get(r.playerId)}
                  size="sm"
                  dimmed={!r.active}
                />
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${lead ? 'font-semibold' : 'font-medium'} ${
                    r.active ? 'text-ink' : 'text-ink-faint line-through'
                  }`}
                >
                  {names.get(r.playerId) ?? r.name}
                </span>
                <span className="nums text-[15px] font-semibold">{r.points}</span>
              </li>
            );
          })}
        </Group>
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
}: {
  label: string;
  ids: readonly [Id, Id];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  score: number;
  won: boolean;
}) {
  return (
    <span className="flex items-center gap-2 py-0.5">
      <AvatarStack
        people={ids.map((id) => ({ name: names.get(id) ?? '?', color: colors.get(id) }))}
        size="xs"
      />
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${won ? 'font-medium text-ink' : 'text-ink-dim'}`}
      >
        {label}
      </span>
      <span className={`nums shrink-0 text-sm font-semibold ${won ? 'text-ink' : 'text-ink-dim'}`}>
        {score}
      </span>
    </span>
  );
}
