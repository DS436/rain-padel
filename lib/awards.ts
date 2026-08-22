import type { Id, StandingRow, Tournament } from '@/lib/types';
import type { Progression, PlayerSeries } from '@/lib/progression';
import { spreads } from '@/lib/progression';
import { resultsText } from '@/lib/format';
import { seededRng } from '@/lib/rng';

/**
 * What the night is worth saying out loud.
 *
 * The standings answer who won. Nobody reads a table twice — what gets read
 * out in the car park is "you were fourth AGAIN" and "he won three on the
 * bounce", so this turns the same derived numbers into a line per finishing
 * place and a handful of superlatives.
 *
 * Two rules keep it from grating:
 *
 *   1. **Nothing is invented.** Every line is a restatement of a number that is
 *      already on the scoreboard. There is no consolation copy, because people
 *      see straight through it — last place gets a joke, not a hug.
 *   2. **It varies, but it does not flicker.** The wording is picked with a
 *      seeded RNG keyed on the session and the player, so two different nights
 *      read differently while the same night reads the same on every reload and
 *      on everybody's phone. Using `Math.random()` here would reshuffle the
 *      copy under the organiser's thumb every time React re-rendered.
 */

export interface FinishLine {
  playerId: Id;
  position: number;
  /** the one-liner under the name */
  line: string;
  /** short award word, or null for the anonymous middle of the table */
  badge: string | null;
  emoji: string | null;
}

export interface Superlative {
  key: string;
  emoji: string;
  /** the award */
  title: string;
  playerId: Id;
  name: string;
  /** the number that earned it */
  detail: string;
}

/* --------------------------- per-position copy --------------------------- */

const FIRST = [
  'Champion. Everyone else was playing for second.',
  'Top of the pile on {points} points. No arguments.',
  'Won the night. The next round is on you.',
  'First. That is the whole sentence.',
];

const SECOND = [
  'Runner-up by {gap}. One more game and who knows.',
  'Silver — the most annoying medal there is.',
  'Second, and closer than the table makes it look.',
];

const THIRD = [
  'Bronze, and still in the photograph.',
  'Third by {gap}. Held on to the podium.',
  'On the podium and nobody can take it back.',
];

const FOURTH = [
  'Fourth — first out of the medals, the worst seat in the house.',
  'Missed the podium by {gap}. Next week.',
  'Fourth. So near, and yet exactly one place away.',
];

const FIFTH = [
  'Fifth. Comfortably in the conversation, never in the lead.',
  'Fifth, {points} banked, no drama.',
];

const MIDDLE = [
  '{ordinal} of {total}. Somewhere in the thick of it.',
  'Mid-table and entirely unbothered.',
  '{ordinal}. Played {games}, won {wins}, said little.',
];

const LAST = [
  'Wooden spoon. Somebody has to carry it.',
  'Last on the board — and still {games} games up on everyone who stayed home.',
  'Bottom of the pile. The draw was against you all night.',
];

/**
 * One line per player, ordered as the standings are.
 *
 * Podium places and last place always get their own copy: those are the four
 * results anybody remembers, and a generic "climbed two places" would be a
 * worse thing to read than "champion". Everywhere else a notable run or climb
 * outranks the positional line, because in mid-table the movement IS the story.
 */
export function finishLines(
  t: Tournament,
  rows: StandingRow[],
  progression: Progression,
): FinishLine[] {
  const byId = new Map(progression.series.map((s) => [s.playerId, s] as const));
  const total = rows.length;

  return rows.map((row, i) => {
    const series = byId.get(row.playerId);
    const above = rows[i - 1];
    const gap = above ? above.points - row.points : 0;
    const pick = <T,>(list: T[]): T =>
      list[Math.floor(seededRng(t.id, row.playerId, row.position)() * list.length)]!;

    const fill = (s: string) =>
      s
        .replace('{points}', String(row.points))
        .replace('{games}', String(row.played))
        .replace('{wins}', String(row.wins))
        .replace('{total}', String(total))
        .replace('{ordinal}', ordinal(row.position))
        .replace('{gap}', gap === 0 ? 'nothing at all' : `${gap} point${gap === 1 ? '' : 's'}`);

    if (row.played === 0) {
      return {
        playerId: row.playerId,
        position: row.position,
        line: 'Never made it onto court.',
        badge: null,
        emoji: null,
      };
    }

    const isLast = row.position === total && total >= 4;

    if (row.position === 1) {
      return { playerId: row.playerId, position: 1, line: fill(pick(FIRST)), badge: 'Champion', emoji: '🏆' };
    }
    if (row.position === 2) {
      return { playerId: row.playerId, position: 2, line: fill(pick(SECOND)), badge: 'Runner-up', emoji: '🥈' };
    }
    if (row.position === 3) {
      return { playerId: row.playerId, position: 3, line: fill(pick(THIRD)), badge: 'Podium', emoji: '🥉' };
    }
    if (isLast) {
      return {
        playerId: row.playerId,
        position: row.position,
        line: fill(pick(LAST)),
        badge: 'Wooden spoon',
        emoji: '🥄',
      };
    }

    // Mid-table: a run or a climb beats the fact of being seventh.
    const notable = series ? notableLine(series) : null;
    if (notable) {
      return { playerId: row.playerId, position: row.position, line: notable, badge: null, emoji: null };
    }

    const bucket = row.position === 4 ? FOURTH : row.position === 5 ? FIFTH : MIDDLE;
    return { playerId: row.playerId, position: row.position, line: fill(pick(bucket)), badge: null, emoji: null };
  });
}

function notableLine(s: PlayerSeries): string | null {
  if (s.streak >= 3) return `Finished on ${s.streak} straight wins. Peaked at exactly the wrong time.`;
  if (s.drift >= 3) return `Climbed ${s.drift} places after halfway. Late surge, short night.`;
  if (s.drift <= -3) return `Led the chasing pack at halfway, then dropped ${-s.drift}.`;
  if (s.streak <= -3) return `${-s.streak} losses to close out. It turns.`;
  return null;
}

/* ----------------------------- superlatives ----------------------------- */

/**
 * The awards nobody plays for and everybody wants.
 *
 * Each one is the argmax of something already derived, so they cost nothing and
 * cannot disagree with the table. Anything that needs a real sample — the
 * steadiness pair especially — is gated on `rated` (three games) rather than
 * handed to whoever happened to play once and score fourteen.
 */
export function superlatives(
  t: Tournament,
  rows: StandingRow[],
  progression: Progression,
): Superlative[] {
  const out: Superlative[] = [];
  const played = rows.filter((r) => r.played > 0);
  if (played.length === 0) return out;

  const byId = new Map(progression.series.map((s) => [s.playerId, s] as const));
  const nameOf = (id: Id) => byId.get(id)?.name ?? rows.find((r) => r.playerId === id)?.name ?? '';
  const add = (key: string, emoji: string, title: string, playerId: Id, detail: string) =>
    out.push({ key, emoji, title, playerId, name: nameOf(playerId), detail });

  const rated = spreads(progression).filter((s) => s.rated);

  // The one that was actually asked for: whose games all looked the same.
  const steadiest = rated[0];
  if (steadiest) {
    add(
      'metronome',
      '📏',
      'Most consistent',
      steadiest.playerId,
      `${steadiest.mean} a game, never more than ±${steadiest.deviation} off it`,
    );
  }

  // ...and its opposite, which is usually the more entertaining night.
  const wildest = rated[rated.length - 1];
  if (wildest && rated.length >= 3 && wildest.deviation > (steadiest?.deviation ?? 0)) {
    add(
      'rollercoaster',
      '🎢',
      'All or nothing',
      wildest.playerId,
      `${wildest.low} at worst, ${wildest.high} at best`,
    );
  }

  const climber = best(progression.series, (s) => s.drift);
  if (climber && climber.drift >= 2) {
    add('climber', '🚀', 'Climber of the night', climber.playerId, `Up ${climber.drift} places since halfway`);
  }

  const faller = best(progression.series, (s) => -s.drift);
  if (faller && faller.drift <= -2) {
    add('faller', '🪂', 'Long way down', faller.playerId, `Down ${-faller.drift} places since halfway`);
  }

  const runner = best(progression.series, (s) => s.streak);
  if (runner && runner.streak >= 3) {
    add('streak', '🔥', 'Hot streak', runner.playerId, `${runner.streak} wins in a row`);
  }

  const hammer = best(progression.series, (s) => s.best);
  if (hammer && hammer.best > 0) {
    add('hammer', '💥', 'Biggest game', hammer.playerId, `${hammer.best} points in one game`);
  }

  // Fewest conceded per game — the defensive award, and the only one that
  // rewards a losing night, because a tight 11–13 still shows up here.
  const wall = played.reduce((b, r) => (r.conceded / r.played < b.conceded / b.played ? r : b));
  add(
    'wall',
    '🧱',
    'Hardest to score against',
    wall.playerId,
    `${Math.round((wall.conceded / wall.played) * 10) / 10} conceded a game`,
  );

  // Only interesting when somebody actually sat out.
  const mostGames = Math.max(...played.map((r) => r.played));
  const fewestGames = Math.min(...played.map((r) => r.played));
  if (mostGames > fewestGames) {
    const iron = played.find((r) => r.played === mostGames)!;
    add('iron', '🫀', 'Never off court', iron.playerId, `${iron.played} games played`);
  }

  return out;
}

function best(series: PlayerSeries[], score: (s: PlayerSeries) => number): PlayerSeries | null {
  let bestOne: PlayerSeries | null = null;
  for (const s of series) {
    if (s.points.every((p) => p.result === 'rest')) continue;
    if (!bestOne || score(s) > score(bestOne)) bestOne = s;
  }
  return bestOne;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/* --------------------------------- share --------------------------------- */

/**
 * The WhatsApp paste, with the awards under the table.
 *
 * It lives here rather than in `lib/format.ts` on purpose: awards depend on the
 * progression, the progression depends on `format` for display names, and
 * putting the join in `format` would close that loop into a cycle.
 */
export function shareText(
  t: Tournament,
  rows: StandingRow[],
  progression: Progression,
): string {
  const awards = superlatives(t, rows, progression);
  if (awards.length === 0) return resultsText(t);
  return [
    resultsText(t),
    '',
    ...awards.map((a) => `${a.emoji} ${a.title}: ${a.name} — ${a.detail}`),
  ].join('\n');
}
