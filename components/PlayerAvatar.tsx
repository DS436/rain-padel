import type { Id, Player } from '@/lib/types';

/**
 * Colours are handed out by position in the roster, not by hashing the id.
 * Hashing looked fine in theory and terrible in practice — an eight-player
 * session came out with three near-identical pinks. Walking the palette in
 * order guarantees every player in a group of twelve is visually distinct, and
 * entry order never changes, so the colour is stable across reloads too.
 *
 * Deliberately no cyan here — that hue is the accent and means "points", so
 * avatars must not compete with it. The teal and blue sit far enough down in
 * both lightness and chroma to read as "a person", never as "a score".
 */
export const PALETTE = [
  '#d95757', // red
  '#d97a45', // orange
  '#c9a13c', // amber
  '#4aa87a', // green
  '#2fa39c', // teal
  '#3f8ed0', // blue
  '#6470e8', // indigo
  '#9067e0', // violet
  '#bd5fc4', // purple
  '#d4569b', // pink
  '#7f8fa3', // slate
  '#b0724d', // brown
] as const;

/** The colour a player at this roster position will get once the night starts. */
export function colorAt(index: number): string {
  return PALETTE[index % PALETTE.length]!;
}

export function playerColors(players: readonly Player[]): Map<Id, string> {
  return new Map(players.map((p, i) => [p.id, PALETTE[i % PALETTE.length]!]));
}

export const FALLBACK_COLOR = '#7f8fa3';

export function initial(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
}

/**
 * The cobalt list's avatar ladder: 20 / 24 / 28 / 32 / 36 / 44 / 52.
 *
 * `md` (28) is a face on a court row or a table row; `row` (36) leads a
 * list row in the squad; `lg` and `xl` are the one face a card is about.
 */
const SIZES = {
  xs: 'h-5 w-5 text-[8px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-7 w-7 text-[11px]',
  pick: 'h-8 w-8 text-[13px]',
  row: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-lg',
  xl: 'h-[52px] w-[52px] text-[21px]',
} as const;

export function PlayerAvatar({
  name,
  color,
  size = 'md',
  dimmed = false,
  className = '',
}: {
  name: string;
  color: string | undefined;
  size?: keyof typeof SIZES;
  dimmed?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: color ?? FALLBACK_COLOR }}
      className={`${SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        dimmed ? 'opacity-40' : ''
      } ${className}`}
    >
      {initial(name)}
    </span>
  );
}

/**
 * Two or more faces overlapped, as on the court card and the "same again"
 * button. The ring is drawn in the colour of whatever the stack sits on, so
 * the overlap reads as depth rather than as a smudge — pass `ring` to match
 * the surface underneath.
 */
export function AvatarStack({
  people,
  size = 'md',
  ring = 'var(--color-surface)',
  overflow,
}: {
  people: { name: string; color: string | undefined }[];
  size?: 'xs' | 'sm' | 'md';
  ring?: string;
  /** "+4" chip closing the stack, when the list is longer than it shows */
  overflow?: number;
}) {
  const pull = size === 'md' ? '-ml-1.5' : '-ml-2';
  return (
    <span className="flex flex-none">
      {people.map((p, i) => (
        <span
          key={`${p.name}-${i}`}
          aria-hidden
          style={{ backgroundColor: p.color ?? FALLBACK_COLOR, boxShadow: `0 0 0 2px ${ring}` }}
          className={`${SIZES[size]} ${i === 0 ? '' : pull} inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}
        >
          {initial(p.name)}
        </span>
      ))}
      {overflow && overflow > 0 ? (
        <span
          aria-hidden
          style={{ boxShadow: `0 0 0 2px ${ring}` }}
          className={`${SIZES[size]} ${pull} inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-ink-dim`}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
