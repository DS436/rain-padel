'use client';

/**
 * Places gained or lost — the up/down everyone wants to see.
 *
 * Lives on its own because the same arrow is read in several places that
 * otherwise share nothing: the scoreboard row (places since the previous
 * game), the player spotlight (places since halfway) and the side column on a
 * laptop. Drawn as the cobalt list's plain "↑1" / "↓2": a climb in the accent's
 * text colour, a fall in faint grey rather than red, because dropping a place
 * mid-table is ordinary and the board should not shout about it.
 *
 * `since` only changes the tooltip, so the arrow always says what it counts.
 */
export function Drift({
  value,
  since = 'halfway',
  className = '',
}: {
  value: number;
  since?: string;
  className?: string;
}) {
  if (value === 0) return null;
  const up = value > 0;
  return (
    <span
      className={`nums text-xs ${up ? 'text-accent-text' : 'text-ink-faint'} ${className}`}
      title={up ? `Up ${value} since ${since}` : `Down ${-value} since ${since}`}
    >
      {up ? '↑' : '↓'}
      {Math.abs(value)}
    </span>
  );
}
