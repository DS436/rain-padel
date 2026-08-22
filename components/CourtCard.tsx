'use client';

import type { Id, Match, Scoring } from '@/lib/types';
import { ScoreStepper } from '@/components/ScoreStepper';
import { TeamLine } from '@/components/TeamLine';

export function CourtCard({
  match,
  scoring,
  names,
  colors,
  onScore,
  readOnly = false,
  label,
}: {
  match: Match;
  scoring: Scoring;
  names: Map<Id, string>;
  colors: Map<Id, string>;
  onScore: (a: number | null, b: number | null) => void;
  readOnly?: boolean;
  /**
   * Overrides the court number. In a knockout the court a game is on is the
   * least interesting thing about it — "Semi-final 2" is what people call it.
   */
  label?: string;
}) {
  const scored = match.scoreA !== null && match.scoreB !== null;

  return (
    <article
      className={`rounded-2xl border bg-surface p-4 transition-colors ${
        scored ? 'border-line' : 'border-accent/30'
      }`}
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {label ?? `Court ${match.courtIndex + 1}`}
        </h3>
        {scored ? <span className="text-xs text-accent">Scored</span> : null}
      </header>

      {readOnly ? (
        // Same two rows, same reading order — a locked card and a live one
        // must not be two different layouts of the same information.
        <div className="flex flex-col gap-1.5">
          <TeamLine
            players={match.teamA}
            names={names}
            colors={colors}
            score={match.scoreA}
            won={scored && match.scoreA! > match.scoreB!}
          />
          <TeamLine
            players={match.teamB}
            names={names}
            colors={colors}
            score={match.scoreB}
            won={scored && match.scoreB! > match.scoreA!}
          />
        </div>
      ) : (
        <ScoreStepper
          scoring={scoring}
          scoreA={match.scoreA}
          scoreB={match.scoreB}
          onChange={onScore}
          teamA={match.teamA}
          teamB={match.teamB}
          names={names}
          colors={colors}
        />
      )}
    </article>
  );
}
