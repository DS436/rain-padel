import { describe, expect, it } from 'vitest';
import {
  cycleLength,
  displayNames,
  estimateDuration,
  feasibility,
  formatDuration,
  parsePlayerNames,
  resultsCsv,
  resultsText,
} from '@/lib/format';
import { makeMatch, makeRound, makeTournament } from './fixtures';

describe('feasibility line', () => {
  it('says so plainly when everyone plays', () => {
    expect(feasibility(12, 3)).toBe('12 players · 3 courts — everyone plays every round.');
  });

  it('states the number of sit-outs without calling it a problem', () => {
    expect(feasibility(10, 2)).toBe('10 players · 2 courts — 2 players rest each round.');
    expect(feasibility(14, 3)).toBe('14 players · 3 courts — 2 players rest each round.');
    expect(feasibility(5, 1)).toBe('5 players · 1 court — 1 player rests each round.');
  });

  it('surfaces unused courts rather than silently ignoring them (spec 9.3)', () => {
    expect(feasibility(8, 3)).toBe('8 players · 3 courts — only 2 courts in use, everyone plays every round.');
    expect(feasibility(6, 4)).toBe('6 players · 4 courts — only 1 court in use, 2 players rest each round.');
  });

  it('explains what is missing below four players', () => {
    expect(feasibility(0, 1)).toBe('Add 4 more players to start.');
    expect(feasibility(3, 1)).toBe('Add 1 more player to start.');
  });
});

describe('duration estimates', () => {
  it('reads about ten minutes a round at 24 points', () => {
    expect(estimateDuration(11, { mode: 'points', target: 24 })).toBe('1h50m');
    expect(estimateDuration(7, { mode: 'points', target: 24 })).toBe('1h10m');
  });

  it('scales with the target and adds changeover in time mode', () => {
    expect(estimateDuration(6, { mode: 'points', target: 32 })).toBe('1h18m');
    expect(estimateDuration(4, { mode: 'time', minutes: 15 })).toBe('1h08m');
  });

  it('formats bare minutes and whole hours', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(120)).toBe('2h');
  });
});

describe('cycle length', () => {
  it('is N-1 for even counts and N for odd', () => {
    expect(cycleLength(12)).toBe(11);
    expect(cycleLength(11)).toBe(11);
    expect(cycleLength(8)).toBe(7);
  });
});

describe('duplicate names', () => {
  it('numbers only the names that actually clash', () => {
    const out = displayNames([
      { id: 'a', name: 'Ahmed' },
      { id: 'b', name: 'Sara' },
      { id: 'c', name: 'ahmed' },
      { id: 'd', name: 'Ahmed' },
    ]);
    expect(out.get('b')).toBe('Sara');
    expect(out.get('a')).toBe('Ahmed 1');
    expect(out.get('c')).toBe('ahmed 2');
    expect(out.get('d')).toBe('Ahmed 3');
  });
});

describe('bulk paste', () => {
  it('handles a pasted WhatsApp list with bullets and numbering', () => {
    expect(parsePlayerNames('1. Devansh\n2. Sara\n- Marcus\n\nPriya, Ahmed; Lucia')).toEqual([
      'Devansh',
      'Sara',
      'Marcus',
      'Priya',
      'Ahmed',
      'Lucia',
    ]);
  });

  it('returns nothing for whitespace', () => {
    expect(parsePlayerNames('  \n \n')).toEqual([]);
  });
});

const finished = () =>
  makeTournament({
    name: 'Tuesday Americano',
    players: [
      { id: 'p0', name: 'Devansh', active: true },
      { id: 'p1', name: 'Sara', active: true },
      { id: 'p2', name: 'Marcus, Jr', active: true },
      { id: 'p3', name: 'Priya', active: false },
    ],
    rounds: [
      makeRound({
        index: 0,
        matches: [
          makeMatch({ id: 'm0', teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], scoreA: 14, scoreB: 10 }),
        ],
      }),
    ],
    status: 'finished',
  });

describe('results export', () => {
  it('renders a WhatsApp-ready summary', () => {
    expect(resultsText(finished())).toBe(
      [
        '🎾 Tuesday Americano',
        'Americano · First to 24 · 1 rounds',
        '',
        '🥇 Devansh — 14 pts',
        '🥈 Sara — 14 pts',
        '🥉 Marcus, Jr — 10 pts',
        '4. Priya (left early) — 10 pts',
      ].join('\n'),
    );
  });

  it('escapes a comma in a name so the CSV stays valid', () => {
    const csv = resultsCsv(finished());
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Position,Player,Points,Conceded,Difference,Played,Wins,Active');
    expect(lines[1]).toBe('1,Devansh,14,10,4,1,1,yes');
    expect(lines[3]).toBe('3,"Marcus, Jr",10,14,-4,1,0,yes');
    expect(lines[4]).toBe('4,Priya,10,14,-4,1,0,no');
  });
});
