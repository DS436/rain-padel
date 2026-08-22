import Link from 'next/link';
import { Crown } from '@/components/Crown';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PadelNews } from '@/components/PadelNews';
import { Ball, SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { ALL_FORMATS, FORMAT_SPECS } from '@/lib/formats';

/**
 * The page is otherwise static; this makes it revalidate hourly so the
 * headlines stay current without any visitor waiting on somebody else's feed.
 *
 * It has to be a literal — Next reads segment config statically and rejects an
 * imported binding — so it is deliberately the same hour as
 * `NEWS_REVALIDATE_SECONDS` in `lib/news.ts`, which caches the fetch itself.
 */
export const revalidate = 3600;

export const metadata = {
  title: 'Rain Padel — Americano, Mexicano, King of the Court',
  description:
    'Enter who turned up. Rain Padel works out who partners whom on which court, keeps a running leaderboard as you type in scores, and gives everyone else a read-only link to follow it live.',
};

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TheRule />
        <Formats />
        <Learn />
        <PadelNews />
        <Features />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-16 pt-14 sm:pb-24 sm:pt-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-dim">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Americano · Mexicano · King of the Court · Winner Stays On
          </p>

          <h1 className="text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Everyone partners
            <br />
            everyone.{' '}
            <span className="text-accent">
              Nobody
              <br className="hidden sm:block" /> does the maths.
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-ink-dim">
            Type in who turned up. Rain Padel works out who plays with whom on which court, rotates
            the sit-outs fairly, and keeps a live leaderboard while you play.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center rounded-xl bg-accent px-6 font-semibold text-accent-ink transition-opacity active:opacity-70"
            >
              Sign in
            </Link>
            <Link
              href="/watch"
              className="inline-flex min-h-12 items-center rounded-xl border border-line px-6 text-ink-dim transition-colors hover:text-ink"
            >
              Watch with a code
            </Link>
          </div>

          <p className="mt-5 max-w-lg text-sm text-ink-faint">
            Only the person running the night signs in — it is invite only while it is being
            tested. Everyone else just needs the share code.
          </p>
        </div>

        <ScoreboardPreview />
      </div>
    </section>
  );
}

/** A real scoreboard, built from the same pieces the app uses. */
function ScoreboardPreview() {
  // Every player here has 8 matches, so the round counter has to say 8.
  const rows = [
    { name: 'Aman', color: '#d95757', w: 4, d: 2, l: 2, p: 69 },
    { name: 'Devansh', color: '#4aa87a', w: 4, d: 2, l: 2, p: 68 },
    { name: 'Burhan', color: '#2fa39c', w: 3, d: 2, l: 3, p: 65 },
    { name: 'Ahmed', color: '#9067e0', w: 3, d: 1, l: 4, p: 61 },
    { name: 'Joel', color: '#d97a45', w: 2, d: 1, l: 5, p: 57 },
  ];

  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2rem] bg-accent/5 blur-2xl" />
      <div className="rounded-2xl border border-line bg-surface/70 p-4 shadow-2xl shadow-black/40">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-sm font-medium">Tuesday padel</span>
          <span className="nums text-xs text-ink-faint">Round 8 of 8</span>
        </div>

        <div className="mb-2 grid grid-cols-[1.6rem_1fr_1.5rem_1.5rem_1.5rem_2.5rem] items-center gap-2 px-1 text-[10px] uppercase tracking-wider text-ink-faint">
          <span>#</span>
          <span>Players</span>
          <span className="text-center">W</span>
          <span className="text-center">D</span>
          <span className="text-center">L</span>
          <span className="text-right">P</span>
        </div>

        <ul className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <li
              key={r.name}
              className="grid grid-cols-[1.6rem_1fr_1.5rem_1.5rem_1.5rem_2.5rem] items-center gap-2 rounded-xl bg-surface px-1 py-2"
            >
              <span className="flex justify-center">
                {i < 3 ? (
                  <Crown tier={(i + 1) as 1 | 2 | 3} className="h-4 w-4" />
                ) : (
                  <span className="nums text-xs text-ink-faint">{i + 1}</span>
                )}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <PlayerAvatar name={r.name} color={r.color} size="sm" />
                <span className="truncate text-sm">{r.name}</span>
              </span>
              <span className="nums text-center text-xs text-ink-dim">{r.w}</span>
              <span className="nums text-center text-xs text-ink-dim">{r.d}</span>
              <span className="nums text-center text-xs text-ink-dim">{r.l}</span>
              <span className="nums text-right text-lg font-semibold text-accent">{r.p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TheRule() {
  return (
    <section id="the-rule" className="border-y border-line/60 bg-surface/30 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-5xl px-5">
        <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Your score is your own
        </h2>
        <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-ink-dim">
          This is the rule that makes the format work, and the one everyone gets wrong. You do not
          track wins. You track points — and both players on a side bank the whole team score.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <TeamCard names={['Devansh', 'Sara']} score={14} colors={['#d95757', '#c9a13c']} winner />
          <p className="text-center text-sm text-ink-faint sm:px-2">a 24-point match</p>
          <TeamCard names={['Marcus', 'Priya']} score={10} colors={['#3f8ed0', '#9067e0']} />
        </div>

        <p className="mt-8 max-w-2xl text-pretty leading-relaxed text-ink-dim">
          Both winners take <span className="nums font-semibold text-accent">14</span>. Both losers
          take <span className="nums font-semibold text-ink">10</span>. Nobody gets nothing, so
          being drawn with the weakest player in the group costs you a few points rather than your
          evening — and losing 11–13 is still a good round.
        </p>
      </div>
    </section>
  );
}

function TeamCard({
  names,
  score,
  colors,
  winner = false,
}: {
  names: string[];
  score: number;
  colors: string[];
  winner?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        winner ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          {names.map((n, i) => (
            <span key={n} className="flex items-center gap-2">
              <PlayerAvatar name={n} color={colors[i]} size="sm" />
              <span className="text-sm">{n}</span>
            </span>
          ))}
        </div>
        <span
          className={`nums text-5xl font-semibold ${winner ? 'text-accent' : 'text-ink'}`}
        >
          {score}
        </span>
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        {names.join(' and ')} each bank {score}
      </p>
    </div>
  );
}

function Formats() {
  return (
    <section id="formats" className="py-16 sm:py-24">
      <div className="mx-auto w-full max-w-5xl px-5">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Four ways to run the night
        </h2>
        <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-ink-dim">
          They all score the same way. What changes is who you end up on court with, and how the
          night decides that.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {ALL_FORMATS.map((f, i) => {
            const spec = FORMAT_SPECS[f];
            return (
              <article
                key={f}
                className={`flex flex-col rounded-2xl border p-6 ${
                  i === 0 ? 'border-accent/30 bg-accent/5' : 'border-line bg-surface'
                }`}
              >
                <h3 className={`text-xl font-semibold ${i === 0 ? 'text-accent' : ''}`}>
                  {spec.name}
                </h3>
                <p className="mt-1 text-xs uppercase tracking-wider text-ink-faint">
                  {spec.tagline}
                </p>
                <p className="mt-3 flex-1 text-pretty leading-relaxed text-ink-dim">{spec.blurb}</p>
                <p className="mt-4 text-sm text-ink-faint">{spec.bestFor}</p>
              </article>
            );
          })}
        </div>

        {/* Mixed and Teams used to sit on this row as though they were formats,
            which is what made "Mixicano" read like a third engine. They are
            settings on top of a format, and saying so is clearer than a card. */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Modifier name="Mixed — the Mixicano rule">
            Split the roster in two and every pair has to take one from each half. Men and women,
            or stronger and learning — you name the two sides. It is a switch on Americano or
            Mexicano, not a format of its own.
          </Modifier>
          <Modifier name="Teams — bring your partner">
            Fix the pairs and keep them all night. The pair becomes the thing that gets drawn
            against the other pairs, and the leaderboard ranks teams instead of people.
          </Modifier>
        </div>

        <p className="mt-8 max-w-2xl text-pretty leading-relaxed text-ink-dim">
          Any of them can finish with a knockout. The group stage becomes the qualifying table, the
          top pairs go into a bracket, and the night ends on a final instead of just stopping.
        </p>
      </div>
    </section>
  );
}

function Modifier({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-line/60 bg-surface/40 p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
        {name}
      </h3>
      <p className="mt-2 text-pretty leading-relaxed text-ink-dim">{children}</p>
    </article>
  );
}

/** The two pages that answer "I have never done this before". */
function Learn() {
  return (
    <section className="border-y border-line/60 bg-surface/30 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-5xl px-5">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Never done this before?
        </h2>
        <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-ink-dim">
          Two pages, both short. One is the sport, one is the app.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <LearnCard
            href="/how-to-play"
            title="How to play padel"
            body="The court, the underarm serve, the rule about the walls that everyone gets wrong on their first game, and how scoring works — both the official version and the one a social night uses."
            cta="Read the rules"
          />
          <LearnCard
            href="/guide"
            title="How to use the app"
            body="Setting up a session, scoring it one-thumbed between points, handling people who arrive late or leave early, sharing it read-only with everyone else, and ending the night on a result."
            cta="Read the guide"
          />
        </div>
      </div>
    </section>
  );
}

function LearnCard({
  href,
  title,
  body,
  cta,
}: {
  href: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-accent/40"
    >
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-3 flex-1 text-pretty leading-relaxed text-ink-dim">{body}</p>
      <span className="mt-4 text-sm font-medium text-accent">{cta} →</span>
    </Link>
  );
}

function Features() {
  const items = [
    {
      title: 'Fair sit-outs, actually',
      body: 'Any group that is not a multiple of four means somebody rests. The rotation levels those out — nobody sits twice before everyone has sat once.',
    },
    {
      title: 'Court time is the real limit',
      body: 'Tell it when the booking ends and it says whether the planned rounds fit, then offers the round count that does. Add or drop rounds as the night runs on.',
    },
    {
      title: 'One thumb, one control',
      body: 'Every legal score on screen at once. Tap the number or drag your thumb across — same control either way — and in a race to 24 the other side fills itself in, so a total that does not add up cannot be entered.',
    },
    {
      title: 'Fix anything, any time',
      body: 'Wrong score in round two, discovered in round six? Change it. Standings are recalculated from scratch every time, so nothing goes stale.',
    },
    {
      title: 'People arrive and leave',
      body: 'Mark someone as gone or add a latecomer and the rounds not yet played rebuild around them. Rounds already played are never touched.',
    },
    {
      title: 'Everyone else can watch',
      body: 'Send a share code and the whole group follows the courts, the scores and the table live on their own phones. No sign-in, and no way for them to change anything.',
    },
    {
      title: 'Ends in a group chat',
      body: 'Finish and copy the results straight into WhatsApp, or take the CSV if you keep a running ladder.',
    },
  ];

  return (
    <section className="border-y border-line/60 bg-surface/30 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-5xl px-5">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything a real padel night does to a schedule
        </h2>
        <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-ink-dim">
          People turn up late. Somebody leaves at nine. A score gets typed in wrong and nobody
          notices until round six. The court booking runs out before the plan does. None of that
          is an edge case on a Tuesday — it is the night — so all of it is handled.
        </p>

        <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <article key={f.title}>
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                {f.title}
              </h3>
              <p className="mt-2 text-pretty leading-relaxed text-ink-dim">{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-5xl px-5 text-center">
        <Ball className="mx-auto h-10 w-10" />
        <h2 className="mt-6 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Put the phone down and play
        </h2>
        <p className="mx-auto mt-4 max-w-md text-pretty leading-relaxed text-ink-dim">
          Add it to your home screen and it opens like an app. No accounts for the players — only
          whoever is running the night needs to sign in.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-accent px-8 font-semibold text-accent-ink transition-opacity active:opacity-70"
        >
          Sign in
        </Link>
      </div>
    </section>
  );
}
