import { describe, expect, it } from 'vitest';
import {
  createReducer,
  initialState,
  type Action,
  type CreateInput,
} from '@/lib/tournamentReducer';
import { counterIds } from './fixtures';
import type { Id, Round, Tournament } from '@/lib/types';

/**
 * The two ladder formats, driven through the reducer rather than the scheduler.
 *
 * That is deliberate: their whole behaviour is "read the last scoreline and
 * move people", so a test that hands the generator a synthetic history proves
 * much less than one that actually plays a night.
 */

function harness(overrides: Partial<CreateInput> = {}) {
  const reducer = createReducer({ newId: counterIds('id'), now: () => 1_700_000_000_000 });
  const input: CreateInput = {
    name: 'Ladder night',
    format: 'kingofcourt',
    scoring: { mode: 'points', target: 24 },
    courts: 3,
    plannedRounds: 10,
    playerNames: Array.from({ length: 12 }, (_, i) => `P${i}`),
    ...overrides,
  };
  let state = reducer(initialState, { type: 'CREATE', input });
  const run = (...actions: Action[]) => {
    state = actions.reduce(reducer, state);
    return state;
  };
  return {
    get t(): Tournament {
      return state.tournament!;
    },
    run,
    /** Score the current game, then step onto the next one. */
    play(winner: 'A' | 'B' | 'draw' = 'A') {
      const t = state.tournament!;
      const i = t.currentRound;
      for (const m of t.rounds[i]!.matches) {
        const [a, b] = winner === 'A' ? [14, 10] : winner === 'B' ? [10, 14] : [12, 12];
        run({ type: 'SET_SCORE', roundIndex: i, matchId: m.id, scoreA: a, scoreB: b });
      }
      run({ type: 'ADVANCE_ROUND' });
      return state.tournament!;
    },
  };
}

const onCourt = (r: Round, c: number): Id[] => [...r.matches[c]!.teamA, ...r.matches[c]!.teamB];
const pairKeys = (r: Round): string[] =>
  r.matches.flatMap((m) => [[...m.teamA].sort().join('+'), [...m.teamB].sort().join('+')]);

describe('King of the Court', () => {
  it('opens with a full ladder and a bench', () => {
    const h = harness();
    const first = h.t.rounds[0]!;
    expect(first.matches).toHaveLength(3);
    expect(first.resting).toHaveLength(0); // 12 players, 3 courts, nobody sits
  });

  it('promotes the winners and demotes the losers', () => {
    const h = harness({ playerNames: Array.from({ length: 8 }, (_, i) => `P${i}`), courts: 2 });
    const before = h.t.rounds[0]!;
    const topWinners = [...before.matches[0]!.teamA].sort();
    const bottomWinners = [...before.matches[1]!.teamA].sort();

    // team A wins on every court
    const after = h.play('A').rounds[1]!;

    // Court one is now last game's two winning pairs, split across the net.
    expect(new Set(onCourt(after, 0))).toEqual(
      new Set([...topWinners, ...bottomWinners]),
    );
    // And the pairs that arrived together are no longer partners.
    for (const key of pairKeys(after)) {
      expect(key).not.toBe(topWinners.join('+'));
      expect(key).not.toBe(bottomWinners.join('+'));
    }
  });

  it('a losing pair drops one court, not to the bottom', () => {
    const h = harness(); // 3 courts
    const middleLosers = new Set([...h.t.rounds[0]!.matches[1]!.teamB]);
    const after = h.play('A').rounds[1]!;
    // losers of court 2 belong on court 3
    for (const id of middleLosers) expect(onCourt(after, 2)).toContain(id);
  });

  it('rotates the bench in at the bottom court', () => {
    // 14 players over 3 courts leaves two waiting.
    const h = harness({ playerNames: Array.from({ length: 14 }, (_, i) => `P${i}`) });
    const waiting = h.t.rounds[0]!.resting;
    expect(waiting).toHaveLength(2);

    const after = h.play('A').rounds[1]!;
    // everyone who was waiting is now playing, on the bottom court
    for (const id of waiting) expect(onCourt(after, 2)).toContain(id);
    expect(after.resting).toHaveLength(2);
    // and the people they replaced are the ones who just lost down there
    for (const id of after.resting) expect(waiting).not.toContain(id);
  });

  it('never puts anyone on two courts at once, over a long night', () => {
    const h = harness({ playerNames: Array.from({ length: 14 }, (_, i) => `P${i}`), plannedRounds: 12 });
    for (let i = 0; i < 11; i++) h.play(i % 3 === 0 ? 'B' : 'A');

    for (const round of h.t.rounds) {
      const playing = round.matches.flatMap((m) => [...m.teamA, ...m.teamB]);
      expect(new Set(playing).size).toBe(playing.length);
      expect(new Set([...playing, ...round.resting]).size).toBe(14);
    }
  });

  it('hands out a different partner nearly every game', () => {
    const h = harness({ plannedRounds: 8 });
    for (let i = 0; i < 7; i++) h.play(i % 2 === 0 ? 'A' : 'B');

    const seen = new Map<string, number>();
    for (const r of h.t.rounds) {
      for (const k of pairKeys(r)) seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    // 8 games x 6 pairs = 48 partnerships. With 12 players, repeats are
    // possible but a partnership played three times means the ladder is stuck.
    expect(Math.max(...seen.values())).toBeLessThanOrEqual(2);
  });
});

describe('Winner Stays On', () => {
  const six = { format: 'winnerstays' as const, playerNames: ['A', 'B', 'C', 'D', 'E', 'F'] };

  it('is one court whatever the form said', () => {
    const h = harness({ ...six, courts: 4 });
    expect(h.t.courts).toBe(1);
    expect(h.t.rounds[0]!.matches).toHaveLength(1);
    expect(h.t.rounds[0]!.resting).toHaveLength(2);
  });

  it('keeps the winners on and sends the losers to the back', () => {
    const h = harness(six);
    const first = h.t.rounds[0]!;
    const holders = [...first.matches[0]!.teamA];
    const losers = [...first.matches[0]!.teamB];
    const waiting = [...first.resting];

    const next = h.play('A').rounds[1]!;
    expect([...next.matches[0]!.teamA].sort()).toEqual(holders.sort());
    // the two who were waiting are now the challengers
    expect([...next.matches[0]!.teamB].sort()).toEqual(waiting.sort());
    // and the losers are behind them
    expect(next.resting).toEqual(losers);
  });

  it('a draw is not a win — the holders stay', () => {
    const h = harness(six);
    const holders = [...h.t.rounds[0]!.matches[0]!.teamA].sort();
    const next = h.play('draw').rounds[1]!;
    expect([...next.matches[0]!.teamA].sort()).toEqual(holders);
  });

  it('hands the court over when the challengers win', () => {
    const h = harness(six);
    const challengers = [...h.t.rounds[0]!.matches[0]!.teamB].sort();
    const next = h.play('B').rounds[1]!;
    expect([...next.matches[0]!.teamA].sort()).toEqual(challengers);
  });

  it('gives everybody a game within a couple of rounds', () => {
    const h = harness({ ...six, plannedRounds: 6 });
    for (let i = 0; i < 5; i++) h.play(i % 2 === 0 ? 'A' : 'B');

    const games = new Map<string, number>();
    for (const r of h.t.rounds) {
      for (const id of [...r.matches[0]!.teamA, ...r.matches[0]!.teamB]) {
        games.set(id, (games.get(id) ?? 0) + 1);
      }
    }
    expect(games.size).toBe(6); // nobody sat out the whole night
    expect(Math.max(...games.values()) - Math.min(...games.values())).toBeLessThanOrEqual(3);
  });
});
