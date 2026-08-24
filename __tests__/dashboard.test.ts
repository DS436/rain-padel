import { describe, expect, it } from 'vitest';
import {
  currentLeader,
  dashboardStats,
  emptyDashboard,
  favouriteFormatName,
  lastNight,
  MIN_NIGHTS_FOR_CROWN,
} from '@/lib/dashboard';
import { careerStats, type PlayerProfile } from '@/lib/players';
import type { Tournament } from '@/lib/types';
import { makeMatch, makePlayers, makeRound, makeTournament } from './fixtures';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

/** A session of `scores` played games between p0+p1 and p2+p3. */
function night(over: Partial<Tournament>, scores: [number, number][] = []): Tournament {
  return makeTournament({
    players: makePlayers(4),
    rounds: scores.map(([a, b], i) =>
      makeRound({
        index: i,
        matches: [
          makeMatch({
            id: `m${i}`,
            teamA: ['p0', 'p1'],
            teamB: ['p2', 'p3'],
            scoreA: a,
            scoreB: b,
          }),
        ],
      }),
    ),
    ...over,
  });
}

describe('dashboard totals', () => {
  it('is all zeroes with nothing stored', () => {
    expect(dashboardStats([])).toEqual(emptyDashboard());
  });

  it('counts every point every player scored', () => {
    // One 24-point game ending 14-10 puts 48 points into the evening: both
    // winners bank 14 and both losers bank 10.
    const stats = dashboardStats([night({ id: 'a' }, [[14, 10]])]);
    expect(stats.points).toBe(48);
    expect(stats.games).toBe(1);
    expect(stats.nights).toBe(1);
    expect(stats.people).toBe(4);
  });

  it('does not count an abandoned session as a night played', () => {
    // Somebody opened the form, typed four names and went home. That is not an
    // evening of padel, and counting it drags every average on the page down.
    const stats = dashboardStats([night({ id: 'a' }, []), night({ id: 'b' }, [[16, 8]])]);
    expect(stats.nights).toBe(1);
    expect(stats.games).toBe(1);
  });

  it('still counts an unscored session as live, so it can be resumed', () => {
    const stats = dashboardStats([night({ id: 'a', status: 'live' }, [])]);
    expect(stats.nights).toBe(0);
    expect(stats.live).toBe(1);
  });

  it('counts a person once however many nights they played', () => {
    const stats = dashboardStats([
      night({ id: 'a' }, [[10, 10]]),
      night({ id: 'b' }, [[10, 10]]),
    ]);
    expect(stats.people).toBe(4);
    expect(stats.nights).toBe(2);
  });

  it('matches names case- and space-insensitively', () => {
    const a = night({ id: 'a', players: [{ id: 'p0', name: 'Devansh', active: true }] }, []);
    const b = night({ id: 'b', players: [{ id: 'q0', name: '  devansh ', active: true }] }, []);
    expect(dashboardStats([a, b]).people).toBe(1);
  });

  it('reports the format run most often', () => {
    const stats = dashboardStats([
      night({ id: 'a', format: 'mexicano' }, [[10, 10]]),
      night({ id: 'b', format: 'mexicano' }, [[10, 10]]),
      night({ id: 'c', format: 'americano' }, [[10, 10]]),
    ]);
    expect(stats.favourite).toBe('mexicano');
    expect(favouriteFormatName(stats)).toBe('Mexicano');
  });

  it('has no favourite format before anything is scored', () => {
    expect(favouriteFormatName(dashboardStats([night({ id: 'a' }, [])]))).toBeNull();
  });

  it('takes the latest scored session as the last played date', () => {
    const stats = dashboardStats([
      night({ id: 'a', createdAt: 1_700_000_000_000 }, [[10, 10]]),
      night({ id: 'b', createdAt: 1_700_000_000_000 + 3 * DAY }, [[10, 10]]),
    ]);
    expect(stats.lastPlayed).toBe(1_700_000_000_000 + 3 * DAY);
  });
});

describe('week streak', () => {
  const base = 1_700_000_000_000;

  it('counts consecutive calendar weeks, not sessions', () => {
    const stats = dashboardStats([
      night({ id: 'a', createdAt: base }, [[10, 10]]),
      night({ id: 'b', createdAt: base + WEEK }, [[10, 10]]),
      night({ id: 'c', createdAt: base + 2 * WEEK }, [[10, 10]]),
    ]);
    expect(stats.streakWeeks).toBe(3);
  });

  it('does not double-count two nights in the same week', () => {
    const stats = dashboardStats([
      night({ id: 'a', createdAt: base }, [[10, 10]]),
      night({ id: 'b', createdAt: base + DAY }, [[10, 10]]),
    ]);
    expect(stats.streakWeeks).toBe(1);
  });

  it('breaks the run on a skipped week and keeps the longest', () => {
    const stats = dashboardStats([
      night({ id: 'a', createdAt: base }, [[10, 10]]),
      night({ id: 'b', createdAt: base + WEEK }, [[10, 10]]),
      // skipped a week
      night({ id: 'c', createdAt: base + 3 * WEEK }, [[10, 10]]),
    ]);
    expect(stats.streakWeeks).toBe(2);
  });
});

describe('current leader', () => {
  const profiles: PlayerProfile[] = [
    { id: 'sq0', name: 'Devansh', createdAt: 0, archived: false },
    { id: 'sq1', name: 'Aman', createdAt: 0, archived: false },
  ];

  /** A night where `winnerProfile` scores `hi` and the other scores `lo`. */
  const paired = (id: string, createdAt: number, hi: number, lo: number): Tournament =>
    makeTournament({
      id,
      createdAt,
      players: [
        { id: 'p0', name: 'Devansh', active: true, profileId: 'sq0' },
        { id: 'p1', name: 'Aman', active: true, profileId: 'sq1' },
        { id: 'p2', name: 'Burhan', active: true },
        { id: 'p3', name: 'Joel', active: true },
      ],
      rounds: [
        makeRound({
          index: 0,
          matches: [
            makeMatch({ id: 'm0', teamA: ['p0', 'p2'], teamB: ['p1', 'p3'], scoreA: hi, scoreB: lo }),
          ],
        }),
      ],
    });

  it('ranks on points per game, not on who turns up most', () => {
    // Devansh plays two nights at 20 a game: 40 points, average 20.
    // Aman plays four nights at 12 a game: 48 points, average 12.
    // Aman has the bigger pile. Devansh is the better player, and the crown
    // has to say so — otherwise whoever has come every week since March holds
    // it forever regardless of how they played.
    const sessions = [
      paired('a', 1, 20, 12),
      paired('b', 2, 20, 12),
      onlyAman('c', 3, 12),
      onlyAman('d', 4, 12),
    ];
    const careers = careerStats(profiles, sessions);
    expect(careers.get('sq1')!.points, 'aman has more points overall').toBeGreaterThan(
      careers.get('sq0')!.points,
    );

    const leader = currentLeader(profiles, careers);
    expect(leader?.name).toBe('Devansh');
    expect(leader?.average).toBe(20);
  });

  /** A night Devansh did not turn up to, so only Aman's record moves. */
  const onlyAman = (id: string, createdAt: number, score: number): Tournament =>
    makeTournament({
      id,
      createdAt,
      players: [
        { id: 'p1', name: 'Aman', active: true, profileId: 'sq1' },
        { id: 'p2', name: 'Burhan', active: true },
        { id: 'p3', name: 'Joel', active: true },
        { id: 'p4', name: 'Ahmed', active: true },
      ],
      rounds: [
        makeRound({
          index: 0,
          matches: [
            makeMatch({
              id: 'm0',
              teamA: ['p1', 'p2'],
              teamB: ['p3', 'p4'],
              scoreA: score,
              scoreB: score,
            }),
          ],
        }),
      ],
    });

  it('keeps one lucky evening off the top', () => {
    const one = [paired('a', 1, 24, 0)];
    expect(currentLeader(profiles, careerStats(profiles, one))).toBeNull();
    expect(MIN_NIGHTS_FOR_CROWN).toBe(2);
  });

  it('ignores archived squad members', () => {
    const archived = profiles.map((p) =>
      p.id === 'sq0' ? { ...p, archived: true } : p,
    );
    const sessions = [paired('a', 1, 20, 4), paired('b', 2, 20, 4)];
    const leader = currentLeader(archived, careerStats(archived, sessions));
    expect(leader?.name).toBe('Aman');
  });

  it('is null with an empty squad', () => {
    expect(currentLeader([], new Map())).toBeNull();
  });
});

describe('last night', () => {
  it('takes the most recent session that actually had a score', () => {
    const last = lastNight([
      night({ id: 'old', createdAt: 100, name: 'Old' }, [[14, 10]]),
      // newer, but nobody scored — it is not the last night anybody played
      night({ id: 'empty', createdAt: 999, name: 'Empty' }, []),
    ]);
    expect(last?.id).toBe('old');
    expect(last?.name).toBe('Old');
  });

  it('names the winner and their points', () => {
    const last = lastNight([night({ id: 'a', format: 'mexicano' }, [[14, 10]])]);
    // p0 and p1 both banked 14 — entry order breaks the tie
    expect(last?.winner).toBe('Player 0');
    expect(last?.winnerPoints).toBe(14);
    expect(last?.format).toBe('mexicano');
    expect(last?.players).toBe(4);
  });

  it('is null when nothing has ever been scored', () => {
    expect(lastNight([])).toBeNull();
    expect(lastNight([night({ id: 'a' }, [])])).toBeNull();
  });
});
