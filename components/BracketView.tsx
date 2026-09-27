'use client';

import type { Id, Knockout, SeededPair, Tournament } from '@/lib/types';
import { bracketRounds, knockoutStageOf, loserOf, winnerOf } from '@/lib/knockout';
import { AvatarStack } from '@/components/PlayerAvatar';
import { CourtHeading } from '@/components/SessionChrome';

/**
 * The draw, as a list rather than as lines and boxes.
 *
 * A drawn bracket is the wrong shape for a phone held one-handed at the side of
 * a court — even four pairs needs horizontal room the screen does not have. A
 * game per card reads the same way the courts do and scrolls, and the thing
 * people actually want from it is "who do we play next", which the placeholder
 * rows answer: the final is drawn before the semis finish, with "Winner of
 * semi 2" standing where a pair will be.
 *
 * `fromGame` trims it to the games still to come — the Round tab scores the
 * live bracket game on its own court cards and only needs the rest of the
 * draw underneath.
 */
export function BracketView({
  tournament,
  colors,
  fromGame,
}: {
  tournament: Tournament;
  colors: Map<Id, string>;
  /** Only draw bracket games at or after this game index. */
  fromGame?: number;
}) {
  const k = tournament.knockout;
  if (!k) return null;

  const rounds = bracketRounds(k.size);
  const games = Array.from({ length: rounds }, (_, r) => k.fromGame + r).filter(
    (g) => fromGame === undefined || g >= fromGame,
  );
  if (games.length === 0) return null;

  return (
    <section>
      {games.map((gameIndex) => {
        const stage = knockoutStageOf(tournament, gameIndex);
        if (!stage) return null;
        const round = tournament.rounds[gameIndex];
        const onCourt = gameIndex === tournament.currentRound && tournament.status === 'live';

        if (round) {
          return round.matches.map((m, i) => {
            const scored = m.scoreA !== null && m.scoreB !== null;
            const won = winnerOf(k, m);
            const aWon = won ? sameSide(won.players, m.teamA) : null;
            return (
              <div key={m.id}>
                <CourtHeading
                  name={`Court ${m.courtIndex + 1} · ${shortLabel(stage.labels[i] ?? `Game ${i + 1}`)}`}
                  remark={scored ? 'Played' : onCourt ? 'On court' : undefined}
                />
                <div
                  className={`card divide-y divide-line overflow-hidden ${
                    onCourt && !scored
                      ? 'shadow-[var(--rp-shadow),inset_0_0_0_1.5px_var(--color-accent)]'
                      : ''
                  }`}
                >
                  <PairRow pair={pairOf(k, m.teamA)} ids={m.teamA} score={m.scoreA} through={aWon === true} tournament={tournament} colors={colors} />
                  <PairRow pair={pairOf(k, m.teamB)} ids={m.teamB} score={m.scoreB} through={aWon === false} tournament={tournament} colors={colors} />
                </div>
              </div>
            );
          });
        }

        // Not drawn yet: show who it will be, as far as the games before it
        // already say. A corrected semi re-derives the final, so this is read
        // off the scores every render rather than stored.
        const previous = tournament.rounds[gameIndex - 1];
        const feederStage = knockoutStageOf(tournament, gameIndex - 1);
        const feederWord = feederStage ? feederName(feederStage.name) : 'the game before';
        const bracketGames = k.size / 2 ** (stage.round + 1);
        return stage.labels.map((label, i) => {
          const third = i >= bracketGames;
          const slots = third ? [0, 1] : [2 * i, 2 * i + 1];
          return (
            <div key={`${gameIndex}-${i}`}>
              <CourtHeading name={`Court ${i + 1} · ${shortLabel(label)}`} />
              <div className="card divide-y divide-line overflow-hidden">
                {slots.map((f) => {
                  const feeder = previous?.matches[f];
                  const pair = feeder ? (third ? loserOf(k, feeder) : winnerOf(k, feeder)) : null;
                  return pair ? (
                    <PairRow key={f} pair={pair} ids={pair.players} score={null} through={false} tournament={tournament} colors={colors} />
                  ) : (
                    <div key={f} className="flex h-[52px] items-center gap-2.5 px-4">
                      <span className="w-[18px] flex-none" />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink-faint">
                        {third ? 'Loser' : 'Winner'} of {feederWord} {f + 1}
                      </span>
                      <span className="nums text-xl font-semibold leading-none text-line">–</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        });
      })}

      {fromGame === undefined ? (
        <p className="mt-4 px-1 text-[13px] text-ink-faint">
          Seeded on the group table. A drawn game goes to the better seed, so nobody plays a
          decider at eleven at night.
        </p>
      ) : null}
    </section>
  );
}

function sameSide(a: readonly [Id, Id], b: readonly [Id, Id]): boolean {
  return a.includes(b[0]) && a.includes(b[1]);
}

function pairOf(k: Knockout, ids: readonly [Id, Id]): SeededPair | undefined {
  return k.pairs.find((p) => sameSide(p.players, ids));
}

/** "Semi-final 2" → "Semi-final": the court number already tells them apart. */
function shortLabel(label: string): string {
  return label.replace(/ \d+$/, '');
}

/** "Semi-finals" → "semi", "Quarter-finals" → "quarter" — "Winner of semi 2". */
function feederName(stageName: string): string {
  const lower = stageName.toLowerCase();
  if (lower.startsWith('semi')) return 'semi';
  if (lower.startsWith('quarter')) return 'quarter';
  return lower.replace(/s$/, '');
}

function PairRow({
  pair,
  ids,
  score,
  through,
  tournament,
  colors,
}: {
  pair: SeededPair | undefined;
  ids: readonly [Id, Id];
  score: number | null;
  through: boolean;
  tournament: Tournament;
  colors: Map<Id, string>;
}) {
  const nameOf = (id: Id) => tournament.players.find((p) => p.id === id)?.name ?? '?';

  return (
    <div className="flex h-[52px] items-center gap-2.5 px-4">
      <span className="nums w-[18px] flex-none text-xs text-ink-faint">{pair?.seed ?? ''}</span>
      <AvatarStack people={ids.map((id) => ({ name: nameOf(id), color: colors.get(id) }))} />
      <span
        className={`min-w-0 flex-1 truncate text-[15px] text-ink ${through ? 'font-semibold' : 'font-medium'}`}
      >
        {pair?.name ?? ids.map(nameOf).join(' & ')}
      </span>
      <span
        className={`nums flex-none text-xl font-semibold leading-none ${score === null ? 'text-line' : 'text-ink'}`}
      >
        {score ?? '–'}
      </span>
    </div>
  );
}
