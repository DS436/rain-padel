'use client';

/**
 * Places gained since the halfway game — the up/down everyone wants to see.
 *
 * Lives on its own because it is read in three places that otherwise share
 * nothing: the scoreboard row, the chart legend and the player spotlight.
 */
export function Drift({ value }: { value: number }) {
  if (value === 0) return null;
  const up = value > 0;
  return (
    <span
      className={`nums inline-flex items-center gap-0.5 ${up ? 'text-accent' : 'text-danger'}`}
      title={up ? `Up ${value} since halfway` : `Down ${-value} since halfway`}
    >
      {up ? '▲' : '▼'}
      {Math.abs(value)}
    </span>
  );
}
