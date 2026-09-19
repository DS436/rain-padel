import type { ReactNode } from 'react';

/**
 * Lucide geometry, inlined.
 *
 * The redesign asks for one icon language: Lucide drawn on a 24 grid with a
 * 2px stroke, rendered at 15px or 18px, and always `currentColor` so an icon
 * picks up whatever the surrounding text is. Inlining them rather than
 * pulling the package keeps the bundle honest — the app uses about twenty of
 * the eleven hundred icons Lucide ships, and these render on the server.
 *
 * `size` is the mock's two steps: `sm` (15px) for icons sitting inside text
 * or a label, `md` (18px) for a standalone control. Anything larger is a
 * one-off and passes a className.
 */

type IconProps = {
  /** 15px inside text and labels, 18px for a control on its own */
  size?: 'sm' | 'md';
  className?: string;
};

function Icon({
  size = 'md',
  className = '',
  children,
  round,
}: IconProps & { children: ReactNode; round?: boolean }) {
  const px = size === 'sm' ? 15 : 18;
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      aria-hidden
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin={round ? 'round' : 'round'}
    >
      {children}
    </svg>
  );
}

export function Plus(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Icon>
  );
}

export function Minus(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M5 12h14" />
    </Icon>
  );
}

export function ChevronRight(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

export function ChevronDown(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function ArrowLeft(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Icon>
  );
}

export function ArrowRight(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Icon>
  );
}

export function ArrowUpRight(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </Icon>
  );
}

export function Check(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function Clock(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  );
}

export function PauseCircle(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M10 15V9M14 15V9" />
    </Icon>
  );
}

export function Users(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

export function Share(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
      <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
    </Icon>
  );
}

export function BarChart(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </Icon>
  );
}

export function Trophy(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Icon>
  );
}

export function Eye(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function TrendingUp(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M16 7h6v6" />
      <path d="m22 7-8.5 8.5-5-5L2 17" />
    </Icon>
  );
}

export function TrendingDown(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M16 17h6v-6" />
      <path d="m22 17-8.5-8.5-5 5L2 7" />
    </Icon>
  );
}

/** The zigzag — an up-and-down night, not a trend. */
export function Activity(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 12h4l3 8 4-16 3 8h4" />
    </Icon>
  );
}

export function Flame(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 2c1 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 .5 1.5 1.5 2 2 2 0-3 1-5 1-7Z" />
    </Icon>
  );
}

export function Lock(p: IconProps) {
  return (
    <Icon {...p}>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  );
}

export function Copy(p: IconProps) {
  return (
    <Icon {...p}>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </Icon>
  );
}

export function RotateCcw(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 2v6h6" />
      <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
    </Icon>
  );
}

export function Undo(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </Icon>
  );
}

export function Zap(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m13 2-3 7h6l-3 7" />
      <path d="M6 12H3l2 10 6-6" />
      <path d="M18 12h3l-2 10-6-6" />
    </Icon>
  );
}

export function Grid(p: IconProps) {
  return (
    <Icon {...p}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v6M15 9v6M9 15v6" />
    </Icon>
  );
}

export function Equal(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 12h18" />
      <path d="M7 8v8M17 8v8" />
    </Icon>
  );
}

export function X(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function Timer(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M10 2h4" />
      <path d="M12 14v-4" />
      <circle cx="12" cy="14" r="8" />
    </Icon>
  );
}

/**
 * The crown on the leader.
 *
 * Gold rather than `currentColor` — it is the one icon in the set that means
 * something by its colour, so it does not inherit.
 */
export function CrownIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="var(--color-gold)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  );
}
