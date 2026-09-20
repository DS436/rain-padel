'use client';

import type { Id, Round, Tournament } from '@/lib/types';
import { gamesPerRound, roundOfGame } from '@/lib/cycles';
import { formatSpec, isAdaptive } from '@/lib/formats';
import { Check } from '@/components/icons';
import { Meta, SectionLabel } from '@/components/ui';

/**
 * The whole night as a list of games, one row each.
 *
 * The redesign collapses each match to a single row — number, both pairs, the
 * score between them, and a mark on the right saying whether it is played,
 * playing or still to come. The old two-line-per-match layout was accurate and
 * took four screens to scroll; this is the thing you hand to somebody who
 * asks "when am I on?".
 *
 * The names are set at 14px, not the 12px everything else on a dense list
 * would take. This is the screen somebody holds up so four people can read it
 * off a bench, and a name nobody can read is the one thing the row cannot
 * afford to lose. They wrap to a second line rather than truncate for the same
 * reason — "Christopher · M…" tells the wrong person they are on next.
 */
export function ScheduleTab({
  tournament,
  names,
  onOpenRound,
}: {
  tournament: Tournament;
  names: Map<Id, string>;
  onOpenRound: (index: number) => void;
}) {
  const nameOf = (id: Id) => names.get(id) ?? 'Unknown';
  const perRound = gamesPerRound(tournament);

  // Games grouped into the rounds they belong to, so the tab mirrors the way
  // the header counts them. A group is a full cycle of the roster.
  const groups = tournament.rounds.reduce<Round[][]>((acc, round) => {
    const r = roundOfGame(round.index, perRound);
    (acc[r] ??= []).push(round);
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {isAdaptive(tournament.format) ? (
        <p className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-dim">
          {formatSpec(tournament.format).name} builds each game from the last one&rsquo;s result,
          so the next one only exists once this one is scored. Games appear here as they are
          played.
        </p>
      ) : null}

      {groups.map((games, r) => (
        <section key={r} className="flex flex-col gap-1.5">
          {perRound > 1 ? (
            <div className="flex items-baseline justify-between pt-1">
              <SectionLabel className="text-[9.5px]">Round {r + 1}</SectionLabel>
              <Meta>
                {games.length} of {perRound} game{perRound === 1 ? '' : 's'}
              </Meta>
            </div>
          ) : null}

          {games.map((round) => {
            const isNow = round.index === tournament.currentRound;

            return round.matches.map((m) => {
              const scored = m.scoreA !== null && m.scoreB !== null;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onOpenRound(round.index)}
                  aria-label={`${nameOf(m.teamA[0])} and ${nameOf(m.teamA[1])} against ${nameOf(
                    m.teamB[0],
                  )} and ${nameOf(m.teamB[1])}${
                    scored ? `, ${m.scoreA} to ${m.scoreB}` : isNow ? ', playing now' : ', to come'
                  }`}
                  className={`flex min-h-14 w-full items-center gap-2.5 rounded-[14px] border px-3 py-3 text-left active:opacity-70 ${
                    isNow ? 'border-accent/35 bg-accent/[0.06]' : 'border-line bg-surface'
                  }`}
                >
                  <span
                    className={`nums disp w-4 flex-none text-[13.5px] font-bold ${
                      isNow ? 'text-accent' : 'text-ink-faint'
                    }`}
                  >
                    {/* The court is what tells two simultaneous games apart;
                        the round number is already the row's context. */}
                    {perRound > 1 || tournament.courts > 1 ? m.courtIndex + 1 : round.index + 1}
                  </span>

                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className={`line-clamp-2 min-w-0 flex-1 text-[14px] font-medium leading-snug ${
                        scored ? 'text-ink' : 'text-ink-dim'
                      }`}
                    >
                      {m.teamA.map(nameOf).join(' · ')}
                    </span>
                    <span
                      className={`nums disp flex-none text-[15px] font-bold ${
                        scored ? 'text-ink' : isNow ? 'text-accent' : 'text-ink-faint'
                      }`}
                    >
                      {scored ? `${m.scoreA}–${m.scoreB}` : isNow ? 'live' : '–'}
                    </span>
                    <span
                      className={`line-clamp-2 min-w-0 flex-1 text-right text-[14px] font-medium leading-snug ${
                        scored ? 'text-ink' : 'text-ink-dim'
                      }`}
                    >
                      {m.teamB.map(nameOf).join(' · ')}
                    </span>
                  </span>

                  <span
                    className={`flex w-3.5 flex-none items-center justify-center ${
                      isNow ? 'text-accent' : 'text-ink-faint'
                    }`}
                  >
                    {scored ? (
                      <Check size="sm" />
                    ) : isNow ? (
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                    ) : null}
                  </span>
                </button>
              );
            });
          })}

          {games.some((g) => g.resting.length > 0) ? (
            <Meta className="px-1 !text-[11px]">
              Resting:{' '}
              {[...new Set(games.flatMap((g) => g.resting))].map(nameOf).join(', ')}
            </Meta>
          ) : null}
        </section>
      ))}
    </div>
  );
}
