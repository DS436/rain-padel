import type { Id, Match, Round, Tournament } from '@/lib/types';
import { SCHEMA_VERSION } from '@/lib/types';

/** Deterministic id generator for tests: p0, p1, ... or m0, m1, ... */
export function counterIds(prefix = 'x'): () => Id {
  let n = 0;
  return () => `${prefix}${n++}`;
}

export function makePlayers(n: number): Tournament['players'] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Player ${i}`,
    active: true,
  }));
}

export function makeMatch(over: Partial<Match> & Pick<Match, 'id' | 'teamA' | 'teamB'>): Match {
  return { courtIndex: 0, scoreA: null, scoreB: null, startedAt: null, ...over };
}

export function makeRound(over: Partial<Round> & Pick<Round, 'index'>): Round {
  return { matches: [], resting: [], ...over };
}

export function makeTournament(over: Partial<Tournament> = {}): Tournament {
  const players = over.players ?? makePlayers(8);
  return {
    id: 'tournament-1',
    name: 'Tuesday Americano',
    createdAt: 1_700_000_000_000,
    format: 'americano',
    scoring: { mode: 'points', target: 24 },
    courts: 2,
    plannedRounds: 7,
    rounds: [],
    currentRound: 0,
    status: 'live',
    schemaVersion: SCHEMA_VERSION,
    ...over,
    players,
  };
}

export const ids = (n: number): Id[] => Array.from({ length: n }, (_, i) => `p${i}`);
