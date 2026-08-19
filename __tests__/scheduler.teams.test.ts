import { describe, expect, it } from 'vitest';
import { buildTeamSchedule, generateMexicanoTeamRound } from '@/lib/scheduler';
import { count, emptyHistory, pairKey } from '@/lib/history';
import type { RawTeamRound, TeamIndex } from '@/lib/types';

/** The teams-mode equivalents of the individual invariants. */
function assertTeamRound(round: RawTeamRound, n: number, courts: number): void {
  const expectCourts = Math.min(Math.floor(n / 2), courts);
  const playing = round.matches.flatMap((m) => [m.teamA, m.teamB]);

  expect(round.matches.length, 'courts in play').toBe(expectCourts);
  expect(round.resting.length, 'teams sitting out').toBe(n - expectCourts * 2);
  expect(new Set(playing).size, 'a team on two courts at once').toBe(playing.length);
  expect(new Set([...playing, ...round.resting]).size, 'teams accounted for').toBe(n);
  expect(round.matches.map((m) => m.courtIndex)).toEqual(
    Array.from({ length: expectCourts }, (_, i) => i),
  );
  for (const m of round.matches) expect(m.teamA, 'a team playing itself').not.toBe(m.teamB);
}

function restSpread(res: { stats: { rested: Map<TeamIndex, number> } }, n: number): number {
  const counts = Array.from({ length: n }, (_, i) => count(res.stats.rested, i));
  return Math.max(...counts) - Math.min(...counts);
}

describe('teams americano — complete round robin', () => {
  // an even field meets everyone in n-1 games; an odd one needs the extra bye slate
  it.each([
    { n: 4, courts: 2, games: 3 },
    { n: 6, courts: 3, games: 5 },
    { n: 8, courts: 4, games: 7 },
    { n: 10, courts: 5, games: 9 },
  ])('$n teams / $courts courts plays every fixture once', ({ n, courts, games }) => {
    const res = buildTeamSchedule(n, courts, games);

    expect(res.schedule).toHaveLength(games);
    for (const round of res.schedule) assertTeamRound(round, n, courts);

    // every unordered pair of teams met exactly once
    expect(res.stats.opposed.size).toBe((n * (n - 1)) / 2);
    expect(Math.max(...res.stats.opposed.values())).toBe(1);
    expect(restSpread(res, n), 'nobody sits out while others do not').toBe(0);
  });

  it('gives an odd field one bye each and never repeats a fixture', () => {
    const n = 5;
    const res = buildTeamSchedule(n, 2, 5);
    for (const round of res.schedule) assertTeamRound(round, n, 2);
    expect(res.stats.opposed.size).toBe(10);
    expect(Math.max(...res.stats.opposed.values())).toBe(1);
    expect(restSpread(res, n)).toBe(0);
  });

  it('levels the byes when there are fewer courts than fixtures', () => {
    // 8 teams on 1 court is 3 of the 4 fixtures dropped every game, so the bye
    // is the normal state. The drop is chosen greedily per game, which lands
    // within one of level here and within two in the worst court-limited cases
    // — the same characteristic the individual scheduler has, and the reason
    // the construction is not replaced with a search.
    const res = buildTeamSchedule(8, 1, 8);
    for (const round of res.schedule) assertTeamRound(round, 8, 1);
    expect(restSpread(res, 8)).toBeLessThanOrEqual(2);

    const many = buildTeamSchedule(10, 2, 9);
    expect(restSpread(many, 10)).toBeLessThanOrEqual(1);
  });

  it('continues the circle rather than replaying it', () => {
    // 6 teams is a 5-fixture cycle, so 3 games then 2 completes it exactly.
    const first = buildTeamSchedule(6, 3, 3);
    const next = buildTeamSchedule(6, 3, 2, {
      seed: first.stats,
      startIndex: 3,
      rotationOffset: 3,
    });
    expect(next.schedule[0]!.index).toBe(3);
    // together the two halves are still a complete, repeat-free round robin
    expect(Math.max(...next.stats.opposed.values())).toBe(1);
    expect(next.stats.opposed.size).toBe(15);
  });

  it('repeats fixtures only once the cycle is exhausted', () => {
    // 6 teams meet everyone in 5 games; a 6th game has to replay something.
    const res = buildTeamSchedule(6, 3, 6);
    expect(Math.max(...res.stats.opposed.values())).toBe(2);
  });
});

describe('teams mexicano', () => {
  it('opens with a plain round robin slate', () => {
    const round = generateMexicanoTeamRound([0, 1, 2, 3], 2, emptyHistory(), 0);
    assertTeamRound(round, 4, 2);
  });

  it('puts the top two teams on court one', () => {
    // ranking is standings order, strongest first
    const round = generateMexicanoTeamRound([2, 0, 3, 1], 2, emptyHistory(), 1);
    expect(round.matches[0]).toMatchObject({ courtIndex: 0, teamA: 2, teamB: 0 });
    expect(round.matches[1]).toMatchObject({ courtIndex: 1, teamA: 3, teamB: 1 });
    expect(round.resting).toEqual([]);
  });

  it('sits out whoever has sat out least, not whoever is winning', () => {
    const history = emptyHistory<TeamIndex>();
    history.rested.set(0, 1); // team 0 already had a bye
    history.rested.set(1, 1);

    // five teams, two courts: one team sits out
    const round = generateMexicanoTeamRound([0, 1, 2, 3, 4], 2, history, 1);
    assertTeamRound(round, 5, 2);
    expect([2, 3, 4], 'a team that has never rested takes the bye').toContain(round.resting[0]);
  });

  it('never draws the same fixture twice in the opening slate', () => {
    const round = generateMexicanoTeamRound([0, 1, 2, 3, 4, 5], 3, emptyHistory(), 0);
    const keys = round.matches.map((m) => pairKey(m.teamA, m.teamB));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
