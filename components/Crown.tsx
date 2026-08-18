const TIERS = {
  1: { fill: '#f5b301', label: 'First place' },
  2: { fill: '#c2c8d0', label: 'Second place' },
  3: { fill: '#bd7b42', label: 'Third place' },
} as const;

export type CrownTier = keyof typeof TIERS;

export function isCrownTier(n: number): n is CrownTier {
  return n === 1 || n === 2 || n === 3;
}

export function Crown({ tier, className = 'h-5 w-5' }: { tier: CrownTier; className?: string }) {
  const { fill, label } = TIERS[tier];
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label={label}>
      <path
        fill={fill}
        d="M3 8.5a1.4 1.4 0 1 1 1.9 1.31l1.2 4.06h11.8l1.2-4.06A1.4 1.4 0 1 1 21 8.5a1.4 1.4 0 0 1-.8 1.26l-.02.01-3.1 2.1-3.02-4.2A1.4 1.4 0 1 0 12 7.6a1.4 1.4 0 0 0-2.06.07l-3.02 4.2-3.1-2.1-.02-.01A1.4 1.4 0 0 1 3 8.5Z"
      />
      <rect x="5.6" y="15.6" width="12.8" height="2.4" rx="0.8" fill={fill} />
    </svg>
  );
}
