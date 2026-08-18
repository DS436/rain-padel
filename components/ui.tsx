'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Every interactive target is at least 44px — this is used mid-match, one-thumbed. */
const TAP = 'min-h-11 min-w-11';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary:
      'bg-accent text-accent-ink font-semibold disabled:bg-surface-2 disabled:text-ink-faint',
    ghost: 'bg-surface-2 text-ink border border-line disabled:text-ink-faint',
    danger: 'bg-transparent text-danger border border-danger/40',
  }[variant];

  return (
    <button
      {...props}
      className={`${TAP} inline-flex items-center justify-center gap-2 rounded-xl px-5 text-base transition-opacity active:opacity-70 disabled:cursor-not-allowed ${styles} ${className}`}
    />
  );
}

export function Stepper({
  value,
  min = 1,
  max = 99,
  onChange,
  suffix,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
      <StepButton label="−" disabled={value <= min} onClick={() => onChange(value - 1)} />
      <span className="nums w-16 text-center text-lg font-semibold">
        {value}
        {suffix ? <span className="ml-1 text-sm text-ink-dim">{suffix}</span> : null}
      </span>
      <StepButton label="+" disabled={value >= max} onClick={() => onChange(value + 1)} />
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label === '−' ? 'Decrease' : 'Increase'}
      onClick={onClick}
      disabled={disabled}
      className={`${TAP} rounded-lg text-xl font-semibold text-ink active:bg-surface-2 disabled:text-ink-faint`}
    >
      {label}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="inline-flex rounded-xl border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`${TAP} rounded-lg px-5 text-sm font-medium transition-colors ${
            value === o.value ? 'bg-accent text-accent-ink' : 'text-ink-dim'
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
          className={`${TAP} nums rounded-lg border px-4 text-base transition-colors ${
            value === o
              ? 'border-accent bg-accent/15 text-accent'
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
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">{label}</h2>
      {children}
      {hint ? <p className="text-sm text-ink-dim">{hint}</p> : null}
    </section>
  );
}
