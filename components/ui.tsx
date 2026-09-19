'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ChevronRight, Minus, Plus } from '@/components/icons';

/** Every interactive target is at least 44px — this is used mid-match, one-thumbed. */
const TAP = 'min-h-11 min-w-11';

/**
 * The three buttons the redesign allows.
 *
 * `primary` is 48px and set in the display face, because it is always the one
 * thing the screen wants you to do. `ghost` is 44px on a surface card.
 * `danger` stays an outline — destructive work never gets the accent.
 */
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary:
      'disp min-h-12 bg-accent text-accent-ink font-bold disabled:bg-surface-2 disabled:text-ink-faint',
    ghost: 'min-h-11 bg-surface text-ink font-semibold border border-line disabled:text-ink-faint',
    danger: 'min-h-11 bg-transparent text-danger font-semibold border border-danger/40',
  }[variant];

  return (
    <button
      {...props}
      className={`${TAP} inline-flex items-center justify-center gap-2 rounded-[14px] px-5 text-[0.9rem] transition-opacity active:opacity-70 disabled:cursor-not-allowed ${styles} ${className}`}
    />
  );
}

/** A 44px square for an icon with no room for a word next to it. */
export function IconButton({
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-dim transition-opacity active:opacity-70 disabled:text-ink-faint ${className}`}
    >
      {children}
    </button>
  );
}

export function Stepper({
  value,
  min = 1,
  max = 99,
  onChange,
  suffix,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  suffix?: string;
  /** used for the two aria-labels, so "More courts" beats "Increase" */
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-0.5">
      <StepButton
        icon={<Minus />}
        aria={label ? `Fewer ${label}` : 'Decrease'}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      />
      <span className="nums disp text-[17px] font-bold">
        {value}
        {suffix ? <span className="ml-1 text-sm font-medium text-ink-dim">{suffix}</span> : null}
      </span>
      <StepButton
        icon={<Plus />}
        aria={label ? `More ${label}` : 'Increase'}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      />
    </div>
  );
}

function StepButton({
  icon,
  aria,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  aria: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={aria}
      onClick={onClick}
      disabled={disabled}
      className={`${TAP} inline-flex items-center justify-center rounded-lg text-ink-dim active:bg-surface-2 disabled:text-ink-faint/40`}
    >
      {icon}
    </button>
  );
}

/**
 * The Court / Table / Schedule switch.
 *
 * Full-bleed by default because on the session screen it spans the width;
 * pass `inline` for the cases where it sits next to something else.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  inline = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  inline?: boolean;
}) {
  return (
    <div
      role="tablist"
      className={`${inline ? 'inline-flex' : 'flex'} gap-[3px] rounded-[11px] bg-surface p-[3px]`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`${TAP} ${inline ? 'px-4' : 'flex-1'} rounded-[9px] text-[12.5px] font-semibold transition-colors ${
            value === o.value ? 'bg-line text-ink' : 'text-ink-faint'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ChoiceChips({
  options,
  value,
  onChange,
}: {
  options: number[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`${TAP} nums rounded-xl border px-4 text-base font-semibold transition-colors ${
            value === o
              ? 'border-accent bg-accent/[0.09] text-accent'
              : 'border-line bg-surface text-ink-dim'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  action,
  children,
}: {
  label: string;
  hint?: ReactNode;
  /** trailing control on the label row — in practice always the "?" explainer */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SectionLabel>{label}</SectionLabel>
        {action}
      </div>
      {children}
      {hint ? <p className="text-sm text-ink-dim">{hint}</p> : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * The three text shapes the redesign repeats on every screen.
 * ------------------------------------------------------------------ */

/** Letterspaced uppercase, display face — the label above a block. */
export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`disp text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-faint ${className}`}
    >
      {children}
    </h2>
  );
}

/** A section label with a link on the right — "The board … Squad ›". */
export function SectionHead({
  label,
  action,
}: {
  label: string;
  action?: { label: string; href?: string; onClick?: () => void; accent?: boolean };
}) {
  return (
    <div className="flex items-center justify-between">
      <SectionLabel>{label}</SectionLabel>
      {action ? (
        <MoreLink
          href={action.href}
          onClick={action.onClick}
          accent={action.accent}
          label={action.label}
        />
      ) : null}
    </div>
  );
}

function MoreLink({
  label,
  href,
  onClick,
  accent,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  accent?: boolean;
}) {
  const cls = `-mr-0.5 inline-flex min-h-11 items-center gap-1 px-0.5 text-[11.5px] font-semibold ${
    accent ? 'text-accent' : 'text-ink-faint'
  }`;
  const body = (
    <>
      {label}
      <ChevronRight size="sm" />
    </>
  );
  if (href) {
    // `a` rather than `Link` so this stays usable from a server component too
    return (
      <a href={href} className={cls}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

/** The 9.5px mono line under a name — counts, records, formats. */
export function Meta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`nums font-mono text-[9.5px] font-medium text-ink-faint ${className}`}>
      {children}
    </span>
  );
}

/** A horizontal finger-scrolled rail — format cards, award cards, chips. */
export function Rail({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`scr flex gap-2 overflow-x-auto ${className}`}>{children}</div>;
}

/**
 * Six bars saying how the last six games went.
 *
 * Deliberately not a chart: no axis, no labels, no tooltip. It answers "are
 * they climbing or fading" at a glance from across a table row, and anyone who
 * wants the actual numbers taps through to the spotlight. `hot` lights the
 * bars in the accent for the players near the top, which is what makes the
 * podium legible without reading the ranks.
 */
export function Sparkline({
  values,
  max,
  hot = false,
  className = '',
}: {
  /** points scored per game, newest last; null for a game spent resting */
  values: (number | null)[];
  /** the top of the scale — the scoring target, or the best anyone managed */
  max: number;
  hot?: boolean;
  className?: string;
}) {
  if (values.length === 0) return null;
  const ceiling = Math.max(1, max);
  return (
    <span aria-hidden className={`flex h-[18px] items-end gap-0.5 ${className}`}>
      {values.map((v, i) => (
        <span
          key={i}
          style={{ height: `${Math.max(3, Math.round(((v ?? 0) / ceiling) * 18))}px` }}
          className={`flex-1 rounded-[1px] ${hot ? 'bg-accent/75' : 'bg-accent-dim'}`}
        />
      ))}
    </span>
  );
}
