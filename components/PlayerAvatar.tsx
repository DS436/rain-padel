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
 * The redesign's avatar ladder: 20 / 26 / 30 / 44 / 56.
 *
 * Five steps and no others, so a face is always one of five known sizes and
 * rows line up down the screen. `lg` is the roster picker and nothing else —
 * it is the one screen where you are aiming at a face rather than reading it.
 */
const SIZES = {
  xs: 'h-5 w-5 text-[8.5px]',
  sm: 'h-[26px] w-[26px] text-[10px]',
  md: 'h-[30px] w-[30px] text-xs',
  lg: 'h-11 w-11 text-base',
  xl: 'h-14 w-14 text-[22px]',
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
  size = 'sm',
  ring = 'var(--color-surface)',
  overflow,
}: {
  people: { name: string; color: string | undefined }[];
  size?: 'xs' | 'sm' | 'md';
  ring?: string;
  /** "+4" chip closing the stack, when the list is longer than it shows */
  overflow?: number;
}) {
  const pull = size === 'md' ? '-ml-2' : '-ml-[7px]';
  return (
    <span className="flex pl-[7px]">
      {people.map((p, i) => (
        <span
          key={`${p.name}-${i}`}
          aria-hidden
          style={{ backgroundColor: p.color ?? FALLBACK_COLOR, borderColor: ring }}
          className={`${SIZES[size]} ${pull} inline-flex shrink-0 items-center justify-center rounded-full border-2 font-semibold text-white`}
        >
          {initial(p.name)}
        </span>
      ))}
      {overflow && overflow > 0 ? (
        <span
          aria-hidden
          style={{ borderColor: ring }}
          className={`${SIZES[size]} ${pull} inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-surface-2 font-semibold text-ink-dim`}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
