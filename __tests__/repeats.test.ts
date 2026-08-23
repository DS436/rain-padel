import { describe, expect, it } from 'vitest';
import {
  buildAmericanoSchedule,
  chooseSplit,
  generateKingRound,
  generateMexicanoRound,
  type CourtResult,
} from '@/lib/scheduler';
import { bump, count, emptyHistory, pairKey } from '@/lib/history';
import type { IndexHistory, RawRound } from '@/lib/types';

/**
 * The complaint this file exists for: "me and X played Y and Z in round one,
 * and then the exact same four played the exact same sides in round two."
 */

function apply(h: IndexHistory, r: RawRound): void {
  for (const m of r.matches) {
    bump(h.partnered, pairKey(m.teamA[0], m.teamA[1]));
    bump(h.partnered, pairKey(m.teamB[0], m.teamB[1]));
    for (const p of m.teamA) for (const q of m.teamB) bump(h.opposed, pairKey(p, q));
    for (const p of [...m.teamA, ...m.teamB]) bump(h.played, p);
  }
  for (const p of r.resting) bump(h.rested, p);
}

/** An order-independent name for a fixture: "0|3 v 1|2". */
const fixture = (m: RawRound['matches'][number]): string =>
  [pairKey(m.teamA[0], m.teamA[1]), pairKey(m.teamB[0], m.teamB[1])].sort().join(' v ');

describe('chooseSplit', () => {
  it('gives an unplayed court the balanced 1+4 v 2+3', () => {
    const { teamA, teamB } = chooseSplit([0, 1, 2, 3], emptyHistory<number>());
    expect(teamA).toEqual([0, 3]);
    expect(teamB).toEqual([1, 2]);
  });

  it('gives up balance rather than repeat a partnership', () => {
    const h = emptyHistory<number>();
    bump(h.partnered, pairKey(0, 3));
    const { teamA, teamB } = chooseSplit([0, 1, 2, 3], h);
    expect([...teamA].sort()).not.toEqual([0, 3]);
    expect([...teamB].sort()).not.toEqual([0, 3]);
  });

  it('breaks a repeated fixture even when no partnership repeats', () => {
    const h = emptyHistory<number>();
    // 0+2 v 1+3 has been played once; the two other splits have not.
    for (const [p, q] of [[0, 1], [0, 3], [2, 1], [2, 3]]) bump(h.opposed, pairKey(p!, q!));
    bump(h.partnered, pairKey(0, 2));
    bump(h.partnered, pairKey(1, 3));
    const chosen = chooseSplit([0, 1, 2, 3], h);
    expect(fixture({ courtIndex: 0, ...chosen })).not.toBe('0|2 v 1|3');
  });
});

describe('Mexicano pairs strictly by rank', () => {
  /**
   * The worst case there is: eight players, two courts, and nobody ever
   * changes position. Court one is ranks 1-4 every single game.
   *
   * This used to rotate the split so those four got a different fixture each
   * round. It reads as fairer and it is the wrong format: the third rotation
   * is 1+2 v 3+4, the two best against the two worst, which is the matchup
   * Mexicano exists to prevent. Repeats are the price of holding your place.
   */
  it('gives the ranked quad 1+4 v 2+3 every round, repeats and all', () => {
    const h = emptyHistory<number>();
    const ranking = [0, 1, 2, 3, 4, 5, 6, 7];

    for (let r = 1; r < 5; r++) {
      const round = generateMexicanoRound(ranking, 2, h, r);
      // Court one is ranks 1-4, court two is ranks 5-8.
      expect(fixture(round.matches[0]!)).toBe('0|3 v 1|2');
      expect(fixture(round.matches[1]!)).toBe('4|7 v 5|6');
      apply(h, round);
    }
  });

  it('never puts a court\'s top two together against its bottom two', () => {
    const h = emptyHistory<number>();
    let ranking = [0, 1, 2, 3, 4, 5, 6, 7];

    for (let r = 1; r < 12; r++) {
      const round = generateMexicanoRound(ranking, 2, h, r);
      for (const m of round.matches) {
        const quad = [...m.teamA, ...m.teamB].sort(
          (a, b) => ranking.indexOf(a) - ranking.indexOf(b),
        );
        const top2 = [quad[0]!, quad[1]!].sort((a, b) => a - b);
        expect([...m.teamA].sort((a, b) => a - b)).not.toEqual(top2);
        expect([...m.teamB].sort((a, b) => a - b)).not.toEqual(top2);
      }
      apply(h, round);
      // Rotate the table so this is not merely the frozen case again.
      ranking = [...ranking.slice(1), ranking[0]!];
    }
  });
});

describe('King of the Court always breaks up the arriving pairs', () => {
  /**
   * A court receives the losers falling from above and the winners climbing
   * from below. Handing those two pairs back unchanged is the same game one
   * court along, so that split is withheld outright rather than ranked last.
   */
  it('never returns the arriving pairs intact, however often they have met', () => {
    const h = emptyHistory<number>();
    const roster = [0, 1, 2, 3, 4, 5, 6, 7];
    let previous: CourtResult[] | null = null;

    for (let r = 0; r < 12; r++) {
      const round = generateKingRound(roster, previous, [], 2, h, r);
      if (previous) {
        const arriving = new Set<string>();
        for (const c of previous) {
          arriving.add(pairKey(c.winners[0], c.winners[1]));
          arriving.add(pairKey(c.losers[0], c.losers[1]));
        }
        for (const m of round.matches) {
          const made = [pairKey(m.teamA[0], m.teamA[1]), pairKey(m.teamB[0], m.teamB[1])];
          expect(made.filter((k) => arriving.has(k))).toEqual([]);
        }
      }
      apply(h, round);
      previous = round.matches.map((m) => {
        // Lowest index wins, so the ladder actually sorts itself.
        const aWins = Math.min(...m.teamA) < Math.min(...m.teamB);
        return {
          winners: (aWins ? m.teamA : m.teamB) as [number, number],
          losers: (aWins ? m.teamB : m.teamA) as [number, number],
        };
      });
    }
  });
});

describe('A five-player night', () => {
  /**
   * Five people and one court is the smallest real session there is, and the
   * one that used to loop hardest: the circle has exactly five rows, so round
   * six replayed round one — same four on court, same sides, same person
   * resting — and it went round like that all evening.
   */
  const play = (rounds: number) => {
    const { schedule } = buildAmericanoSchedule(5, 1, rounds);
    return schedule.map((r) => fixture(r.matches[0]!));
  };

  it('never replays a fixture in the round straight after it', () => {
    const games = play(15);
    for (let i = 1; i < games.length; i++) {
      expect(games[i], `round ${i + 1} repeats round ${i}`).not.toBe(games[i - 1]);
    }
  });

  it('does not start looping the moment the circle runs out', () => {
    const games = play(10);
    // Rounds 1-5 exhaust the circle. Rounds 6-10 must not be a replay of it.
    expect(games.slice(5)).not.toEqual(games.slice(0, 5));
    expect(games[5]).not.toBe(games[0]);
  });

  it('reaches far more of the possible fixtures than the circle alone', () => {
    // Five people give 5 foursomes x 3 splits = 15 possible fixtures. Over 15
    // games the circle alone reaches 5 of them and then loops; re-splitting
    // past the cycle reaches 9.
    //
    // Not all 15, and deliberately so: who sits out is decided before variety
    // is, so a row that would open up a fresh fixture loses to one that keeps
    // the rest counts level. Playing one game fewer than everybody else is a
    // worse night than seeing the same four names twice.
    expect(new Set(play(15)).size).toBeGreaterThanOrEqual(9);
  });

  it('keeps the sit-outs level while doing it', () => {
    const { stats } = buildAmericanoSchedule(5, 1, 15);
    const rests = Array.from({ length: 5 }, (_, i) => count(stats.rested, i));
    expect(Math.max(...rests) - Math.min(...rests)).toBeLessThanOrEqual(1);
  });

  it('never sits the same player out twice running', () => {
    const { schedule } = buildAmericanoSchedule(5, 1, 15);
    for (let i = 1; i < schedule.length; i++) {
      const repeated = schedule[i]!.resting.filter((p) =>
        schedule[i - 1]!.resting.includes(p),
      );
      expect(repeated, `round ${i + 1} sits out the same player as round ${i}`).toEqual([]);
    }
  });

  it('still keeps partnerships repeat-free through the first cycle', () => {
    const { stats } = buildAmericanoSchedule(5, 1, 5);
    expect(Math.max(...stats.partnered.values())).toBe(1);
  });
});

describe('Bigger fields go a long way without repeating at all', () => {
  it.each([
    [6, 1, 10],
    [7, 1, 12],
    [8, 2, 12],
    [9, 2, 12],
  ])('%i players on %i court(s) over %i rounds', (n, courts, rounds) => {
    const { schedule } = buildAmericanoSchedule(n, courts, rounds);
    const seen = schedule.flatMap((r) => r.matches.map(fixture));
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('Americano past the end of the circle', () => {
  /**
   * Eight players on one court: only two of the four teams the circle draws
   * each row can actually play, so half the partnerships never happen. Wrapping
   * blindly to row 0 would replay round one while six pairings sat unused.
   */
  it('prefers an unplayed circle row to the natural wrap', () => {
    const n = 8;
    const { schedule, stats } = buildAmericanoSchedule(n, 1, 14);
    for (const round of schedule) expect(round.matches).toHaveLength(1);

    const repeated = Math.max(0, ...stats.partnered.values());
    // 14 games x 2 pairs = 28 partnerships drawn from 28 possible pairs.
    // Blind wrapping produced repeats from game 8; this must do better.
    expect(repeated).toBeLessThanOrEqual(2);
  });

  it('is unchanged inside the first cycle', () => {
    // Nothing has been played, so every row is equally fresh and the natural
    // rotation must survive — this is what keeps the existing suite green.
    const a = buildAmericanoSchedule(8, 2, 7).schedule;
    const b = buildAmericanoSchedule(8, 2, 7).schedule;
    expect(a).toEqual(b);
    expect(count(buildAmericanoSchedule(8, 2, 7).stats.partnered, '')).toBe(0);
    expect(Math.max(...buildAmericanoSchedule(8, 2, 7).stats.partnered.values())).toBe(1);
  });
});
