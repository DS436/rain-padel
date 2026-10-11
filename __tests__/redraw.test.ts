import { describe, expect, it } from 'vitest';
import {
  canRedrawFrom,
  canShuffle,
  createReducer,
  initialState,
  type Action,
  type CreateInput,
  type State,
} from '@/lib/tournamentReducer';
import type { Round, Tournament } from '@/lib/types';
import { counterIds } from './fixtures';

/**
 * Fixing the draw without starting the night again.
 *
 * Three ways in, all of them asked for from the court rather than the desk:
 * reshuffle the opening draw, redraw the round on court when the line-up
 * changes before anyone has scored, and redraw everything after a round whose
 * score turned out to be wrong.
 */
function session(overrides: Partial<CreateInput> = {}, id = 'rd') {
  const reducer = createReducer({ newId: counterIds(id), now: () => 1_700_000_000_000 });
  const input: CreateInput = {
    name: 'Sunday',
    format: 'mexicano',
    scoring: { mode: 'points', target: 16 },
    courts: 1,
    plannedRounds: 7,
    playerNames: ['Ahmed', 'Aman', 'Amit', 'B', 'C'],
    ...overrides,
  };
  const state = reducer(initialState, { type: 'CREATE', input });
  const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s);
  return { reducer, state, run };
}

const t = (s: State): Tournament => s.tournament!;
const onCourt = (r: Round) => r.matches.flatMap((m) => [...m.teamA, ...m.teamB]);

function scoreRound(reducer: ReturnType<typeof createReducer>, s: State, i: number, a = 10, b = 6): State {
  return t(s).rounds[i]!.matches.reduce(
    (acc, m) => reducer(acc, { type: 'SET_SCORE', roundIndex: i, matchId: m.id, scoreA: a, scoreB: b }),
    s,
  );
}

function draw(r: Round): string {
  const side = (ids: readonly string[]) => [...ids].sort().join('+');
  return `${r.matches.map((m) => [side(m.teamA), side(m.teamB)].sort().join(' v ')).sort().join('|')}/${side(r.resting)}`;
}

describe('shuffling the opening draw', () => {
  it('draws round 1 again, differently, and every phone agrees on the result', () => {
    const a = session();
    const b = session();
    const shuffledA = a.run(a.state, { type: 'SHUFFLE_ROUND' });
    const shuffledB = b.run(b.state, { type: 'SHUFFLE_ROUND' });

    expect(draw(t(shuffledA).rounds[0]!)).not.toBe(draw(t(a.state).rounds[0]!));
    // Same session, same shuffle count: the seed is shared, so is the draw.
    expect(draw(t(shuffledA).rounds[0]!)).toBe(draw(t(shuffledB).rounds[0]!));
    expect(t(shuffledA).shuffles).toBeGreaterThan(0);
    expect(t(shuffledA).rounds).toHaveLength(1);
  });

  it('never hands back the draw it replaced, even with only four players', () => {
    // Four players can only be paired three ways, so a re-roll lands on the
    // same draw a third of the time. Pressing Shuffle must still move.
    const { state, run } = session({ playerNames: ['A', 'B', 'C', 'D'] });
    let s = state;
    for (let i = 0; i < 12; i++) {
      const next = run(s, { type: 'SHUFFLE_ROUND' });
      expect(draw(t(next).rounds[0]!)).not.toBe(draw(t(s).rounds[0]!));
      s = next;
    }
  });

  it('wipes scores already entered on the round it reshuffles', () => {
    const { reducer, state, run } = session();
    const scored = scoreRound(reducer, state, 0);
    const next = run(scored, { type: 'SHUFFLE_ROUND' });
    expect(t(next).rounds[0]!.matches.every((m) => m.scoreA === null && m.scoreB === null)).toBe(true);
  });

  it('is round 1 only: gone once round 2 has been drawn from it', () => {
    const { reducer, state, run } = session();
    expect(canShuffle(t(state))).toBe(true);
    const second = run(scoreRound(reducer, state, 0), { type: 'ADVANCE_ROUND' });
    expect(canShuffle(t(second))).toBe(false);
    expect(run(second, { type: 'SHUFFLE_ROUND' })).toBe(second);
  });

  it('is not offered where round 1 is not a random draw', () => {
    // Americano is a fixed schedule and the ladders seat people in entry order.
    for (const format of ['americano', 'kingofcourt', 'winnerstays'] as const) {
      const { state } = session({ format });
      expect(canShuffle(t(state)), format).toBe(false);
    }
  });

  it('works for fixed pairs too, since their opening round is drawn the same way', () => {
    const { state, run } = session({
      mode: 'teams',
      courts: 1,
      playerNames: [],
      teams: [
        { players: [{ name: 'A' }, { name: 'B' }] },
        { players: [{ name: 'C' }, { name: 'D' }] },
        { players: [{ name: 'E' }, { name: 'F' }] },
      ],
    });
    expect(canShuffle(t(state))).toBe(true);
    const next = run(state, { type: 'SHUFFLE_ROUND' });
    expect(draw(t(next).rounds[0]!)).not.toBe(draw(t(state).rounds[0]!));
  });
});

describe('a Mexicano round on court follows the line-up until it starts', () => {
  it('puts the player who is here on court in place of the one who is not', () => {
    // The voice note: five people, one court. Somebody is on court who has not
    // arrived, and somebody who is standing right there is sitting out.
    const { state, run } = session();
    const r0 = t(state).rounds[0]!;
    const absent = onCourt(r0)[0]!;
    const sittingOut = r0.resting[0]!;

    const next = run(state, { type: 'SET_PLAYER_ACTIVE', playerId: absent, active: false });
    const redrawn = t(next).rounds[0]!;
    expect(onCourt(redrawn)).not.toContain(absent);
    expect(onCourt(redrawn)).toContain(sittingOut);
    expect(redrawn.resting).toEqual([]);
    expect(next.notice).toEqual({ kind: 'round-redrawn', round: 0 });
  });

  it('fits a late arrival into a round nobody has scored yet', () => {
    const { state, run } = session({ playerNames: ['A', 'B', 'C', 'D'] });
    const next = run(state, { type: 'ADD_PLAYER', name: 'E' });
    const r0 = t(next).rounds[0]!;
    expect(r0.matches).toHaveLength(1);
    expect(new Set([...onCourt(r0), ...r0.resting]).size).toBe(5);
  });

  it('leaves a round alone once a score is in — that game is real', () => {
    const { reducer, state, run } = session();
    const scored = scoreRound(reducer, state, 0);
    const absent = onCourt(t(scored).rounds[0]!)[0]!;
    const next = run(scored, { type: 'SET_PLAYER_ACTIVE', playerId: absent, active: false });
    expect(t(next).rounds[0]).toBe(t(scored).rounds[0]);
  });

  it('does the same for a later round, drawn from the table', () => {
    const { reducer, state, run } = session({ playerNames: ['A', 'B', 'C', 'D', 'E', 'F'] });
    const second = run(scoreRound(reducer, state, 0), { type: 'ADVANCE_ROUND' });
    const gone = onCourt(t(second).rounds[1]!)[0]!;
    const next = run(second, { type: 'SET_PLAYER_ACTIVE', playerId: gone, active: false });
    expect(onCourt(t(next).rounds[1]!)).not.toContain(gone);
    expect(t(next).rounds[0]).toBe(t(second).rounds[0]);
  });

  it('keeps a running clock with the court rather than with the old draw', () => {
    const { state, run } = session({ scoring: { mode: 'time', minutes: 12 } });
    const timed = run(state, { type: 'START_TIMER', roundIndex: 0 });
    const absent = onCourt(t(timed).rounds[0]!)[0]!;
    const next = run(timed, { type: 'SET_PLAYER_ACTIVE', playerId: absent, active: false });
    expect(t(next).rounds[0]!.timer).toEqual(t(timed).rounds[0]!.timer);
    expect(t(next).rounds[0]!.matches[0]!.startedAt).toBe(1_700_000_000_000);
  });
});

describe('redrawing after a wrong score', () => {
  it('drops the rounds drawn from the old score and draws the next one again', () => {
    const { reducer, state, run } = session({ playerNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], courts: 2 });
    const second = run(scoreRound(reducer, state, 0, 10, 6), { type: 'ADVANCE_ROUND' });
    expect(t(second).currentRound).toBe(1);

    // Court 1's score was the wrong way round.
    const m = t(second).rounds[0]!.matches[0]!;
    const fixed = run(second, { type: 'SET_SCORE', roundIndex: 0, matchId: m.id, scoreA: 6, scoreB: 10 });
    expect(canRedrawFrom(t(fixed), 0)).toBe(true);

    const redrawn = run(fixed, { type: 'REDRAW_FROM', index: 0 });
    expect(t(redrawn).currentRound).toBe(1);
    expect(t(redrawn).rounds).toHaveLength(2);
    expect(t(redrawn).rounds[0]).toBe(t(fixed).rounds[0]);
    expect(t(redrawn).rounds[1]!.matches.every((x) => x.scoreA === null)).toBe(true);
    // The fresh round is exactly what Next would have drawn from these scores.
    const direct = session({ playerNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], courts: 2 });
    const scoredRight = direct.run(scoreRound(direct.reducer, direct.state, 0, 10, 6), {
      type: 'SET_SCORE',
      roundIndex: 0,
      matchId: t(direct.state).rounds[0]!.matches[0]!.id,
      scoreA: 6,
      scoreB: 10,
    });
    const viaNext = direct.run(scoredRight, { type: 'ADVANCE_ROUND' });
    expect(draw(t(redrawn).rounds[1]!)).toBe(draw(t(viaNext).rounds[1]!));
  });

  it('throws away later scores too, which is why the screen asks first', () => {
    const { reducer, state, run } = session();
    let s = run(scoreRound(reducer, state, 0), { type: 'ADVANCE_ROUND' });
    s = run(scoreRound(reducer, s, 1), { type: 'ADVANCE_ROUND' });
    const redrawn = run(s, { type: 'REDRAW_FROM', index: 0 });
    expect(t(redrawn).rounds).toHaveLength(2);
    expect(t(redrawn).currentRound).toBe(1);
  });

  it('lands on the round itself when its score was cleared, so it can go back in', () => {
    const { reducer, state, run } = session();
    const second = run(scoreRound(reducer, state, 0), { type: 'ADVANCE_ROUND' });
    const cleared = run(second, { type: 'CLEAR_ROUND_SCORES', index: 0 });
    const back = run(cleared, { type: 'REDRAW_FROM', index: 0 });
    expect(t(back).currentRound).toBe(0);
    expect(t(back).rounds).toHaveLength(1);
  });

  it('is not offered for a precomputed schedule, which never read the score', () => {
    const { reducer, state, run } = session({ format: 'americano', playerNames: ['A', 'B', 'C', 'D'] });
    const second = run(scoreRound(reducer, state, 0), { type: 'ADVANCE_ROUND' });
    expect(canRedrawFrom(t(second), 0)).toBe(false);
    expect(run(second, { type: 'REDRAW_FROM', index: 0 })).toBe(second);
  });
});
