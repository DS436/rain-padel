import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The marketing shell.
 *
 * Extracted out of the landing page the moment there was a second public page
 * to put it on. Everything here is a server component — these pages are static
 * and there is nothing on them to hydrate.
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

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line/60 bg-ground/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-5 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Ball className="h-6 w-6" />
          <span className="text-base font-semibold tracking-tight">Rain Padel</span>
        </Link>
        {/* On a phone the three content links do not fit next to Sign in, and
            Sign in is the one that has to survive — the others are repeated in
            the footer and in the body of the page. */}
        <nav className="flex items-center gap-0.5">
          <span className="hidden items-center gap-0.5 sm:flex">
            <NavLink href="/how-to-play">Padel rules</NavLink>
            <NavLink href="/guide">Using the app</NavLink>
          </span>
          <NavLink href="/watch">Watch</NavLink>
          <Link
            href="/login"
            className="ml-1 min-h-11 shrink-0 rounded-xl border border-line px-4 py-2 text-sm text-ink-dim transition-colors hover:text-ink active:bg-surface-2"
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
      className="min-h-11 shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm text-ink-dim transition-colors hover:text-ink"
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line/60 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-5 text-sm text-ink-faint sm:flex-row sm:justify-between">
        <span className="flex items-center gap-2">
          <Ball className="h-4 w-4" />
          Rain Padel
        </span>
        <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/how-to-play" className="hover:text-ink">
            How to play padel
          </Link>
          <Link href="/guide" className="hover:text-ink">
            How to use the app
          </Link>
          <Link href="/watch" className="hover:text-ink">
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-12 sm:pt-16">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {eyebrow}
        </p>
        <h1 className="text-balance text-[2.2rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-ink-dim">
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
    <section id={id} className="flex flex-col gap-4 scroll-mt-20">
      <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{heading}</h2>
      <div className="flex flex-col gap-4 text-pretty leading-relaxed text-ink-dim">{children}</div>
    </section>
  );
}

/** A named rule or step, with the explanation under it. */
export function Point({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-base font-semibold text-ink">{term}</h3>
      <div className="mt-2 flex flex-col gap-2 leading-relaxed text-ink-dim">{children}</div>
    </div>
  );
}

/** The thing people get wrong, called out so it is skimmable. */
export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="rounded-2xl border border-accent/30 bg-accent/[0.06] p-5">
      <h3 className="text-base font-semibold text-accent">{title}</h3>
      <div className="mt-2 flex flex-col gap-2 leading-relaxed text-ink-dim">{children}</div>
    </aside>
  );
}

/** Numbered steps, for the walkthrough. */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="flex flex-col gap-3">{children}</ol>;
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
      <span
        aria-hidden
        className="nums flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <div className="mt-2 flex flex-col gap-2 leading-relaxed text-ink-dim">{children}</div>
      </div>
    </li>
  );
}
