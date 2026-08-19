import { describe, expect, it } from 'vitest';
import { createReducer, initialState, type CreateInput } from '@/lib/tournamentReducer';
import { computeStandings, computeTeamStandings } from '@/lib/standings';
import { buildProgression } from '@/lib/progression';
import { counterIds } from './fixtures';
import type { State } from '@/lib/tournamentReducer';
import type { Tournament } from '@/lib/types';

const deps = () => ({ newId: counterIds('id'), now: () => 1_700_000_000_000 });

function teamsInput(pairs: [string, string][], over: Partial<CreateInput> = {}): CreateInput {
  return {
    name: 'Pairs night',
    format: 'americano',
    mode: 'teams',
    scoring: { mode: 'points', target: 24 },
    courts: 2,
    plannedRounds: 3,
    gamesPerRound: 3,
    playerNames: [],
    teams: pairs.map(([a, b]) => ({ players: [{ name: a }, { name: b }] as [
      { name: string },
      { name: string },
    ] })),
    ...over,
  };
}

function create(input: CreateInput): Tournament {
  const t = createReducer(deps())(initialState, { type: 'CREATE', input }).tournament;
  expect(t).not.toBeNull();
  return t!;
}

const PAIRS: [string, string][] = [
  ['Ana', 'Ben'],
  ['Cal', 'Dee'],
  ['Eve', 'Fin'],
  ['Gus', 'Hal'],
];

describe('a teams session', () => {
  it('registers both members of every pair as players', () => {
    const t = create(teamsInput(PAIRS));
    expect(t.mode).toBe('teams');
    expect(t.teams).toHaveLength(4);
    expect(t.players).toHaveLength(8);
    expect(t.teams[0]!.name).toBe('Ana & Ben');
    // every team's two ids are real players on the roster
    for (const team of t.teams) {
      for (const id of team.players) expect(t.players.some((p) => p.id === id)).toBe(true);
    }
  });

  it('keeps a pair together on the same side of the net, every game', () => {
    const t = create(teamsInput(PAIRS));
    const sides = new Map(t.teams.map((tm) => [tm.id, tm.players.slice().sort().join('|')] as const));

    for (const round of t.rounds) {
      for (const m of round.matches) {
        for (const side of [m.teamA, m.teamB]) {
          const key = [...side].sort().join('|');
          expect([...sides.values()], 'a side that is not a registered pair').toContain(key);
        }
      }
    }
  });

  it('drops a pair as one unit and rebuilds the games not yet played', () => {
    const t = create(teamsInput(PAIRS));
    const reducer = createReducer(deps());
    const next = reducer(
      { tournament: t, notice: null },
      { type: 'SET_TEAM_ACTIVE', teamId: t.teams[3]!.id, active: false },
    ).tournament!;

    expect(next.teams[3]!.active).toBe(false);
    // both members follow the team, so the scoreboard dims them together
    for (const id of t.teams[3]!.players) {
      expect(next.players.find((p) => p.id === id)!.active).toBe(false);
    }
    const remaining = new Set(next.players.filter((p) => p.active).map((p) => p.id));
    for (const round of next.rounds) {
      for (const m of round.matches) {
        for (const id of [...m.teamA, ...m.teamB]) expect(remaining.has(id)).toBe(true);
      }
    }
  });

  it('refuses to drop below the two pairs a court needs', () => {
    const t = create(teamsInput(PAIRS.slice(0, 2)));
    const reducer = createReducer(deps());
    const state = { tournament: t, notice: null };
    expect(
      reducer(state, { type: 'SET_TEAM_ACTIVE', teamId: t.teams[1]!.id, active: false }),
    ).toBe(state);
  });

  it('will not let a lone player join a teams session', () => {
    const t = create(teamsInput(PAIRS));
    const reducer = createReducer(deps());
    const state = { tournament: t, notice: null };
    expect(reducer(state, { type: 'ADD_PLAYER', name: 'Ivy' })).toBe(state);

    const withTeam = reducer(state, { type: 'ADD_TEAM', names: ['Ivy', 'Jai'] }).tournament!;
    expect(withTeam.teams).toHaveLength(5);
    expect(withTeam.players).toHaveLength(10);
  });

  it('gives both members of a pair the same points', () => {
    const t = create(teamsInput(PAIRS));
    const reducer = createReducer(deps());
    const first = t.rounds[0]!.matches[0]!;
    const scored = reducer(
      { tournament: t, notice: null },
      { type: 'SET_SCORE', roundIndex: 0, matchId: first.id, scoreA: 16, scoreB: 8 },
    ).tournament!;

    const rows = computeStandings(scored);
    const [a1, a2] = first.teamA;
    expect(rows.find((r) => r.playerId === a1)!.points).toBe(16);
    expect(rows.find((r) => r.playerId === a2)!.points).toBe(16);

    const teamRows = computeTeamStandings(scored);
    const winner = teamRows.find((r) => r.players.includes(a1))!;
    // the pair banks the team score once, not twice
    expect(winner.points).toBe(16);
    expect(winner.wins).toBe(1);
    expect(teamRows[0]!.teamId).toBe(winner.teamId);
    expect(teamRows.every((r) => r.played <= 1)).toBe(true);
  });

  it('builds a mexicano teams session one game at a time', () => {
    const t = create(teamsInput(PAIRS, { format: 'mexicano', plannedRounds: 3 }));
    expect(t.rounds).toHaveLength(1);

    const reducer = createReducer(deps());
    let state: State = { tournament: t, notice: null };
    for (const m of t.rounds[0]!.matches) {
      state = reducer(state, { type: 'SET_SCORE', roundIndex: 0, matchId: m.id, scoreA: 14, scoreB: 10 });
    }
    const advanced = reducer(state, { type: 'ADVANCE_ROUND' }).tournament!;
    expect(advanced.rounds).toHaveLength(2);
    expect(advanced.currentRound).toBe(1);

    // court one holds the two leading pairs
    const leaders = computeTeamStandings(advanced).slice(0, 2).map((r) => r.teamId);
    const courtOne = advanced.rounds[1]!.matches[0]!;
    const teamOf = (side: readonly string[]) =>
      advanced.teams.find((tm) => side.every((id) => tm.players.includes(id)))!.id;
    expect([teamOf(courtOne.teamA), teamOf(courtOne.teamB)].sort()).toEqual([...leaders].sort());
  });
});

describe('progression', () => {
  it('tracks a running total and a position after every game', () => {
    const t = create(teamsInput(PAIRS));
    const reducer = createReducer(deps());
    let state: State = { tournament: t, notice: null };
    for (const m of t.rounds[0]!.matches) {
      state = reducer(state, {
        type: 'SET_SCORE',
        roundIndex: 0,
        matchId: m.id,
        scoreA: 20,
        scoreB: 4,
      });
    }

    const p = buildProgression(state.tournament!);
    expect(p.playedGames).toBe(1);
    expect(p.peak).toBe(20);
    // everyone has one entry per played game, resting included
    for (const s of p.series) expect(s.points).toHaveLength(1);
    const winners = p.series.filter((s) => s.points[0]!.result === 'win');
    expect(winners).toHaveLength(4);
    expect(winners[0]!.points[0]!.total).toBe(20);
    expect(new Set(p.series.map((s) => s.points[0]!.rank)).size).toBeGreaterThan(1);
  });

  it('ignores games nobody has scored yet', () => {
    const t = create(teamsInput(PAIRS));
    expect(buildProgression(t).playedGames).toBe(0);
  });
});
