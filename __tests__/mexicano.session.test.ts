import { describe, expect, it } from 'vitest';
import {
  createReducer,
  initialState,
  type Action,
  type CreateInput,
  type State,
} from '@/lib/tournamentReducer';
import { computeStandings } from '@/lib/standings';
import { gameLabel, gamesPerRound } from '@/lib/cycles';
import { counterIds } from './fixtures';
import type { Tournament } from '@/lib/types';

/**
 * Mexicano end to end, through the reducer that the screens actually use.
 *
 * The scheduler tests cover the pairing arithmetic in index space. This covers
 * the part that broke when the format table changed: what a session created
 * from the form is shaped like, what the round counter says, and whether the
 * standings that come out of one round really are what builds the next.
 */
function mexicano(overrides: Partial<CreateInput> = {}, id = 'mex') {
  const reducer = createReducer({ newId: counterIds(id), now: () => 1_700_000_000_000 });
  const input: CreateInput = {
    name: 'Tuesday Mexicano',
    format: 'mexicano',
    scoring: { mode: 'points', target: 24 },
    courts: 2,
    plannedRounds: 7,
    gamesPerRound: 1,
    playerNames: Array.from({ length: 8 }, (_, i) => `P${i}`),
    ...overrides,
  };
  const state = reducer(initialState, { type: 'CREATE', input });
  const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s);
  return { reducer, state, run };
}

const t = (s: State): Tournament => s.tournament!;

/** Score every match in a round, then advance. */
function playRound(
  reducer: ReturnType<typeof createReducer>,
  s: State,
  roundIndex: number,
  score: (i: number) => [number, number],
): State {
  const scored = t(s).rounds[roundIndex]!.matches.reduce((acc, m, i) => {
    const [a, b] = score(i);
    return reducer(acc, { type: 'SET_SCORE', roundIndex, matchId: m.id, scoreA: a, scoreB: b });
  }, s);
  return reducer(scored, { type: 'ADVANCE_ROUND' });
}

describe('a mexicano round is one slate of courts', () => {
  it('opens on one game, not on a cycle', () => {
    const { state } = mexicano();
    // Eight players in Americano is a seven-game cycle. Mexicano has no cycle:
    // a round is a slate, so the session opens with exactly one of them.
    expect(gamesPerRound(t(state))).toBe(1);
    expect(t(state).rounds).toHaveLength(1);
    expect(t(state).plannedRounds).toBe(7);
  });

  it('counts rounds, not games', () => {
    const { state } = mexicano();
    expect(gameLabel(t(state), 0)).toBe('Round 1');
    expect(gameLabel(t(state), 6)).toBe('Round 7');
  });

  it('leaves an americano session counting cycles', () => {
    const { state } = mexicano({ format: 'americano', gamesPerRound: 7 });
    expect(gamesPerRound(t(state))).toBe(7);
    expect(gameLabel(t(state), 0)).toBe('Round 1 · game 1 of 7');
  });
});

describe('the first round is drawn at random', () => {
  it('gives two different sessions two different opening draws', () => {
    // Same eight names, same order, same everything but the id. If the opener
    // were deterministic these would be identical every week.
    const draws = new Set<string>();
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const reducer = createReducer({ newId: counterIds(id), now: () => 1_700_000_000_000 });
      const s = reducer(initialState, {
        type: 'CREATE',
        input: {
          name: 'Tuesday',
          format: 'mexicano',
          scoring: { mode: 'points', target: 24 },
          courts: 2,
          plannedRounds: 7,
          gamesPerRound: 1,
          playerNames: Array.from({ length: 8 }, (_, i) => `P${i}`),
        },
      });
      const names = (ids: readonly string[]) =>
        ids.map((i) => t(s).players.find((p) => p.id === i)!.name).sort().join('+');
      draws.add(
        t(s)
          .rounds[0]!.matches.map((m) => `${names(m.teamA)} v ${names(m.teamB)}`)
          .join(' | '),
      );
    }
    expect(draws.size, 'every session opens with the same draw').toBeGreaterThan(1);
  });

  it('puts everybody on court exactly once in that draw', () => {
    const { state } = mexicano();
    const round = t(state).rounds[0]!;
    const on = round.matches.flatMap((m) => [...m.teamA, ...m.teamB]);
    expect(round.matches).toHaveLength(2);
    expect(new Set(on).size).toBe(8);
    expect(round.resting).toHaveLength(0);
  });
});

describe('later rounds are built from the live table', () => {
  it('groups the top four on court one and pairs them 1+4 against 2+3', () => {
    const { reducer, state } = mexicano();

    // Round one, with a clear result on each court so the table is not a
    // four-way tie: court 0 goes 24-0, court 1 goes 20-4.
    const next = playRound(reducer, state, 0, (i) => (i === 0 ? [24, 0] : [20, 4]));
    const table = computeStandings(t(next));
    const round2 = t(next).rounds[1]!;

    expect(round2.matches).toHaveLength(2);

    const topFour = table.slice(0, 4).map((r) => r.playerId);
    const onCourtOne = [...round2.matches[0]!.teamA, ...round2.matches[0]!.teamB];
    expect(new Set(onCourtOne), 'ranks 1-4 share court one').toEqual(new Set(topFour));

    // 1 with 4 against 2 with 3
    expect(round2.matches[0]!.teamA).toEqual([topFour[0], topFour[3]]);
    expect(round2.matches[0]!.teamB).toEqual([topFour[1], topFour[2]]);

    // and the same shape one court down
    const nextFour = table.slice(4, 8).map((r) => r.playerId);
    expect(round2.matches[1]!.teamA).toEqual([nextFour[0], nextFour[3]]);
    expect(round2.matches[1]!.teamB).toEqual([nextFour[1], nextFour[2]]);
  });

  it('lets a winner climb toward court one over several rounds', () => {
    const { reducer, state } = mexicano();
    let s = state;

    // Whoever is on teamA wins every game, so the table keeps moving.
    for (let r = 0; r < 4; r++) s = playRound(reducer, s, r, () => [24, 4]);

    expect(t(s).rounds).toHaveLength(5);
    const table = computeStandings(t(s));
    // The leader has to have out-scored the bottom of the table by now.
    expect(table[0]!.points).toBeGreaterThan(table[7]!.points);

    // and court one is still exactly the top four
    const courtOne = new Set([
      ...t(s).rounds[4]!.matches[0]!.teamA,
      ...t(s).rounds[4]!.matches[0]!.teamB,
    ]);
    expect(courtOne).toEqual(new Set(table.slice(0, 4).map((r) => r.playerId)));
  });

  it('redraws the same first round after a reload', () => {
    // Nothing about a round is persisted beyond its result, so a refresh
    // mid-round must not move people between courts.
    const a = mexicano({}, 'same');
    const b = mexicano({}, 'same');
    const key = (s: State) =>
      t(s).rounds[0]!.matches.map((m) => [...m.teamA, ...m.teamB].join(',')).join('|');
    expect(key(a.state)).toBe(key(b.state));
  });
});

/**
 * The warm-up. After one round everybody has exactly one result, so the table
 * that then dictates every court is largely a record of who drew the strong
 * partner. Playing two or three drawn rounds first is how organisers of
 * mixed-ability groups get a table worth ranking on.
 */
describe('opening rounds drawn at random', () => {
  /** Court 1 holds exactly the top four of the table. */
  const isRankGrouped = (s: State, roundIndex: number): boolean => {
    const table = computeStandings(t(s)).map((r) => r.playerId);
    const round = t(s).rounds[roundIndex]!;
    const courtOne = new Set([...round.matches[0]!.teamA, ...round.matches[0]!.teamB]);
    return table.slice(0, 4).every((id) => courtOne.has(id));
  };

  it('defaults to one, which is the published format', () => {
    const { state } = mexicano();
    expect(t(state).drawRounds).toBe(1);
  });

  it('keeps the table out of it for as many rounds as asked', () => {
    // Score lopsidedly so the table is never a tie and rank-grouping would be
    // unmistakable if it happened.
    const score = (i: number): [number, number] => (i === 0 ? [24, 2] : [20, 6]);

    const warm = mexicano({ drawRounds: 3 }, 'warmup');
    let s = warm.state;
    for (let r = 0; r < 3; r++) s = playRound(warm.reducer, s, r, score);

    // rounds 0..2 were drawn; round 3 is the first the table decides
    expect(t(s).rounds).toHaveLength(4);
    expect(isRankGrouped(s, 1), 'round 2 was drawn, not seeded').toBe(false);
    expect(isRankGrouped(s, 2), 'round 3 was drawn, not seeded').toBe(false);
    expect(isRankGrouped(s, 3), 'round 4 should be rank-grouped').toBe(true);

    // The control: the identical session with the default setting seeds round 2
    // off the same table. Same id, same names, same scores — only the setting
    // differs, so any difference in round 2 is the setting doing its job.
    const std = mexicano({}, 'warmup');
    const s1 = playRound(std.reducer, std.state, 0, score);
    expect(isRankGrouped(s1, 1)).toBe(true);
    expect(t(s1).rounds[1]).not.toEqual(t(s).rounds[1]);
  });

  it('takes over on round 2 when left at one', () => {
    const { reducer, state } = mexicano({}, 'standard');
    const s = playRound(reducer, state, 0, (i) => (i === 0 ? [24, 2] : [20, 6]));
    expect(isRankGrouped(s, 1)).toBe(true);
  });

  it('never repeats a partnership across the warm-up', () => {
    // This is why the warm-up continues the circle instead of reshuffling every
    // round: three independent random draws would pair someone twice.
    const { reducer, state } = mexicano({ drawRounds: 4 }, 'nodupes');
    let s = state;
    for (let r = 0; r < 4; r++) s = playRound(reducer, s, r, () => [12, 12]);

    const seen = new Map<string, number>();
    for (let r = 0; r < 4; r++) {
      for (const m of t(s).rounds[r]!.matches) {
        for (const team of [m.teamA, m.teamB]) {
          const k = [...team].sort().join('|');
          seen.set(k, (seen.get(k) ?? 0) + 1);
        }
      }
    }
    expect(Math.max(...seen.values()), 'a partnership repeated while warming up').toBe(1);
  });

  it('still puts everybody on court in every drawn round', () => {
    const { reducer, state } = mexicano({ drawRounds: 3 }, 'shape');
    let s = state;
    for (let r = 0; r < 3; r++) {
      const round = t(s).rounds[r]!;
      const on = round.matches.flatMap((m) => [...m.teamA, ...m.teamB]);
      expect(new Set(on).size, `round ${r} put somebody on twice`).toBe(8);
      s = playRound(reducer, s, r, () => [12, 12]);
    }
  });

  it('cannot be dropped below one — a mexicano with no draw is not one', () => {
    const { state } = mexicano({ drawRounds: 0 }, 'zero');
    expect(t(state).drawRounds).toBe(1);
  });

  it('is pinned at one for a format with no table to take over', () => {
    const { state } = mexicano({ format: 'americano', gamesPerRound: 7, drawRounds: 3 });
    expect(t(state).drawRounds).toBe(1);
  });

  it('can be changed mid-session without disturbing a score', () => {
    const { reducer, state } = mexicano({}, 'midway');
    const scored = playRound(reducer, state, 0, (i) => (i === 0 ? [24, 2] : [20, 6]));
    const before = computeStandings(t(scored)).map((r) => `${r.name}:${r.points}`);

    const changed = reducer(scored, { type: 'SET_DRAW_ROUNDS', rounds: 3 });
    expect(t(changed).drawRounds).toBe(3);
    expect(computeStandings(t(changed)).map((r) => `${r.name}:${r.points}`)).toEqual(before);
    // the round already on court is untouched
    expect(t(changed).rounds[1]).toEqual(t(scored).rounds[1]);
  });
});
