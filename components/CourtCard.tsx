'use client';

import type { Id, Match, Scoring } from '@/lib/types';
import { ScoreStepper } from '@/components/ScoreStepper';
import { PlayerAvatar } from '@/components/PlayerAvatar';

export function CourtCard({
  match,
  scoring,
  names,
  colors,
  onScore,
  readOnly = false,
}: {
  match: Match;
  scoring: Scoring;
  names: Map<Id, string>;
  colors: Map<Id, string>;
  onScore: (a: number | null, b: number | null) => void;
  readOnly?: boolean;
}) {
  const nameOf = (id: Id) => names.get(id) ?? 'Unknown';
  const teamA = match.teamA.map(nameOf).join('  ·  ');
  const teamB = match.teamB.map(nameOf).join('  ·  ');
  const scored = match.scoreA !== null && match.scoreB !== null;

  return (
    <article
      className={`rounded-2xl border bg-surface p-4 transition-colors ${
        scored ? 'border-line' : 'border-accent/30'
      }`}
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Court {match.courtIndex + 1}
        </h3>
        {scored ? <span className="text-xs text-accent">Scored</span> : null}
      </header>

      <TeamRow ids={match.teamA} names={names} colors={colors} />

      <div className="my-3">
        {readOnly ? (
          <p className="nums text-center text-5xl font-semibold">
            {match.scoreA ?? '–'} <span className="text-ink-faint">–</span> {match.scoreB ?? '–'}
          </p>
        ) : (
          <ScoreStepper
            scoring={scoring}
            scoreA={match.scoreA}
            scoreB={match.scoreB}
            onChange={onScore}
            labelA={teamA}
            labelB={teamB}
          />
        )}
      </div>

      <TeamRow ids={match.teamB} names={names} colors={colors} />
    </article>
  );
}

function TeamRow({
  ids,
  names,
  colors,
}: {
  ids: readonly [Id, Id];
  names: Map<Id, string>;
  colors: Map<Id, string>;
}) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      {ids.map((id) => (
        <span key={id} className="flex items-center gap-1.5">
          <PlayerAvatar name={names.get(id) ?? '?'} color={colors.get(id)} size="sm" />
          <span className="text-base font-medium">{names.get(id) ?? 'Unknown'}</span>
        </span>
      ))}
    </p>
  );
}
