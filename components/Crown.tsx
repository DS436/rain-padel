/**
 * A medal crown for the top three places — gold, silver, bronze.
 *
 * The same Lucide crown as `CrownIcon`, so the one crown shape appears across
 * the app, but filled rather than stroked: here the colour is the whole
 * message (which place), and a 2px outline at 16px does not carry enough of it
 * to tell silver from bronze at arm's length.
 */
const TIERS = {
  1: { fill: 'var(--color-gold)', label: 'First place' },
  2: { fill: '#b4bac4', label: 'Second place' },
  3: { fill: '#bd7b42', label: 'Third place' },
} as const;

export type CrownTier = keyof typeof TIERS;

export function isCrownTier(n: number): n is CrownTier {
  return n === 1 || n === 2 || n === 3;
}

export function Crown({ tier, className = 'h-5 w-5' }: { tier: CrownTier; className?: string }) {
  const { fill, label } = TIERS[tier];
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} role="img" aria-label={label}>
      <path
        fill={fill}
        stroke={fill}
        strokeWidth={1.5}
        strokeLinejoin="round"
        d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"
      />
      <rect x="5" y="19.25" width="14" height="2.25" rx="1.1" fill={fill} />
    </svg>
  );
}
