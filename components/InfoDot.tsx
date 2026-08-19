'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sheet } from '@/components/Sheet';

/**
 * The "?" next to a choice.
 *
 * Americano and Mexicano are jargon to anyone who has not run a padel night,
 * and the difference decides what the whole evening feels like — so the
 * explanation belongs next to the switch, not in a help page nobody opens.
 */
export function InfoDot({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-xs font-semibold text-ink-dim transition-colors active:bg-surface active:text-ink"
      >
        ?
      </button>
      {open ? (
        <Sheet title={title} onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-5 pb-2">{children}</div>
        </Sheet>
      ) : null}
    </>
  );
}

export function InfoBlock({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink">{heading}</h3>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink-dim">{children}</div>
    </section>
  );
}

/** What the two formats actually are, in the words people use on court. */
export function FormatInfo() {
  return (
    <InfoDot label="What are Americano and Mexicano?" title="Americano vs Mexicano">
      <InfoBlock heading="Americano — everyone partners everyone">
        <p>
          The whole schedule is worked out before the first serve. You partner each person once, on
          rotating courts, and nobody negotiates who is next. It is the social default: the best
          player and the newest player will end up on the same side at some point, and that is the
          point.
        </p>
        <p>Choose it when the group is mixed and the evening is meant to be fun.</p>
      </InfoBlock>

      <InfoBlock heading="Mexicano — winners play winners">
        <p>
          Nothing is scheduled ahead. After every game everyone is re-ranked on points, and the next
          game is built from that table: first plays with fourth against second with third. Win and
          you climb toward court one, where the games get tight.
        </p>
        <p>Choose it when the group is competitive and wants the standings to mean something.</p>
      </InfoBlock>

      <InfoBlock heading="Both score the same way">
        <p>
          Points, not wins. A 24-point game ending 14–10 gives <em>both</em> winners 14 and{' '}
          <em>both</em> losers 10 — so drawing the weakest partner costs you a few points, not your
          evening.
        </p>
      </InfoBlock>
    </InfoDot>
  );
}

/** Individuals versus fixed pairs. */
export function ModeInfo() {
  return (
    <InfoDot label="What is the difference between individuals and teams?" title="Individuals or teams">
      <InfoBlock heading="Individuals">
        <p>
          Everyone is on their own. Partners rotate every game and the leaderboard ranks people, so
          your result is yours no matter who you were drawn with.
        </p>
      </InfoBlock>
      <InfoBlock heading="Teams">
        <p>
          Fixed pairs. You bring your partner, stay with them all night, and the pair is what gets
          drawn against the other pairs. The leaderboard ranks teams — both members always carry the
          same points.
        </p>
      </InfoBlock>
      <InfoBlock heading="Which one?">
        <p>
          Teams if people arrived as couples or the group already has settled partnerships.
          Individuals if you want everyone mixed and a single personal winner at the end.
        </p>
      </InfoBlock>
    </InfoDot>
  );
}

/** The round/game distinction, which is the thing most people query. */
export function RoundsInfo({ perRound, unitLabel }: { perRound: number; unitLabel: string }) {
  return (
    <InfoDot label="What counts as a round?" title="Rounds and games">
      <InfoBlock heading="A game is one turn on court">
        <p>Every court plays at once, you type in the scores, and that is one game.</p>
      </InfoBlock>
      <InfoBlock heading="A round is a full cycle">
        <p>
          A round is finished when everyone has been through the group — partnered every other
          player, or in teams, played every other pair. With {unitLabel} that is{' '}
          <strong className="text-ink">{perRound} game{perRound === 1 ? '' : 's'}</strong> to a
          round.
        </p>
        <p>
          Four players is three games; five is four. That is why you set rounds, not games — a round
          is the unit that is actually fair, because everybody has had the same draw by the end of
          it.
        </p>
      </InfoBlock>
    </InfoDot>
  );
}
