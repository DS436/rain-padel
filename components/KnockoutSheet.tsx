'use client';

import { useMemo, useState } from 'react';
import type { Id, KnockoutSize, Tournament } from '@/lib/types';
import { Button } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { BracketView } from '@/components/BracketView';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { KNOCKOUT_SIZES, seedPairs, unitsNeeded } from '@/lib/knockout';
import { activeTeams } from '@/lib/rounds';

/**
 * Turning a leaderboard into a night with an ending.
 *
 * The one thing this screen has to do before anybody commits is show WHO goes
 * through and who they play, because "top four" means something different in
 * teams mode and individuals mode and nobody should have to find that out by
 * pressing the button.
 */
export function KnockoutSheet({
  tournament,
  colors,
  onClose,
  onStart,
  onCancel,
}: {
  tournament: Tournament;
  colors: Map<Id, string>;
  onClose: () => void;
  onStart: (size: KnockoutSize, thirdPlace: boolean) => void;
  onCancel: () => void;
}) {
  const running = tournament.knockout !== null;
  const available =
    tournament.mode === 'teams'
      ? activeTeams(tournament).length
      : tournament.players.filter((p) => p.active).length;

  const largest =
    [...KNOCKOUT_SIZES].reverse().find((s) => unitsNeeded(tournament, s) <= available) ?? 2;
  const [size, setSize] = useState<KnockoutSize>(tournament.knockout?.size ?? largest);
  const [thirdPlace, setThirdPlace] = useState(tournament.knockout?.thirdPlace ?? true);

  const preview = useMemo(
    () => (running ? null : seedPairs(tournament, size)),
    [running, tournament, size],
  );

  const nameOf = (id: Id) => tournament.players.find((p) => p.id === id)?.name ?? '?';

  return (
    <Sheet title={running ? 'The finals' : 'Finish with a knockout'} onClose={onClose}>
      <div className="flex flex-col gap-5 pb-2">
        {running ? (
          <>
            <BracketView tournament={tournament} colors={colors} />
            <Button
              variant="danger"
              className="w-full"
              onClick={() => {
                if (
                  window.confirm(
                    'Cancel the finals? The bracket games are dropped and the night goes back to a plain leaderboard. Group scores are kept.',
                  )
                ) {
                  onCancel();
                  onClose();
                }
              }}
            >
              Cancel the finals
            </Button>
          </>
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                How many pairs go through
              </h3>
              <div className="flex gap-2">
                {KNOCKOUT_SIZES.map((s) => {
                  const need = unitsNeeded(tournament, s);
                  const ok = need <= available;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={!ok}
                      onClick={() => setSize(s)}
                      aria-pressed={size === s}
                      className={`flex min-h-16 flex-1 flex-col items-center justify-center rounded-xl border text-sm transition-colors disabled:opacity-35 ${
                        size === s
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-line bg-surface text-ink-dim'
                      }`}
                    >
                      <span className="nums text-xl font-semibold">{s}</span>
                      <span className="text-[11px]">
                        {s === 2 ? 'Final only' : s === 4 ? 'Semis' : 'Quarters'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink-faint">
                {tournament.mode === 'teams'
                  ? `${available} team${available === 1 ? '' : 's'} still in — a bracket of ${size} needs ${unitsNeeded(tournament, size)}.`
                  : `${available} player${available === 1 ? '' : 's'} still in — ${size} pairs means the top ${unitsNeeded(tournament, size)} qualify.`}
              </p>
            </section>

            {size >= 4 ? (
              <button
                type="button"
                onClick={() => setThirdPlace((v) => !v)}
                aria-pressed={thirdPlace}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${
                  thirdPlace ? 'border-accent/40 bg-accent/10' : 'border-line bg-surface'
                }`}
              >
                <span className="flex flex-col">
                  <span className="text-sm text-ink">Play off for third</span>
                  <span className="text-xs text-ink-faint">
                    The beaten semi-finalists take the other court while the final is on.
                  </span>
                </span>
                <span
                  aria-hidden
                  className={`shrink-0 text-lg ${thirdPlace ? 'text-accent' : 'text-ink-faint'}`}
                >
                  {thirdPlace ? '●' : '○'}
                </span>
              </button>
            ) : null}

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Who goes through
              </h3>
              {preview ? (
                <ol className="flex flex-col gap-1.5">
                  {preview.map((p) => (
                    <li
                      key={p.seed}
                      className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2"
                    >
                      <span className="nums w-5 text-center text-sm text-ink-faint">{p.seed}</span>
                      <span className="flex -space-x-1.5">
                        {p.players.map((id) => (
                          <PlayerAvatar
                            key={id}
                            name={nameOf(id)}
                            color={colors.get(id)}
                            size="sm"
                          />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
                  Not enough of the roster left to fill a bracket of {size}.
                </p>
              )}
              {preview && tournament.mode === 'individual' ? (
                <p className="text-xs text-ink-faint">
                  Qualifiers are folded strongest with weakest, so no pair starts as a certainty.
                </p>
              ) : null}
            </section>

            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                disabled={!preview}
                onClick={() => {
                  onStart(size, thirdPlace);
                  onClose();
                }}
              >
                Start the {size === 2 ? 'final' : size === 4 ? 'semi-finals' : 'quarter-finals'}
              </Button>
              <p className="text-center text-xs text-ink-faint">
                Everything played so far is kept and becomes the qualifying table. Any rounds still
                in the plan are dropped.
              </p>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
