'use client';

import type { Id, Tournament } from '@/lib/types';
import { bracketRounds, knockoutStageOf, winnerOf } from '@/lib/knockout';
import { PlayerAvatar } from '@/components/PlayerAvatar';

/**
 * The draw, as a list rather than as lines and boxes.
 *
 * A drawn bracket is the wrong shape for a phone held one-handed at the side of
 * a court — even four pairs needs horizontal room the screen does not have. A
 * round per section reads the same way and scrolls, and the thing people
 * actually want from it is "who do we play next", which the top section answers.
 */
export function BracketView({
  tournament,
  colors,
}: {
  tournament: Tournament;
  colors: Map<Id, string>;
}) {
  const k = tournament.knockout;
  if (!k) return null;

  const rounds = bracketRounds(k.size);

  return (
    <section className="flex flex-col gap-4">
      {Array.from({ length: rounds }, (_, r) => {
        const gameIndex = k.fromGame + r;
        const stage = knockoutStageOf(tournament, gameIndex);
        const round = tournament.rounds[gameIndex];
        if (!stage) return null;

        return (
          <div key={r} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
              {stage.name}
            </h3>

            {round ? (
              <ul className="flex flex-col gap-2">
                {round.matches.map((m, i) => {
                  const won = winnerOf(k, m);
                  const aWon = won ? sameSide(won.players, m.teamA) : null;
                  return (
                    <li
                      key={m.id}
                      className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-3 py-2.5"
                    >
                      <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                        {stage.labels[i] ?? `Game ${i + 1}`}
                      </span>
                      <Side
                        ids={m.teamA}
                        score={m.scoreA}
                        through={aWon === true}
                        beaten={aWon === false}
                        tournament={tournament}
                        colors={colors}
                      />
                      <Side
                        ids={m.teamB}
                        score={m.scoreB}
                        through={aWon === false}
                        beaten={aWon === true}
                        tournament={tournament}
                        colors={colors}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-line px-3 py-3 text-sm text-ink-faint">
                Waiting on {r === 0 ? 'the draw' : stage.round === rounds - 1 ? 'the semi-finals' : 'the round before'}.
              </p>
            )}
          </div>
        );
      })}

      <p className="text-xs text-ink-faint">
        Seeded on the group table. A drawn game goes to the better seed, so
        nobody plays a decider at eleven at night.
      </p>
    </section>
  );
}

function sameSide(a: readonly [Id, Id], b: readonly [Id, Id]): boolean {
  return a.includes(b[0]) && a.includes(b[1]);
}

function Side({
  ids,
  score,
  through,
  beaten,
  tournament,
  colors,
}: {
  ids: readonly [Id, Id];
  score: number | null;
  through: boolean;
  beaten: boolean;
  tournament: Tournament;
  colors: Map<Id, string>;
}) {
  const seed = tournament.knockout?.pairs.find((p) => sameSide(p.players, ids));
  const nameOf = (id: Id) => tournament.players.find((p) => p.id === id)?.name ?? '?';

  return (
    <span
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        through ? 'bg-accent/10' : ''
      } ${beaten ? 'opacity-45' : ''}`}
    >
      <span className="nums w-5 shrink-0 text-center text-[11px] text-ink-faint">
        {seed ? seed.seed : '·'}
      </span>
      <span className="flex -space-x-1.5">
        {ids.map((id) => (
          <PlayerAvatar key={id} name={nameOf(id)} color={colors.get(id)} size="sm" />
        ))}
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm ${through ? 'font-semibold' : ''}`}>
        {seed?.name ?? ids.map(nameOf).join(' & ')}
      </span>
      <span className="nums shrink-0 text-lg font-semibold text-accent">{score ?? '–'}</span>
    </span>
  );
}
