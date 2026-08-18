import { describe, expect, it } from 'vitest';
import { buildHistory, count, isRoundComplete, pairKey } from '@/lib/history';
import { projectHistory } from '@/lib/rounds';
import { makeMatch, makeRound, makeTournament } from './fixtures';

describe('pairKey', () => {
  it('is order independent for ids and for indices', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
    expect(pairKey(3, 11)).toBe(pairKey(11, 3));
  });

  it('does not collide across differently-ordered pairs', () => {
    expect(pairKey('p1', 'p2')).not.toBe(pairKey('p1', 'p3'));
  });
});

const twoRounds = () =>
  makeTournament({
    rounds: [
      makeRound({
        index: 0,
        matches: [
          makeMatch({ id: 'm0', teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], scoreA: 14, scoreB: 10 }),
        ],
        resting: ['p4', 'p5'],
      }),
      makeRound({
        index: 1,
        matches: [
          makeMatch({ id: 'm1', teamA: ['p0', 'p2'], teamB: ['p4', 'p5'], scoreA: 12, scoreB: 12 }),
        ],
        resting: ['p1', 'p3'],
      }),
    ],
    players: [0, 1, 2, 3, 4, 5].map((i) => ({ id: `p${i}`, name: `P${i}`, active: true })),
  });

describe('buildHistory', () => {
  it('counts each partnership, opposition, rest and appearance once', () => {
    const h = buildHistory(twoRounds());

    expect(count(h.partnered, pairKey('p0', 'p1'))).toBe(1);
    expect(count(h.partnered, pairKey('p0', 'p2'))).toBe(1);
    expect(count(h.opposed, pairKey('p0', 'p2'))).toBe(1); // round 0 only
    expect(count(h.opposed, pairKey('p0', 'p4'))).toBe(1); // round 1 only

    expect(count(h.rested, 'p4')).toBe(1);
    expect(count(h.rested, 'p1')).toBe(1);
    expect(count(h.played, 'p0')).toBe(2);
    expect(count(h.played, 'p1')).toBe(1);
  });

  it('honours the upToExclusive bound', () => {
    const h = buildHistory(twoRounds(), 1);
    expect(count(h.played, 'p0')).toBe(1);
    expect(count(h.rested, 'p1')).toBe(0);
    expect(count(h.partnered, pairKey('p0', 'p2'))).toBe(0);
  });

  it('counts scheduled appearances, not scored ones', () => {
    // rest fairness must not depend on whether the organiser typed the score in
    const t = twoRounds();
    t.rounds[1]!.matches[0]!.scoreA = null;
    t.rounds[1]!.matches[0]!.scoreB = null;
    expect(count(buildHistory(t).played, 'p0')).toBe(2);
  });
});

describe('projectHistory', () => {
  it('remaps to the new index space after a player leaves', () => {
    const t = twoRounds();
    const h = buildHistory(t);
    // p1 drops out; the roster becomes p0,p2,p3,p4,p5 -> indices 0..4
    const ids = ['p0', 'p2', 'p3', 'p4', 'p5'];
    const idx = projectHistory(h, ids);

    // p0/p2 partnered once; they are now indices 0 and 1
    expect(count(idx.partnered, pairKey(0, 1))).toBe(1);
    // p0/p1 partnered once, but p1 is gone, so that entry is dropped
    expect(idx.partnered.size).toBe(3);
    // rest counts follow their player
    expect(count(idx.rested, ids.indexOf('p4'))).toBe(1);
    expect(count(idx.played, ids.indexOf('p0'))).toBe(2);
  });

  it('gives a newly added player a clean slate', () => {
    const t = twoRounds();
    const ids = [...t.players.map((p) => p.id), 'p-new'];
    const idx = projectHistory(buildHistory(t), ids);
    expect(count(idx.rested, ids.indexOf('p-new'))).toBe(0);
    expect(count(idx.played, ids.indexOf('p-new'))).toBe(0);
  });
});

describe('isRoundComplete', () => {
  it('is true only when every match has both scores', () => {
    const scored = makeMatch({ id: 'a', teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], scoreA: 1, scoreB: 2 });
    const blank = makeMatch({ id: 'b', teamA: ['p4', 'p5'], teamB: ['p6', 'p7'] });
    expect(isRoundComplete(makeRound({ index: 0, matches: [scored] }))).toBe(true);
    expect(isRoundComplete(makeRound({ index: 0, matches: [scored, blank] }))).toBe(false);
    expect(isRoundComplete(makeRound({ index: 0, matches: [] }))).toBe(false);
    // a zero score is a real score
    expect(
      isRoundComplete(
        makeRound({
          index: 0,
          matches: [makeMatch({ id: 'c', teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], scoreA: 0, scoreB: 24 })],
        }),
      ),
    ).toBe(true);
  });
});
