import { describe, expect, it } from 'vitest';
import { computeStandings } from '@/lib/standings';
import { makeMatch, makeRound, makeTournament } from './fixtures';
import type { Tournament } from '@/lib/types';

const four = (over: Partial<Tournament> = {}) =>
  makeTournament({
    players: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, name: `P${i}`, active: true })),
    ...over,
  });

describe('the defining scoring rule', () => {
  it('awards the team score to each individual on that team', () => {
    // A 24-point match ending 14-10 gives BOTH winners 14 and BOTH losers 10.
    const t = four({
      rounds: [
        makeRound({
          index: 0,
          matches: [
            makeMatch({ id: 'm0', teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], scoreA: 14, scoreB: 10 }),
          ],
        }),
      ],
    });

    const rows = Object.fromEntries(computeStandings(t).map((r) => [r.playerId, r]));
    expect(rows.p0!.points).toBe(14);
    expect(rows.p1!.points).toBe(14);
    expect(rows.p2!.points).toBe(10);
    expect(rows.p3!.points).toBe(10);

    expect(rows.p0!.conceded).toBe(10);
    expect(rows.p2!.conceded).toBe(14);
    expect(rows.p0!.wins).toBe(1);
    expect(rows.p2!.wins).toBe(0);
    expect(rows.p2!.played).toBe(1);
  });

  it('splits results into wins, draws and losses', () => {
    const t = four({
      rounds: [
        makeRound({
          index: 0,
          matches: [
            makeMatch({ id: 'm0', teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], scoreA: 14, scoreB: 10 }),
          ],
        }),
        makeRound({
          index: 1,
          matches: [
            makeMatch({ id: 'm1', teamA: ['p0', 'p2'], teamB: ['p1', 'p3'], scoreA: 12, scoreB: 12 }),
          ],
        }),
      ],
    });

    const rows = Object.fromEntries(computeStandings(t).map((r) => [r.playerId, r]));
    expect([rows.p0!.wins, rows.p0!.draws, rows.p0!.losses]).toEqual([1, 1, 0]);
    expect([rows.p3!.wins, rows.p3!.draws, rows.p3!.losses]).toEqual([0, 1, 1]);
    // they always add up to matches played
    for (const r of Object.values(rows)) {
      expect(r.wins + r.draws + r.losses).toBe(r.played);
    }
  });

  it('ignores matches that have no score yet', () => {
    const t = four({
      rounds: [
        makeRound({
          index: 0,
          matches: [makeMatch({ id: 'm0', teamA: ['p0', 'p1'], teamB: ['p2', 'p3'] })],
        }),
      ],
    });
    for (const row of computeStandings(t)) {
      expect(row.points).toBe(0);
      expect(row.played).toBe(0);
    }
  });

  it('treats a player who has played nothing as 0, not NaN', () => {
    const rows = computeStandings(four());
    expect(rows.every((r) => Number.isFinite(r.points))).toBe(true);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4]);
  });

  it('still lists players who have dropped out', () => {
    const t = four();
    t.players[2]!.active = false;
    const rows = computeStandings(t);
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.playerId === 'p2')?.active).toBe(false);
  });
});

describe('ranking tiebreaks, in order', () => {
  const six = (rounds: Tournament['rounds']) =>
    makeTournament({
      players: [0, 1, 2, 3, 4, 5].map((i) => ({ id: `p${i}`, name: `P${i}`, active: true })),
      courts: 1,
      rounds,
    });

  it('1. total points comes first', () => {
    const t = makeTournament({
      players: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, name: `P${i}`, active: true })),
      rounds: [
        makeRound({
          index: 0,
          matches: [
            makeMatch({ id: 'm0', teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], scoreA: 20, scoreB: 4 }),
          ],
        }),
      ],
    });
    expect(computeStandings(t).map((r) => r.playerId)).toEqual(['p0', 'p1', 'p2', 'p3']);
  });

  it('2. points per match lifts a player who sat out over one who played more', () => {
    // p2 and p3 banked 20 from a single match; p0 needed two matches for the
    // same 20. Equal on points, so per-match decides — and it has to beat entry
    // order, which would otherwise have put p0 first.
    const t = six([
      makeRound({
        index: 0,
        matches: [
          makeMatch({ id: 'm0', teamA: ['p2', 'p3'], teamB: ['p0', 'p1'], scoreA: 20, scoreB: 4 }),
        ],
        resting: ['p4', 'p5'],
      }),
      makeRound({
        index: 1,
        matches: [
          makeMatch({ id: 'm1', teamA: ['p0', 'p4'], teamB: ['p1', 'p5'], scoreA: 16, scoreB: 4 }),
        ],
        resting: ['p2', 'p3'],
      }),
    ]);

    const rows = computeStandings(t);
    const at = (id: string) => rows.find((r) => r.playerId === id)!;

    expect(at('p0').points).toBe(20);
    expect(at('p2').points).toBe(20);
    expect(at('p0').played).toBe(2);
    expect(at('p2').played).toBe(1);

    expect(rows.slice(0, 3).map((r) => r.playerId)).toEqual(['p2', 'p3', 'p0']);
  });

  it('3. point differential breaks equal points at equal matches played', () => {
    // Reaching this tiebreak needs matches with DIFFERENT totals — with a fixed
    // target, equal points over equal matches forces equal conceded. Round 2
    // ended early at 20, which is exactly the spec 9.6 case.
    const t = six([
      makeRound({
        index: 0,
        matches: [
          makeMatch({ id: 'm0', teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], scoreA: 12, scoreB: 12 }),
        ],
        resting: ['p4', 'p5'],
      }),
      makeRound({
        index: 1,
        matches: [
          makeMatch({ id: 'm1', teamA: ['p0', 'p4'], teamB: ['p2', 'p5'], scoreA: 10, scoreB: 14 }),
        ],
        resting: ['p1', 'p3'],
      }),
      makeRound({
        index: 2,
        matches: [
          makeMatch({ id: 'm2', teamA: ['p1', 'p4'], teamB: ['p3', 'p5'], scoreA: 8, scoreB: 12 }),
        ],
        resting: ['p0', 'p2'],
      }),
    ]);

    const rows = computeStandings(t);
    const p2 = rows.find((r) => r.playerId === 'p2')!;
    const p5 = rows.find((r) => r.playerId === 'p5')!;

    expect(p2.points).toBe(26);
    expect(p5.points).toBe(26);
    expect(p2.played).toBe(2);
    expect(p5.played).toBe(2);
    expect(p2.conceded).toBe(22); // played two 24-point matches
    expect(p5.conceded).toBe(18); // played a 24 and a 20

    // better differential wins, overriding entry order which favours p2
    expect(p5.position).toBeLessThan(p2.position);
  });

  it('4. entry order is the final, deterministic tiebreak', () => {
    const t = makeTournament({
      players: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, name: `P${i}`, active: true })),
      rounds: [
        makeRound({
          index: 0,
          matches: [
            makeMatch({ id: 'm0', teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], scoreA: 12, scoreB: 12 }),
          ],
        }),
      ],
    });
    // all four are identical on every other key
    expect(computeStandings(t).map((r) => r.playerId)).toEqual(['p0', 'p1', 'p2', 'p3']);
  });
});
