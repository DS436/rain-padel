import { describe, expect, it } from 'vitest';
import { finishLines, superlatives, shareText } from '@/lib/awards';
import { buildProgression, spreadOf, spreads } from '@/lib/progression';
import { computeStandings } from '@/lib/standings';
import { rematchQuery, parseTeamPairs } from '@/lib/format';
import { makeMatch, makeRound, makeTournament, makeTeams } from './fixtures';
import type { Tournament } from '@/lib/types';

/**
 * Four players, four games, with the partners rotating so that one player can
 * be held flat while the others swing. p0 scores exactly 12 every game — the
 * metronome — and nobody else repeats a number.
 */
const GAMES: { teamA: [string, string]; teamB: [string, string]; a: number; b: number }[] = [
  { teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], a: 12, b: 4 },
  { teamA: ['p0', 'p2'], teamB: ['p1', 'p3'], a: 12, b: 20 },
  { teamA: ['p0', 'p3'], teamB: ['p1', 'p2'], a: 12, b: 4 },
  { teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], a: 12, b: 20 },
];

function night(): Tournament {
  return makeTournament({
    players: [
      { id: 'p0', name: 'Metro', active: true },
      { id: 'p1', name: 'Swing', active: true },
      { id: 'p2', name: 'Climb', active: true },
      { id: 'p3', name: 'Sink', active: true },
    ],
    courts: 1,
    plannedRounds: 4,
    currentRound: 3,
    rounds: GAMES.map((g, i) =>
      makeRound({
        index: i,
        matches: [
          makeMatch({
            id: `m${i}`,
            teamA: g.teamA as [string, string],
            teamB: g.teamB as [string, string],
            scoreA: g.a,
            scoreB: g.b,
          }),
        ],
      }),
    ),
  });
}

describe('consistency', () => {
  it('scores a player who never varies at zero deviation', () => {
    const p = buildProgression(night());
    const metro = spreadOf(p.series.find((s) => s.name === 'Metro')!);
    expect(metro.mean).toBe(12);
    expect(metro.deviation).toBe(0);
    expect(metro.rated).toBe(true);
  });

  it('orders steadiest first and puts the swinger last', () => {
    const rows = spreads(buildProgression(night()));
    expect(rows[0]!.name).toBe('Metro');
    expect(rows[rows.length - 1]!.deviation).toBeGreaterThan(0);
  });

  it('will not rate a night of fewer than three games', () => {
    const t = night();
    const short = { ...t, rounds: t.rounds.slice(0, 2) };
    expect(spreads(buildProgression(short)).every((s) => !s.rated)).toBe(true);
  });
});

describe('awards', () => {
  it('gives most consistent to the player whose games never moved', () => {
    const t = night();
    const p = buildProgression(t);
    const list = superlatives(t, computeStandings(t), p);
    const metronome = list.find((a) => a.key === 'metronome');
    expect(metronome?.name).toBe('Metro');
    expect(metronome?.title).toBe('Most consistent');
  });

  it('names a biggest single game that actually happened', () => {
    const t = night();
    const p = buildProgression(t);
    const hammer = superlatives(t, computeStandings(t), p).find((a) => a.key === 'hammer');
    expect(hammer?.detail).toBe('20 points in one game');
  });

  it('says nothing at all about a session with no scores', () => {
    const t = makeTournament({ rounds: [] });
    expect(superlatives(t, computeStandings(t), buildProgression(t))).toEqual([]);
  });
});

describe('finish lines', () => {
  it('gives every player exactly one line, in standings order', () => {
    const t = night();
    const rows = computeStandings(t);
    const lines = finishLines(t, rows, buildProgression(t));
    expect(lines).toHaveLength(rows.length);
    expect(lines.map((l) => l.position)).toEqual(rows.map((r) => r.position));
  });

  it('badges the winner and the wooden spoon, and nobody in between', () => {
    const t = night();
    const rows = computeStandings(t);
    const lines = finishLines(t, rows, buildProgression(t));
    expect(lines[0]!.badge).toBe('Champion');
    expect(lines[lines.length - 1]!.badge).toBe('Wooden spoon');
    expect(lines[1]!.badge).toBe('Runner-up');
  });

  it('is stable across calls, so the copy does not reshuffle on re-render', () => {
    const t = night();
    const rows = computeStandings(t);
    const a = finishLines(t, rows, buildProgression(t)).map((l) => l.line);
    const b = finishLines(t, rows, buildProgression(t)).map((l) => l.line);
    expect(a).toEqual(b);
  });

  it('says so plainly when somebody never got on court', () => {
    const t = night();
    const withSpare = {
      ...t,
      players: [...t.players, { id: 'p4', name: 'Late', active: true }],
    };
    const rows = computeStandings(withSpare);
    const lines = finishLines(withSpare, rows, buildProgression(withSpare));
    expect(lines.find((l) => l.playerId === 'p4')?.line).toBe('Never made it onto court.');
  });

  it('folds the awards into the shareable text', () => {
    const t = night();
    const rows = computeStandings(t);
    const text = shareText(t, rows, buildProgression(t));
    expect(text).toContain('🎾');
    expect(text).toContain('Most consistent');
  });
});

describe('the rematch link', () => {
  it('carries names for an individual session', () => {
    const t = makeTournament();
    const q = new URLSearchParams(rematchQuery(t));
    expect(q.get('mode')).toBe('individual');
    expect(q.get('players')).toContain('Player 0');
    expect(q.get('teams')).toBeNull();
  });

  it('carries the pairs for a teams session, and reads them back', () => {
    const t = makeTournament({ mode: 'teams', ...makeTeams(3) });
    const q = new URLSearchParams(rematchQuery(t));
    const pairs = parseTeamPairs(q.get('teams')!);
    expect(pairs).toHaveLength(3);
    expect(pairs[0]).toEqual(['Player 0', 'Player 1']);
  });

  it('drops a half-written pair rather than inventing a partner', () => {
    expect(parseTeamPairs('Ana|Ben,Cal')).toEqual([['Ana', 'Ben']]);
  });
});

describe('the steady chart ordering', () => {
  it('sorts a rated player above an unrated one however tight their night was', () => {
    const t = night();
    // p4 plays one game and scores 9 — a deviation of zero on no evidence
    const withCameo = {
      ...t,
      players: [...t.players, { id: 'p4', name: 'Cameo', active: true }],
      rounds: [
        ...t.rounds,
        makeRound({
          index: 4,
          matches: [
            makeMatch({
              id: 'm4',
              teamA: ['p4', 'p1'] as [string, string],
              teamB: ['p2', 'p3'] as [string, string],
              scoreA: 9,
              scoreB: 15,
            }),
          ],
        }),
      ],
    };
    const rows = spreads(buildProgression(withCameo));
    expect(rows[0]!.name).toBe('Metro');
    expect(rows[rows.length - 1]!.name).toBe('Cameo');
  });
});
