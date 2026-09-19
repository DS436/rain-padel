'use client';

import type { Id, Match, Scoring } from '@/lib/types';
import { ScoreStepper } from '@/components/ScoreStepper';
import { TeamSide, Versus } from '@/components/TeamSide';
import { Check } from '@/components/icons';

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
  const court = label ?? `Court ${match.courtIndex + 1}`;

  // A card that is done shrinks: the names and the result, nothing to press.
  // Only the court still in play carries the accent edge and the pad.
  if (readOnly || scored) {
    return (
      <article
        className={`overflow-hidden rounded-[20px] border bg-surface ${
          scored ? 'border-line' : 'border-accent/30'
        } px-3.5 py-3`}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="disp text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint">
            {court}
          </h3>
          {scored ? (
            <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-accent">
              <Check size="sm" />
              Scored
            </span>
          ) : null}
        </div>
        <div className="flex items-stretch gap-2">
          <TeamSide
            players={match.teamA}
            names={names}
            colors={colors}
            score={match.scoreA}
            won={scored && match.scoreA! > match.scoreB!}
            size="sm"
          />
          <Versus />
          <TeamSide
            players={match.teamB}
            names={names}
            colors={colors}
            score={match.scoreB}
            won={scored && match.scoreB! > match.scoreA!}
            size="sm"
          />
        </div>
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-[20px] border border-accent/30 bg-surface">
      {/* The court label lives inside ScoreStepper's header row so it shares a
          line with the pad picker — but a knockout's "Semi-final 2" has to win
          over the generic word, so it is announced here for screen readers and
          drawn there. */}
      <h3 className="sr-only">{court}</h3>
      <ScoreStepper
        scoring={scoring}
        scoreA={match.scoreA}
        scoreB={match.scoreB}
        onChange={onScore}
        teamA={match.teamA}
        teamB={match.teamB}
        names={names}
        colors={colors}
        court={court}
      />
    </article>
  );
}
