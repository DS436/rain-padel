import type { Id, Scoring, Tournament } from '@/lib/types';
import { computeStandings } from '@/lib/standings';
import { courtsInPlay } from '@/lib/rounds';

/**
 * Live feedback on the setup screen (spec 8.2) — this one line prevents most
 * "why is Ahmed sitting out again" questions before the session even starts.
 *
 * Note on spec 8.2's examples: it shows "capped at 3 courts" for 14 players on
 * 3 courts, but that configuration is not actually capped — 14 players can only
 * fill 3 courts anyway. The cap clause here fires on the case spec 9.3 actually
 * describes: the organiser set MORE courts than the roster can fill.
 */
export function feasibility(playerCount: number, courts: number): string {
  if (playerCount < 4) {
    const need = 4 - playerCount;
    return `Add ${need} more player${need === 1 ? '' : 's'} to start.`;
  }

  const inPlay = courtsInPlay(playerCount, courts);
  const resting = playerCount - inPlay * 4;

  const head = `${playerCount} player${playerCount === 1 ? '' : 's'} · ${courts} court${courts === 1 ? '' : 's'}`;
  const capped = courts > inPlay ? `only ${inPlay} court${inPlay === 1 ? '' : 's'} in use, ` : '';
  const tail =
    resting === 0
      ? 'everyone plays every round.'
      // note the verb agreement inverts: "1 player rests", "2 players rest"
      : `${resting} player${resting === 1 ? '' : 's'} rest${resting === 1 ? 's' : ''} each round.`;

  return `${head} — ${capped}${tail}`;
}

/** Rough wall-clock estimate. 10 minutes per round at a 24-point race. */
export function minutesPerRound(scoring: Scoring): number {
  return scoring.mode === 'points'
    ? Math.max(4, Math.round((scoring.target / 24) * 10))
    : scoring.minutes + 2; // changeover
}

export function estimateDuration(rounds: number, scoring: Scoring): string {
  return formatDuration(rounds * minutesPerRound(scoring));
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}m`;
}

/** Rounds after which partnerships start repeating (spec 9.4). */
export function cycleLength(playerCount: number): number {
  const m = playerCount % 2 === 0 ? playerCount : playerCount + 1;
  return Math.max(1, m - 1);
}

/**
 * Spec 9.8: two players called Ahmed is common. Keep both, and disambiguate
 * only the names that actually clash — untouched names stay untouched.
 */
export function displayNames(players: { id: Id; name: string }[]): Map<Id, string> {
  const counts = new Map<string, number>();
  for (const p of players) {
    const key = p.name.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  const out = new Map<Id, string>();
  for (const p of players) {
    const key = p.name.trim().toLowerCase();
    if ((counts.get(key) ?? 0) < 2) {
      out.set(p.id, p.name);
      continue;
    }
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    out.set(p.id, `${p.name} ${n}`);
  }
  return out;
}

/** Bulk paste from WhatsApp: split on newlines, commas or semicolons. */
export function parsePlayerNames(blob: string): string[] {
  return blob
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^\s*[-*\d.)\]]+\s*/, '').trim())
    .filter(Boolean);
}

export function scoringLabel(s: Scoring): string {
  return s.mode === 'points' ? `First to ${s.target}` : `${s.minutes} min rounds`;
}

/* --------------------------- results export --------------------------- */

/** Plain text shaped for pasting straight into WhatsApp (spec 8.4). */
export function resultsText(t: Tournament): string {
  const names = displayNames(t.players);
  const rows = computeStandings(t);
  const medals = ['🥇', '🥈', '🥉'];

  const lines = [
    `🎾 ${t.name}`,
    `${t.format === 'americano' ? 'Americano' : 'Mexicano'} · ${scoringLabel(t.scoring)} · ${playedRounds(t)} rounds`,
    '',
    ...rows.map((r) => {
      const badge = medals[r.position - 1] ?? `${r.position}.`;
      const dropped = r.active ? '' : ' (left early)';
      return `${badge} ${names.get(r.playerId) ?? r.name}${dropped} — ${r.points} pts`;
    }),
  ];
  return lines.join('\n');
}

export function resultsCsv(t: Tournament): string {
  const names = displayNames(t.players);
  const header = [
    'Position', 'Player', 'Points', 'Conceded', 'Difference',
    'Played', 'Wins', 'Draws', 'Losses', 'Active',
  ];
  const rows = computeStandings(t).map((r) => [
    r.position,
    names.get(r.playerId) ?? r.name,
    r.points,
    r.conceded,
    r.points - r.conceded,
    r.played,
    r.wins,
    r.draws,
    r.losses,
    r.active ? 'yes' : 'no',
  ]);
  return [header, ...rows].map((cols) => cols.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function playedRounds(t: Tournament): number {
  return t.rounds.filter((r) => r.matches.some((m) => m.scoreA !== null && m.scoreB !== null)).length;
}
