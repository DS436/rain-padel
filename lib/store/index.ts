import type { Id, Tournament, TournamentStatus } from '@/lib/types';
import { SCHEMA_VERSION } from '@/lib/types';

/**
 * Persistence boundary — spec section 6, unchanged.
 *
 * The Promise returns were in the spec so a network-backed implementation
 * could drop in without touching call sites. That is exactly what happened:
 * v1 ships Supabase, not localStorage.
 */
export interface TournamentStore {
  list(): Promise<TournamentSummary[]>;
  /** Every session in full. Only the player profiles page needs this — it has
   *  to fold career stats out of the rounds, which summaries do not carry. */
  listAll(): Promise<Tournament[]>;
  get(id: Id): Promise<Tournament | null>;
  /** The read-only lookup a spectator's link resolves through. */
  getByShareCode(code: string): Promise<Tournament | null>;
  save(t: Tournament): Promise<void>;
  remove(id: Id): Promise<void>;
}

export interface TournamentSummary {
  id: Id;
  name: string;
  createdAt: number;
  status: TournamentStatus;
  playerCount: number;
}

export function summarize(t: Tournament): TournamentSummary {
  return {
    id: t.id,
    name: t.name,
    createdAt: t.createdAt,
    status: t.status,
    playerCount: t.players.length,
  };
}

/**
 * Coerce a stored blob into a current-schema Tournament.
 * Returns null for anything unrecognisable rather than throwing — a single
 * corrupt row must not take down the tournament list.
 */
export function migrate(raw: unknown): Tournament | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Partial<Tournament>;
  if (typeof t.id !== 'string' || !Array.isArray(t.players) || !Array.isArray(t.rounds)) {
    return null;
  }
  return {
    ...(t as Tournament),
    // pre-versioning rows are treated as v1
    schemaVersion: typeof t.schemaVersion === 'number' ? t.schemaVersion : SCHEMA_VERSION,
    status: t.status === 'finished' ? 'finished' : 'live',
    currentRound: typeof t.currentRound === 'number' ? t.currentRound : 0,
    // added after the first sessions were stored
    courtEndsAt: typeof t.courtEndsAt === 'number' ? t.courtEndsAt : null,
    // v2. A v1 session was scored one slate at a time and its round numbers are
    // on the printout in someone's chat, so it keeps 1 game per round and reads
    // exactly as it did — only new sessions get real cycles.
    mode: t.mode === 'teams' ? 'teams' : 'individual',
    teams: Array.isArray(t.teams) ? t.teams : [],
    // v3. Both are opt-in features a v1/v2 session never had, and both read
    // correctly as "not this session" rather than needing a backfill.
    mixed: isMixedDraw(t.mixed) ? t.mixed : null,
    knockout: isKnockout(t.knockout) ? t.knockout : null,
    gamesPerRound:
      typeof t.gamesPerRound === 'number' && t.gamesPerRound >= 1
        ? Math.floor(t.gamesPerRound)
        : 1,
    // v4. A session that predates sharing has never been shared, which is
    // exactly what null means — no backfill, and no code handed out by accident.
    share: isShare(t.share) ? t.share : null,
  };
}

function isMixedDraw(v: unknown): v is Tournament['mixed'] {
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray((v as { names?: unknown }).names) &&
    (v as { names: unknown[] }).names.length === 2
  );
}

function isShare(v: unknown): v is Tournament['share'] {
  return !!v && typeof v === 'object' && typeof (v as { code?: unknown }).code === 'string';
}

function isKnockout(v: unknown): v is Tournament['knockout'] {
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray((v as { pairs?: unknown }).pairs) &&
    typeof (v as { fromGame?: unknown }).fromGame === 'number'
  );
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
