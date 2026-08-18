import type { Id, Player } from '@/lib/types';

/**
 * Colours are handed out by position in the roster, not by hashing the id.
 * Hashing looked fine in theory and terrible in practice — an eight-player
 * session came out with three near-identical pinks. Walking the palette in
 * order guarantees every player in a group of twelve is visually distinct, and
 * entry order never changes, so the colour is stable across reloads too.
 *
 * Deliberately no lime here — that hue is the accent and means "points", so
 * avatars must not compete with it.
 */
const PALETTE = [
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

export function playerColors(players: readonly Player[]): Map<Id, string> {
  return new Map(players.map((p, i) => [p.id, PALETTE[i % PALETTE.length]!]));
}

export const FALLBACK_COLOR = '#7f8fa3';

export function initial(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
}

const SIZES = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-14 w-14 text-xl',
} as const;

export function PlayerAvatar({
  name,
  color,
  size = 'md',
  dimmed = false,
}: {
  name: string;
  color: string | undefined;
  size?: keyof typeof SIZES;
  dimmed?: boolean;
}) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: color ?? FALLBACK_COLOR }}
      className={`${SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        dimmed ? 'opacity-40' : ''
      }`}
    >
      {initial(name)}
    </span>
  );
}
