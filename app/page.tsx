import Link from 'next/link';
import { Crown } from '@/components/Crown';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PadelNews } from '@/components/PadelNews';
import {
  Ball,
  LinkRow,
  PRIMARY_LINK,
  QUIET_LINK,
  SiteFooter,
  SiteHeader,
} from '@/components/SiteChrome';
import { Eye } from '@/components/icons';
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

/**
 * A section of the landing page: a 28px heading, a sentence under it, then
 * whatever it shows. Sections are separated by space, not by bands of colour.
 */
function Band({
  id,
  heading,
  lede,
  children,
}: {
  id?: string;
  heading: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-3xl px-6">
        <h2 className="text-balance text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">
          {heading}
        </h2>
        {lede ? (
          <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-ink-dim">
            {lede}
          </p>
        ) : null}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-12 pt-10 sm:pb-20 sm:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-sm text-ink-faint">
            Americano · Mexicano · King of the Court · Winner Stays On
          </p>

          <h1 className="mt-3 text-balance text-[44px] font-semibold leading-[1.05] tracking-[-0.035em]">
            Everyone partners everyone.{' '}
            <span className="text-accent-text">Nobody does the maths.</span>
          </h1>

          <p className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-ink-dim">
            Type in who turned up. Rain Padel works out who plays with whom on which court, rotates
            the sit-outs fairly, and keeps a live leaderboard while you play.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Link href="/login" className={PRIMARY_LINK}>
              Sign in
            </Link>
            <Link href="/watch" className={QUIET_LINK}>
              <Eye size="sm" />
              Watch with a code
            </Link>
          </div>

          <p className="mt-4 max-w-lg text-[13px] leading-relaxed text-ink-faint">
            Only the person running the night signs in — it is invite only while it is being
            tested. Everyone else just needs the share code.
          </p>
        </div>

        <ScoreboardPreview />
      </div>
    </section>
  );
}

/** A real scoreboard, drawn the way the app draws its table. */
function ScoreboardPreview() {
  // Every player here has 8 matches, so the round counter has to say 8.
  const rows = [
    { name: 'Aman', color: '#d95757', w: 4, d: 2, l: 2, p: 69 },
    { name: 'Devansh', color: '#4aa87a', w: 4, d: 2, l: 2, p: 68 },
    { name: 'Burhan', color: '#2fa39c', w: 3, d: 2, l: 3, p: 65 },
    { name: 'Ahmed', color: '#9067e0', w: 3, d: 1, l: 4, p: 61 },
    { name: 'Joel', color: '#d97a45', w: 2, d: 1, l: 5, p: 57 },
  ];
  const cols = 'grid grid-cols-[1.25rem_1fr_1.5rem_1.5rem_1.5rem_2.25rem] items-center gap-2.5';

  return (
    <figure aria-label="An example leaderboard">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <span className="text-[15px] font-semibold">Tuesday padel</span>
        <span className="nums text-[13px] text-ink-faint">Round 8 of 8</span>
      </div>
      <div className="card overflow-hidden">
        <div className={`${cols} px-4 pb-1.5 pt-3 text-xs text-ink-faint`}>
          <span />
          <span>Player</span>
          <span className="text-center">W</span>
          <span className="text-center">D</span>
          <span className="text-center">L</span>
          <span className="text-right">Pts</span>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((r, i) => (
            <li key={r.name} className={`${cols} h-12 px-4`}>
              <span className="flex justify-center">
                {i < 3 ? (
                  <Crown tier={(i + 1) as 1 | 2 | 3} className="h-4 w-4" />
                ) : (
                  <span className="nums text-sm text-ink-faint">{i + 1}</span>
                )}
              </span>
              <span className="flex min-w-0 items-center gap-2.5">
                <PlayerAvatar name={r.name} color={r.color} size="sm" />
                <span className="truncate text-[15px] font-medium">{r.name}</span>
              </span>
              <span className="nums text-center text-sm text-ink-dim">{r.w}</span>
              <span className="nums text-center text-sm text-ink-dim">{r.d}</span>
              <span className="nums text-center text-sm text-ink-dim">{r.l}</span>
              <span
                className={`nums text-right text-base font-semibold ${
                  i === 0 ? 'text-accent-text' : ''
                }`}
              >
                {r.p}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

function TheRule() {
  return (
    <Band
      id="the-rule"
      heading="Your score is your own"
      lede="This is the rule that makes the format work, and the one everyone gets wrong. You do not track wins. You track points — and both players on a side bank the whole team score."
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <TeamCard names={['Devansh', 'Sara']} score={14} colors={['#d95757', '#c9a13c']} winner />
        <p className="text-center text-[13px] text-ink-faint sm:px-2">a 24-point match</p>
        <TeamCard names={['Marcus', 'Priya']} score={10} colors={['#3f8ed0', '#9067e0']} />
      </div>

      <p className="mt-8 max-w-2xl text-pretty text-base leading-relaxed text-ink-dim">
        Both winners take <span className="nums font-semibold text-accent-text">14</span>. Both
        losers take <span className="nums font-semibold text-ink">10</span>. Nobody gets nothing,
        so being drawn with the weakest player in the group costs you a few points rather than your
        evening — and losing 11–13 is still a good round.
      </p>
    </Band>
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
    <div className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          {names.map((n, i) => (
            <span key={n} className="flex items-center gap-2.5">
              <PlayerAvatar name={n} color={colors[i]} size="md" />
              <span className="text-[15px] font-medium">{n}</span>
            </span>
          ))}
        </div>
        <span
          className={`nums text-[44px] font-semibold leading-none tracking-[-0.035em] ${
            winner ? 'text-accent-text' : 'text-ink-faint'
          }`}
        >
          {score}
        </span>
      </div>
      <p className="mt-4 text-[13px] text-ink-faint">
        {names.join(' and ')} each bank {score}
      </p>
    </div>
  );
}

function Formats() {
  return (
    <Band
      id="formats"
      heading="Four ways to run the night"
      lede="They all score the same way. What changes is who you end up on court with, and how the night decides that."
    >
      <ul className="card divide-y divide-line overflow-hidden">
        {ALL_FORMATS.map((f) => {
          const spec = FORMAT_SPECS[f];
          return (
            <li key={f} className="px-5 py-4">
              <h3 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold">
                {spec.name}
                <span className="text-[13px] font-normal text-ink-faint">{spec.tagline}</span>
              </h3>
              <p className="mt-1.5 text-pretty text-[15px] leading-relaxed text-ink-dim">
                {spec.blurb}
              </p>
              <p className="mt-1.5 text-[13px] text-ink-faint">{spec.bestFor}</p>
            </li>
          );
        })}
      </ul>

      {/* Mixed and Teams used to sit on this row as though they were formats,
          which is what made "Mixicano" read like a third engine. They are
          settings on top of a format, and saying so is clearer than a card. */}
      <h3 className="mb-2 mt-8 px-1 text-[13px] text-ink-faint">Two switches on top of any of them</h3>
      <ul className="card divide-y divide-line overflow-hidden">
        <Modifier name="Mixed — the Mixicano rule">
          Split the roster in two and every pair has to take one from each half. Men and women, or
          stronger and learning — you name the two sides. It is a switch on Americano or Mexicano,
          not a format of its own.
        </Modifier>
        <Modifier name="Teams — bring your partner">
          Fix the pairs and keep them all night. The pair becomes the thing that gets drawn against
          the other pairs, and the leaderboard ranks teams instead of people.
        </Modifier>
      </ul>

      <p className="mt-8 max-w-2xl text-pretty text-base leading-relaxed text-ink-dim">
        Any of them can finish with a knockout. The group stage becomes the qualifying table, the
        top pairs go into a bracket, and the night ends on a final instead of just stopping.
      </p>
    </Band>
  );
}

function Modifier({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <li className="px-5 py-4">
      <h4 className="text-base font-semibold">{name}</h4>
      <p className="mt-1.5 text-pretty text-[15px] leading-relaxed text-ink-dim">{children}</p>
    </li>
  );
}

/** The two pages that answer "I have never done this before". */
function Learn() {
  return (
    <Band
      heading="Never done this before?"
      lede="Two pages, both short. One is the sport, one is the app."
    >
      <div className="card divide-y divide-line overflow-hidden">
        <LinkRow href="/how-to-play" title="How to play padel">
          The court, the underarm serve, the rule about the walls that everyone gets wrong on their
          first game, and how scoring works — both the official version and the one a social night
          uses.
        </LinkRow>
        <LinkRow href="/guide" title="How to use the app">
          Setting up a session, scoring it one-thumbed between points, handling people who arrive
          late or leave early, sharing it read-only with everyone else, and ending the night on a
          result.
        </LinkRow>
      </div>
    </Band>
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
      title: 'One thumb, one tap',
      body: 'Tap the pair whose score you know and every legal score is on screen at once — tap the number and you are done. In a race to 24 the other side fills itself in, so a total that does not add up cannot be entered.',
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
    <Band
      heading="Everything a real padel night does to a schedule"
      lede="People turn up late. Somebody leaves at nine. A score gets typed in wrong and nobody notices until round six. The court booking runs out before the plan does. None of that is an edge case on a Tuesday — it is the night — so all of it is handled."
    >
      <ul className="card divide-y divide-line overflow-hidden">
        {items.map((f) => (
          <li key={f.title} className="px-5 py-4">
            <h3 className="text-base font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-pretty text-[15px] leading-relaxed text-ink-dim">{f.body}</p>
          </li>
        ))}
      </ul>
    </Band>
  );
}

function ClosingCta() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 text-center">
        <Ball className="h-10 w-10" />
        <h2 className="mt-5 text-balance text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">
          Put the phone down and play
        </h2>
        <p className="mt-3 text-pretty text-base leading-relaxed text-ink-dim">
          Add it to your home screen and it opens like an app. No accounts for the players — only
          whoever is running the night needs to sign in.
        </p>
        <Link href="/login" className={`${PRIMARY_LINK} mt-8`}>
          Sign in
        </Link>
      </div>
    </section>
  );
}
