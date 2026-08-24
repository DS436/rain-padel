import { describe, expect, it } from 'vitest';
import {
  defaultGamesPerRound,
  gameInRound,
  gameLabel,
  gamesToRounds,
  plannedRoundCount,
  roundOfGame,
  roundsToGames,
  slateNoun,
} from '@/lib/cycles';
import { FORMAT_SPECS } from '@/lib/formats';
import { limitProblem, unitLimits } from '@/lib/limits';
import { makeTournament } from './fixtures';

describe('a round is a cycle, not a game', () => {
  it('is unitCount - 1 games for individuals', () => {
    // the rule as stated: four people is three games, five is four
    expect(defaultGamesPerRound(4, 'individual')).toBe(3);
    expect(defaultGamesPerRound(5, 'individual')).toBe(4);
    expect(defaultGamesPerRound(8, 'individual')).toBe(7);
  });

  it('gives an odd team field the extra slate its bye needs', () => {
    expect(defaultGamesPerRound(4, 'teams')).toBe(3);
    expect(defaultGamesPerRound(5, 'teams')).toBe(5);
    expect(defaultGamesPerRound(6, 'teams')).toBe(5);
  });

  it('never returns zero, however small the field', () => {
    expect(defaultGamesPerRound(0, 'individual')).toBe(1);
    expect(defaultGamesPerRound(1, 'teams')).toBe(1);
  });

  it('maps games onto rounds both ways', () => {
    expect(roundOfGame(0, 3)).toBe(0);
    expect(roundOfGame(2, 3)).toBe(0);
    expect(roundOfGame(3, 3)).toBe(1);
    expect(gameInRound(4, 3)).toBe(1);
    expect(roundsToGames(2, 3)).toBe(6);
    // a part-finished round still counts as a round
    expect(gamesToRounds(7, 3)).toBe(3);
  });

  it('labels a game by its round and its place in it', () => {
    const t = makeTournament({ gamesPerRound: 3 });
    expect(gameLabel(t, 0)).toBe('Round 1 · game 1 of 3');
    expect(gameLabel(t, 4)).toBe('Round 2 · game 2 of 3');
    expect(plannedRoundCount({ ...t, plannedRounds: 9 })).toBe(3);
  });

  it('calls a mexicano slate a round, and a ladder slate a game', () => {
    // Mexicano has no cycle to finish — a round IS one slate of courts, which
    // is how the format is published ("five to eight rounds") and how players
    // talk about it. The ladders have no rounds at all, only games.
    const mex = makeTournament({ format: 'mexicano', gamesPerRound: 1 });
    expect(slateNoun(mex)).toBe('round');
    expect(gameLabel(mex, 4)).toBe('Round 5');

    const ladder = makeTournament({ format: 'kingofcourt', gamesPerRound: 1 });
    expect(slateNoun(ladder)).toBe('game');
    expect(gameLabel(ladder, 4)).toBe('Game 5');
  });

  it('opens a mexicano night on rounds, not on a cycle length', () => {
    // Sixteen players is still about seven rounds. A cycle length would ask
    // for fifteen, which is an entirely different evening.
    expect(FORMAT_SPECS.mexicano.cyclic).toBe(false);
    expect(FORMAT_SPECS.mexicano.defaultRounds).toBe(7);
    // and americano is untouched — its round is still a full cycle
    expect(FORMAT_SPECS.americano.cyclic).toBe(true);
  });

  it('reads a v1 session exactly as it always did', () => {
    // migrate pins old rows to 1 game per round so their printed round
    // numbers still mean the same thing
    const legacy = makeTournament({ gamesPerRound: 1 });
    expect(gameLabel(legacy, 4)).toBe('Game 5');
    expect(plannedRoundCount(legacy)).toBe(legacy.plannedRounds);
  });
});

describe('field size limits', () => {
  it('takes 4–32 individuals and 3–32 teams for americano', () => {
    expect(unitLimits('americano', 'individual')).toEqual({ min: 4, max: 32 });
    expect(unitLimits('americano', 'teams')).toEqual({ min: 3, max: 32 });
  });

  it('goes to 64 for mexicano, which schedules one game at a time', () => {
    expect(unitLimits('mexicano', 'individual').max).toBe(64);
    expect(unitLimits('mexicano', 'teams').max).toBe(64);
  });

  it('explains the problem rather than just refusing', () => {
    expect(limitProblem('americano', 'individual', 8)).toBeNull();
    expect(limitProblem('americano', 'individual', 3)).toMatch(/Add 1 more player/);
    expect(limitProblem('americano', 'teams', 2)).toMatch(/at least 3/);
    expect(limitProblem('americano', 'individual', 40)).toMatch(/tops out at 32/);
    expect(limitProblem('mexicano', 'individual', 40)).toBeNull();
  });
});
