'use client';

import type { Id, Tournament } from '@/lib/types';
import { isRoundComplete } from '@/lib/history';

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

  return (
    <div className="flex flex-col gap-4">
      {tournament.format === 'mexicano' ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-dim">
          Mexicano pairs winners with winners, so the next round only exists once this one is
          scored. Rounds appear here as they are played.
        </p>
      ) : null}

      {tournament.rounds.map((round) => {
        const done = isRoundComplete(round);
        const isCurrent = round.index === tournament.currentRound;
        return (
          <section key={round.index} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onOpenRound(round.index)}
              className="flex items-center justify-between rounded-xl px-1 py-1 text-left active:opacity-70"
            >
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Round {round.index + 1}
                {isCurrent ? <span className="ml-2 text-accent">· now</span> : null}
              </h3>
              <span className="text-xs text-ink-faint">
                {done ? 'Edit scores' : isCurrent ? 'Open' : 'Upcoming'}
              </span>
            </button>

            <ul className="flex flex-col gap-2">
              {round.matches.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <span className="nums w-6 shrink-0 text-xs text-ink-faint">
                    C{m.courtIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate">{m.teamA.map(nameOf).join(' · ')}</span>
                    <span className="block truncate text-ink-dim">
                      {m.teamB.map(nameOf).join(' · ')}
                    </span>
                  </span>
                  <span className="nums shrink-0 text-right text-lg font-semibold">
                    {m.scoreA === null ? (
                      <span className="text-ink-faint">–</span>
                    ) : (
                      <>
                        {m.scoreA}
                        <span className="text-ink-faint"> – </span>
                        {m.scoreB}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {round.resting.length ? (
              <p className="px-1 text-xs text-ink-faint">
                Resting: {round.resting.map(nameOf).join(', ')}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
