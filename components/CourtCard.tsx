'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Id, Match, Scoring } from '@/lib/types';
import { ScoreStepper, type Side } from '@/components/ScoreStepper';
import { TeamSide } from '@/components/TeamSide';
import { CourtHeading } from '@/components/SessionChrome';

/**
 * One court: a heading line ("Court 1 … remark") and a white card under it
 * with the two pairs stacked.
 *
 * The heading's remark is the card's one line of status, and it moves with
 * what you are doing: "Tap a pair to score" on a court nobody has touched,
 * nothing while the pad is open (the lit row already says "Scoring"),
 * "Scored" once both numbers are in. The owner can override it — the first
 * court carries the court-time fit, which used to be a banner of its own.
 */
export function CourtCard({
  match,
  scoring,
  names,
  colors,
  onScore,
  readOnly = false,
  label,
  remark,
  remarkTone = 'faint',
  onRemark,
  live = false,
  seedOf,
}: {
  match: Match;
  scoring: Scoring;
  names: Map<Id, string>;
  colors: Map<Id, string>;
  onScore: (a: number | null, b: number | null) => void;
  readOnly?: boolean;
  /**
   * What the game is, added to the court number. In a knockout the court a
   * game is on matters less than what it is — "Court 1 · Semi-final".
   */
  label?: string;
  /** Replaces the status remark — the court-time fit on the first court. */
  remark?: ReactNode;
  remarkTone?: 'faint' | 'warn' | 'danger';
  /** Makes the remark a button (the court-time fit opens the rounds sheet). */
  onRemark?: () => void;
  /** The bracket game on court right now gets an accent outline. */
  live?: boolean;
  /** A bracket game shows each pair's seed. */
  seedOf?: (ids: readonly [Id, Id]) => number | null;
}) {
  const [side, setSide] = useState<Side | null>(null);
  const scored = match.scoreA !== null && match.scoreB !== null;
  // "Semi-final 2" loses its number next to a court that already has one.
  const court = `Court ${match.courtIndex + 1}${label ? ` · ${label.replace(/ \d+$/, '')}` : ''}`;

  const status = readOnly
    ? scored
      ? 'Scored'
      : 'In play'
    : label
      ? scored
        ? 'Played'
        : 'On court'
      : side
        ? scored
          ? 'Scored'
          : null
        : scored
          ? 'Scored · tap to change'
          : 'Tap a pair to score';

  const heading =
    onRemark && remark ? (
      // A tappable remark cannot live inside CourtHeading's truncating span —
      // the clip would shrink its target to the height of the text — so this
      // one line is drawn here to the same measurements.
      <div className="mb-2.5 mt-5 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold">{court}</h3>
        <button
          type="button"
          onClick={onRemark}
          className={`nums -my-3 min-h-11 min-w-0 truncate py-3 text-right text-[13px] leading-5 active:opacity-60 ${TONE[remarkTone]}`}
        >
          {remark}
        </button>
      </div>
    ) : (
      <CourtHeading
        name={court}
        remark={remark ? <span className={TONE[remarkTone]}>{remark}</span> : (status ?? undefined)}
      />
    );

  const ring = live ? 'shadow-[var(--rp-shadow),inset_0_0_0_1.5px_var(--color-accent)]' : '';

  // Only a LOCKED card is a plain record. A card that has just been scored
  // keeps its rows tappable: the score is not final until the round is
  // advanced, and a mis-tap you cannot take back on the spot is worse than a
  // pad you have to ask for.
  if (readOnly) {
    const aWon = scored && match.scoreA! > match.scoreB!;
    const bWon = scored && match.scoreB! > match.scoreA!;
    return (
      <section>
        {heading}
        <article className={`card divide-y divide-line overflow-hidden ${ring}`}>
          <TeamSide
            players={match.teamA}
            names={names}
            colors={colors}
            score={match.scoreA}
            nameTone={bWon ? 'dim' : 'normal'}
            scoreTone={aWon ? 'ink' : 'faint'}
            seed={seedOf ? seedOf(match.teamA) : undefined}
          />
          <TeamSide
            players={match.teamB}
            names={names}
            colors={colors}
            score={match.scoreB}
            nameTone={aWon ? 'dim' : 'normal'}
            scoreTone={bWon ? 'ink' : 'faint'}
            seed={seedOf ? seedOf(match.teamB) : undefined}
          />
        </article>
      </section>
    );
  }

  return (
    <section>
      {heading}
      <article aria-label={court} className={`card overflow-hidden ${ring}`}>
        <ScoreStepper
          scoring={scoring}
          scoreA={match.scoreA}
          scoreB={match.scoreB}
          onChange={onScore}
          teamA={match.teamA}
          teamB={match.teamB}
          names={names}
          colors={colors}
          side={side}
          onSide={setSide}
          seedOf={seedOf}
        />
      </article>
    </section>
  );
}

const TONE = {
  faint: 'text-ink-faint',
  warn: 'text-warn',
  danger: 'text-danger',
} as const;
