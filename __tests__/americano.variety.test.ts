import { describe, expect, it } from 'vitest';
import type { Match, Round, Tournament } from '@/lib/types';
import { buildScheduledRounds } from '@/lib/rounds';
import { counterIds, makeTournament } from './fixtures';

/**
 * Americano as a session actually runs it — through `rounds.ts`, seeded by
 * the session — rather than the bare circle the acceptance tables assert on.
 *
 * The complaint this guards: a round is one game per player, and round two
 * used to be round one again, game for game, with the same person resting at
 * the same point every time.
 */

const NAMES = ['Ahmed', 'Devansh', 'Burhan', 'Aman', 'Zara', 'Omar', 'Lina', 'Sami'];

function session(n: number, courts: number, id = 'tuesday'): Tournament {
  return makeTournament({
    id,
    courts,
    gamesPerRound: n,
    players: NAMES.slice(0, n).map((name, i) => ({ id: `p${i}`, name, active: true })),
  });
}

const side = (ids: readonly string[]) => [...ids].sort().join('+');
const fixture = (m: Match) => [side(m.teamA), side(m.teamB)].sort().join(' v ');
const game = (r: Round) => r.matches.map(fixture).sort().join(' | ');

function play(t: Tournament, games: number): Round[] {
  return buildScheduledRounds(t, games, 0, counterIds('m'));
}

describe.each([
  [4, 1],
  [5, 1],
  [6, 1],
  [7, 1],
  [8, 2],
  [9, 2],
])('%i players on %i court(s)', (n, courts) => {
  const rounds = 4;
  const games = play(session(n, courts), n * rounds);

  it('never plays the same game twice running', () => {
    for (let i = 1; i < games.length; i++) {
      expect(game(games[i]!), `game ${i + 1} repeats game ${i}`).not.toBe(game(games[i - 1]!));
    }
  });

  it('never keeps a partnership for two games running', () => {
    for (let i = 1; i < games.length; i++) {
      const before = new Set(games[i - 1]!.matches.flatMap((m) => [side(m.teamA), side(m.teamB)]));
      for (const m of games[i]!.matches) {
        for (const team of [m.teamA, m.teamB]) {
          expect(before.has(side(team)), `game ${i + 1} keeps ${side(team)} together`).toBe(false);
        }
      }
    }
  });

  /**
   * Not asserted for 7 or 8 on one court. There half the field sits every
   * game, and levelling the rest counts while pairing everybody once can
   * leave a row whose only fair bench includes someone who just sat — it
   * happens, about half as often as it did on the plain circle.
   */
  it.skipIf(n - 4 * courts >= 3)('never sits somebody out twice running', () => {
    for (let i = 1; i < games.length; i++) {
      const twice = games[i]!.resting.filter((p) => games[i - 1]!.resting.includes(p));
      expect(twice, `game ${i + 1}`).toEqual([]);
    }
  });

  it('does not replay one round as the next', () => {
    const roundOf = (k: number) => games.slice(k * n, (k + 1) * n).map(game);
    for (let k = 1; k < rounds; k++) expect(roundOf(k)).not.toEqual(roundOf(k - 1));
  });
});

describe('the five-player night from the bug report', () => {
  const games = play(session(5, 1), 15);
  const restOrder = (k: number) => games.slice(k * 5, (k + 1) * 5).map((r) => r.resting.join());

  it('rests everybody once a round, in a different order each round', () => {
    for (let k = 0; k < 3; k++) expect(new Set(restOrder(k)).size).toBe(5);
    expect(restOrder(1)).not.toEqual(restOrder(0));
    expect(restOrder(2)).not.toEqual(restOrder(1));
  });

  it('still partners everybody with everybody exactly once in round one', () => {
    const pairs = games.slice(0, 5).flatMap((r) => r.matches.flatMap((m) => [side(m.teamA), side(m.teamB)]));
    expect(new Set(pairs).size).toBe(10);
    expect(pairs).toHaveLength(10);
  });
});

describe('the draw belongs to the session', () => {
  it('two sessions with the same roster open differently', () => {
    const a = play(session(8, 2, 'monday'), 8).map(game);
    const b = play(session(8, 2, 'tuesday'), 8).map(game);
    expect(a).not.toEqual(b);
  });

  it('is reproducible: extending a session later draws what one pass would have', () => {
    const t = session(5, 1);
    const whole = play(t, 15);
    const first = play(t, 5);
    const rest = buildScheduledRounds({ ...t, rounds: first }, 10, 5, counterIds('n'));
    expect([...first, ...rest].map(game)).toEqual(whole.map(game));
  });
});
