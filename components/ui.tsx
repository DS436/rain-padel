'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowLeft, ChevronRight, Minus, Plus } from '@/components/icons';

/**
 * The cobalt list's building blocks.
 *
 * The rules the redesign set, which everything here exists to make easy to
 * follow and hard to break:
 *
 * - one tinted element per card at most, and no accent side-borders
 * - grouped lists with hairlines instead of a card per thing
 * - one type family, three weights, five sizes (12 / 13–14 / 15–16 / 22–28 / 44)
 * - a single primary button per screen, always at the bottom
 * - secondary actions as icon + label in the bar
 * - every tap target 44px or more
 */

/** Every interactive target is at least 44px — this is used mid-match, one-thumbed. */
const TAP = 'min-h-11 min-w-11';

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */

const PRIMARY =
  'flex h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-5 text-base font-semibold text-accent-ink transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint';
const SECONDARY =
  'flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-surface-2 px-5 text-base font-semibold text-ink transition-opacity active:opacity-70 disabled:cursor-not-allowed disabled:text-ink-faint';
const QUIET =
  'flex min-h-11 w-full items-center justify-center gap-1.5 px-2 text-[15px] font-medium text-ink-dim active:opacity-70 disabled:opacity-40';

/**
 * The one thing the screen wants you to do. 54px, full width, and there is
 * only ever one of these on a screen — always at the bottom.
 */
export function PrimaryButton({
  href,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { href?: string }) {
  if (href) {
    return (
      <Link href={href} className={`${PRIMARY} ${className}`}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" {...props} className={`${PRIMARY} ${className}`}>
      {children}
    </button>
  );
}

/** The second choice in a sheet — grey, same weight, never the accent. */
export function SecondaryButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`${SECONDARY} ${className}`} />;
}

/** "Not yet", "Cancel finals" — a word you can tap, nothing more. */
export function QuietButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`${QUIET} ${className}`} />;
}

/**
 * The older three-variant button, kept for the places that pick a variant at
 * runtime. `primary` and `ghost` are the two buttons above; `danger` is a
 * red word, because destructive work never gets the accent.
 */
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: PRIMARY,
    ghost: SECONDARY,
    danger: `${QUIET} !text-danger`,
  }[variant];
  return <button type="button" {...props} className={`${styles} ${className}`} />;
}

/** A 44px square for an icon with no room for a word next to it. */
export function IconButton({
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-dim transition-opacity active:opacity-60 disabled:text-ink-faint ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * The bottom bar
 * ------------------------------------------------------------------ */

/**
 * The white bar pinned to the bottom of a working screen. Secondary actions
 * sit in it as `BarAction`s; the primary button takes the rest of the width.
 */
export function BottomBar({
  children,
  className = '',
  tone = 'surface',
}: {
  children: ReactNode;
  className?: string;
  /** `ground` for a setup screen, where the bar is just a place for the button */
  tone?: 'surface' | 'ground';
}) {
  return (
    <footer
      className={`fixed inset-x-0 bottom-0 z-20 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 ${
        tone === 'surface' ? 'bg-surface shadow-[0_-1px_0_var(--color-line)]' : 'bg-ground'
      }`}
    >
      <div className={`mx-auto w-full max-w-lg ${className}`}>{children}</div>
    </footer>
  );
}

/** Icon over a word, 56px wide — Finals, Finish, Copy, CSV. */
export function BarAction({
  icon,
  label,
  onClick,
  href,
  disabled,
  wide = false,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** 76px, for a row of four spread across the bar */
  wide?: boolean;
}) {
  const cls = `inline-flex min-h-11 flex-none flex-col items-center justify-center gap-[3px] text-[11px] font-medium text-ink-dim active:opacity-60 disabled:opacity-40 ${
    wide ? 'w-[76px]' : 'w-14'
  }`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {icon}
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {icon}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Headers
 * ------------------------------------------------------------------ */

/**
 * A setup screen's top: back on the left, an optional step count in the
 * middle, an optional action on the right.
 */
export function TopBar({
  back,
  middle,
  right,
}: {
  back?: { href?: string; onClick?: () => void; label?: string };
  middle?: ReactNode;
  right?: ReactNode;
}) {
  const backCls =
    'inline-flex h-11 w-11 flex-none items-center justify-center text-ink-dim active:opacity-60';
  return (
    <div className="flex items-center justify-between px-3 pt-1">
      {back ? (
        back.href ? (
          <Link href={back.href} aria-label={back.label ?? 'Back'} className={backCls}>
            <ArrowLeft />
          </Link>
        ) : (
          <button
            type="button"
            onClick={back.onClick}
            aria-label={back.label ?? 'Back'}
            className={backCls}
          >
            <ArrowLeft />
          </button>
        )
      ) : (
        <span className="w-11" />
      )}
      <span className="text-sm text-ink-faint">{middle}</span>
      {right ?? <span className="w-11" />}
    </div>
  );
}

/** 28px, the heading a setup screen asks its question in. */
export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="px-6 pt-2">
      <h1 className="text-pretty text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">
        {children}
      </h1>
      {sub ? <div className="mt-1.5 text-sm text-ink-faint">{sub}</div> : null}
    </div>
  );
}

/** Round / Standings / Schedule — words with an underline, not three buttons. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  trailing,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  trailing?: ReactNode;
}) {
  return (
    <div role="tablist" className="flex items-center gap-6 px-6">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-11 text-[15px] ${
            value === o.value
              ? 'font-semibold text-ink shadow-[inset_0_-2px_0_var(--color-accent)]'
              : 'text-ink-faint'
          }`}
        >
          {o.label}
        </button>
      ))}
      <span className="flex-1" />
      {trailing}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Grouped lists
 * ------------------------------------------------------------------ */

/** The small grey words above a group — "Format", "From your squad  4 more". */
export function GroupLabel({
  children,
  aside,
  className = '',
}: {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-2 mt-[18px] flex items-baseline justify-between px-1 text-[13px] text-ink-faint ${className}`}
    >
      <h2 className="font-normal">{children}</h2>
      {aside ? <span>{aside}</span> : null}
    </div>
  );
}

/** A white card holding rows, split by hairlines. */
export function Group({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'section';
}) {
  return (
    <Tag className={`card divide-y divide-line overflow-hidden ${className}`}>{children}</Tag>
  );
}

/**
 * One row of a group: an optional leading icon or face, a title with an
 * optional second line, and whatever sits on the right.
 */
export function ListRow({
  lead,
  title,
  sub,
  trailing,
  chevron = false,
  href,
  onClick,
  disabled,
  className = '',
  minH = 'min-h-14',
  ariaLabel,
  pressed,
}: {
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  minH?: string;
  ariaLabel?: string;
  pressed?: boolean;
}) {
  const body = (
    <>
      {lead ? <span className="flex flex-none text-ink-faint">{lead}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-medium">{title}</span>
        {sub ? <span className="text-xs text-ink-faint">{sub}</span> : null}
      </span>
      {trailing}
      {chevron ? <ChevronRight size="sm" className="text-ink-faint" /> : null}
    </>
  );
  const cls = `flex w-full items-center gap-3 px-4 text-left ${minH} ${
    disabled ? 'opacity-45' : ''
  } ${className}`;
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={`${cls} active:bg-surface-2`}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-pressed={pressed}
        className={`${cls} active:bg-surface-2 disabled:cursor-not-allowed`}
      >
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** The iOS-style switch the setup rows use. The whole row is the target. */
export function Switch({ on, disabled = false }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative h-[26px] w-11 flex-none rounded-[13px] shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors ${
        on ? 'bg-accent' : 'bg-surface-2'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left] ${
          on ? 'left-[21px]' : 'left-[3px]'
        }`}
      />
    </span>
  );
}

/** A switch row. `disabled` greys it when the format can't take the modifier. */
export function SwitchRow({
  title,
  sub,
  on,
  onChange,
  disabled = false,
}: {
  title: string;
  sub?: ReactNode;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left disabled:cursor-not-allowed ${
        disabled ? 'opacity-45' : 'active:bg-surface-2'
      }`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium">{title}</span>
        {sub ? <span className="text-xs text-ink-faint">{sub}</span> : null}
      </span>
      <Switch on={on} disabled={disabled} />
    </button>
  );
}

/** The radio dot — a ring, or a thick accent ring when chosen. */
export function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`h-[22px] w-[22px] flex-none rounded-full ${
        on
          ? 'shadow-[inset_0_0_0_7px_var(--color-accent)]'
          : 'shadow-[inset_0_0_0_1.5px_var(--color-ink-faint)]'
      }`}
    />
  );
}

/** – 2 + inside a row. The squares are 32px to look at and 44px to hit. */
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
    <span className="flex flex-none items-center">
      <StepButton
        icon={<Minus size="sm" />}
        aria={label ? `Fewer ${label}` : 'Decrease'}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      />
      <span className="nums min-w-7 text-center text-[17px] font-semibold">
        {value}
        {suffix ? <span className="ml-1 text-sm font-medium text-ink-dim">{suffix}</span> : null}
      </span>
      <StepButton
        icon={<Plus size="sm" />}
        aria={label ? `More ${label}` : 'Increase'}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      />
    </span>
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
      className={`${TAP} group inline-flex items-center justify-center text-ink-dim disabled:text-ink-faint/50`}
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] bg-surface-2 group-active:opacity-70">
        {icon}
      </span>
    </button>
  );
}

/**
 * A quiet segmented control — Race / Places / Steady, People / Pairs. A grey
 * well with the chosen option lifted onto white.
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
      className={`${inline ? 'inline-flex' : 'flex'} rounded-[11px] bg-surface-2 p-[3px]`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          // 38px inside a 3px well: the whole control is the 44px target
          className={`${inline ? 'px-4' : 'flex-1'} min-h-[38px] rounded-[8px] text-sm transition-colors ${
            value === o.value
              ? 'bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]'
              : 'font-medium text-ink-faint'
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
  suffix,
}: {
  options: number[];
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`${TAP} nums rounded-full px-4 text-[15px] font-semibold transition-colors ${
            value === o ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'
          }`}
        >
          {o}
          {suffix ? <span className="ml-1 font-medium opacity-70">{suffix}</span> : null}
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
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <SectionLabel>{label}</SectionLabel>
        {action}
      </div>
      {children}
      {hint ? <p className="px-1 text-[13px] text-ink-faint">{hint}</p> : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Text shapes
 * ------------------------------------------------------------------ */

/** The small grey label above a block. Sentence case, 13px. */
export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={`text-[13px] font-normal text-ink-faint ${className}`}>{children}</h2>;
}

/** A section label with a link on the right — "Table … Top 5". */
export function SectionHead({
  label,
  action,
}: {
  label: string;
  action?: { label: string; href?: string; onClick?: () => void; accent?: boolean };
}) {
  return (
    <div className="flex items-center justify-between px-1">
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
  const cls = `-mr-1 inline-flex min-h-11 items-center gap-0.5 px-1 text-[13px] font-semibold ${
    accent ? 'text-accent-text' : 'text-ink-faint'
  }`;
  const body = (
    <>
      {label}
      <ChevronRight size="sm" />
    </>
  );
  if (href) {
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

/** The 12px grey line under a name — counts, records, formats. */
export function Meta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`nums text-xs text-ink-faint ${className}`}>{children}</span>;
}

/** A horizontal finger-scrolled rail — award cards, chips. */
export function Rail({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`scr flex gap-2 overflow-x-auto ${className}`}>{children}</div>;
}

/**
 * Six bars saying how the last six games went.
 *
 * Deliberately not a chart: no axis, no labels, no tooltip. It answers "are
 * they climbing or fading" at a glance from across a table row, and anyone who
 * wants the actual numbers taps through to the spotlight. `hot` lights the
 * bars in the accent for the players near the top.
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
          className={`flex-1 rounded-[1px] ${hot ? 'bg-accent' : 'bg-accent-soft'}`}
        />
      ))}
    </span>
  );
}
