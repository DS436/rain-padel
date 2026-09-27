import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { ReactNode } from 'react';
import { ArrowRight, ChevronRight } from '@/components/icons';

/**
 * The marketing shell.
 *
 * Extracted out of the landing page the moment there was a second public page
 * to put it on. Everything here is a server component — these pages are static
 * and there is nothing on them to hydrate.
 *
 * Same cobalt language as the app: a light ground, white cards with a soft
 * shadow, grouped rows split by hairlines instead of a bordered box per
 * thing, and one accent. The public pages used to have their own darker,
 * glowier look; somebody who reads the rules and then signs in should not feel
 * they have changed websites.
 */

export function Ball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
      <path
        d="M4 7.5c5 1.5 11 1.5 16 0M4 16.5c5-1.5 11-1.5 16 0"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        opacity="0.6"
      />
    </svg>
  );
}

/** The accent button, as a link. Full width on a phone, its own width above. */
export const PRIMARY_LINK =
  'inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-7 text-base font-semibold text-accent-ink transition-opacity active:opacity-80 sm:w-auto';

/** The second way on — a word and an arrow, never a second button. */
export const QUIET_LINK =
  'inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-[15px] font-medium text-ink-dim transition-colors hover:text-ink';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 bg-ground shadow-[0_1px_0_var(--color-line)]">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 py-1 pl-6 pr-3">
        <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2">
          <Ball className="h-[22px] w-[22px]" />
          <span className="text-base font-semibold text-ink-dim">Rain Padel</span>
        </Link>
        {/* On a phone the two content links do not fit next to Sign in, and
            Sign in is the one that has to survive — the others are repeated in
            the footer and in the body of the page. */}
        <nav className="flex items-center">
          <span className="hidden items-center sm:flex">
            <NavLink href="/how-to-play">Padel rules</NavLink>
            <NavLink href="/guide">Using the app</NavLink>
          </span>
          <NavLink href="/watch">Watch</NavLink>
          <ThemeToggle />
          <Link
            href="/login"
            className="inline-flex min-h-11 shrink-0 items-center px-3 text-[15px] font-semibold text-accent-text"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-3 text-[15px] text-ink-dim transition-colors hover:text-ink"
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="shadow-[0_-1px_0_var(--color-line)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-6 py-6 text-[13px] text-ink-faint sm:flex-row sm:justify-between">
        <span className="flex items-center gap-2">
          <Ball className="h-4 w-4" />
          Rain Padel
        </span>
        <span className="flex flex-wrap items-center justify-center gap-x-6">
          <Link href="/how-to-play" className="inline-flex min-h-11 items-center hover:text-ink">
            How to play padel
          </Link>
          <Link href="/guide" className="inline-flex min-h-11 items-center hover:text-ink">
            How to use the app
          </Link>
          <Link href="/watch" className="inline-flex min-h-11 items-center hover:text-ink">
            Watch with a code
          </Link>
        </span>
      </div>
    </footer>
  );
}

/** A public page that is mostly words: a title, a standfirst and sections. */
export function ArticlePage({
  eyebrow,
  title,
  standfirst,
  children,
}: {
  eyebrow: string;
  title: string;
  standfirst: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-20 pt-10 sm:pt-16">
        <p className="text-sm text-ink-faint">{eyebrow}</p>
        <h1 className="mt-1.5 text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[44px] sm:tracking-[-0.035em]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-ink-dim">
          {standfirst}
        </p>
        <div className="mt-12 flex flex-col gap-12">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function Section({
  id,
  heading,
  children,
}: {
  id?: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-4">
      <h2 className="text-balance text-[22px] font-semibold tracking-[-0.01em] sm:text-[28px] sm:tracking-[-0.02em]">
        {heading}
      </h2>
      <div className="flex flex-col gap-4 text-pretty text-base leading-relaxed text-ink-dim">
        {children}
      </div>
    </section>
  );
}

/**
 * A run of `Point`s: one white card, split by hairlines. Every Point sits in
 * one of these, even a lone one — a card per rule was the old look.
 */
export function Points({ children }: { children: ReactNode }) {
  return <div className="card divide-y divide-line overflow-hidden">{children}</div>;
}

/** A named rule or step, with the explanation under it. A row of `Points`. */
export function Point({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="px-5 py-4">
      <h3 className="text-base font-semibold text-ink">{term}</h3>
      <div className="mt-1.5 flex flex-col gap-2 text-[15px] leading-relaxed text-ink-dim">
        {children}
      </div>
    </div>
  );
}

/**
 * The thing people get wrong, called out so it is skimmable. The one tinted
 * block on a section, and never more than that.
 */
export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="rounded-2xl bg-accent-soft px-5 py-4">
      <h3 className="text-base font-semibold text-accent-text">{title}</h3>
      <div className="mt-1.5 flex flex-col gap-2 text-[15px] leading-relaxed text-ink-dim">
        {children}
      </div>
    </aside>
  );
}

/** Numbered steps, for the walkthrough: one card, a hairline between steps. */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="card divide-y divide-line overflow-hidden">{children}</ol>;
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 px-5 py-4">
      <span
        aria-hidden
        className="nums flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-ink-dim"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <div className="mt-1.5 flex flex-col gap-2 text-[15px] leading-relaxed text-ink-dim">
          {children}
        </div>
      </div>
    </li>
  );
}

/** The end of an article: one accent link and one quiet one. */
export function NextSteps({
  primary,
  secondary,
}: {
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
      <Link href={primary.href} className={PRIMARY_LINK}>
        {primary.label}
      </Link>
      {secondary ? (
        <Link href={secondary.href} className={QUIET_LINK}>
          {secondary.label}
          <ArrowRight size="sm" />
        </Link>
      ) : null}
    </div>
  );
}

/** A tappable row inside a card — title, a sentence, a chevron. */
export function LinkRow({
  href,
  title,
  children,
  external = false,
}: {
  href: string;
  title: ReactNode;
  children?: ReactNode;
  external?: boolean;
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-base font-semibold text-ink">{title}</span>
        {children ? (
          <span className="text-pretty text-[15px] leading-relaxed text-ink-dim">{children}</span>
        ) : null}
      </span>
      <ChevronRight size="sm" className="text-ink-faint" />
    </>
  );
  const cls = 'flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/50 active:bg-surface-2';
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}
