import Link from 'next/link';
import { ArticlePage, Callout, Point, Section, Step, Steps } from '@/components/SiteChrome';
import { ALL_FORMATS, FORMAT_SPECS } from '@/lib/formats';

export const metadata = {
  title: 'How to use Rain Padel',
  description:
    'Set up a session, score it one-thumbed while you play, share it read-only with everyone else, and finish on a result.',
};

export default function GuidePage() {
  return (
    <ArticlePage
      eyebrow="Using the app"
      title="How to run a night with Rain Padel"
      standfirst="One person signs in and runs the session. Everyone else gets a link. From setup to final standings this is about a minute of typing and then no maintenance at all."
    >
      <Section id="setup" heading="Setting up, before the first serve">
        <Steps>
          <Step n={1} title="Name it and pick a format">
            <p>
              Tap <strong className="text-ink">New session</strong>. The name is just for you —
              &ldquo;Tuesday padel&rdquo; is fine. Then choose one of the four formats below; the{' '}
              <strong className="text-ink">?</strong> next to the heading explains them on court if
              somebody argues.
            </p>
          </Step>
          <Step n={2} title="Add who turned up">
            <p>
              Type names one at a time, or paste the whole list from your group chat — one per line
              or separated by commas, and it will split them for you. Anyone you save becomes a
              one-tap regular next week.
            </p>
          </Step>
          <Step n={3} title="Say how many courts">
            <p>
              Four players fill a court. If your group does not divide by four, some people rest
              each game — the app tells you how many, right there under the stepper, and levels the
              sit-outs so nobody rests twice before everybody has rested once.
            </p>
          </Step>
          <Step n={4} title="Choose points or time">
            <p>
              <strong className="text-ink">Points</strong> is a race to a target — 24 is the usual
              one. <strong className="text-ink">Time</strong> plays a fixed number of minutes and
              gives you a timer on the round.
            </p>
          </Step>
          <Step n={5} title="Start with one round">
            <p>
              Do not try to work out how long the night will run — nobody can. Start with one and
              add more as you go; there is a button for it on every screen. If you tell it when the
              court booking ends, it will keep telling you whether what is left actually fits.
            </p>
          </Step>
        </Steps>
      </Section>

      <Section id="formats" heading="Which format to pick">
        <div className="grid gap-4 sm:grid-cols-2">
          {ALL_FORMATS.map((f) => {
            const spec = FORMAT_SPECS[f];
            return (
              <Point key={f} term={spec.name}>
                <p>{spec.blurb}</p>
                <p className="text-sm text-ink-faint">{spec.bestFor}</p>
              </Point>
            );
          })}
        </div>
        <p>
          Two more switches sit under the format and change how it draws rather than how it scores.{' '}
          <strong className="text-ink">Teams</strong> fixes the pairs so you bring your partner and
          keep them all night. <strong className="text-ink">Mixed</strong> — what people call
          Mixicano — splits the roster in two and makes every pair take one from each half; you name
          the halves yourself, so it works for men and women, or for strong and learning.
        </p>
      </Section>

      <Section id="scoring" heading="Scoring while you play">
        <div className="grid gap-4 sm:grid-cols-2">
          <Point term="One pad, tap or drag">
            <p>
              Every legal score is on screen at once. Tap the number, or press and drag your thumb
              across the pad and the score follows it. There is no keyboard and no mode to choose —
              it is the same control either way.
            </p>
          </Point>
          <Point term="The other side fills itself in">
            <p>
              In a race to 24, setting one side to 14 sets the other to 10 automatically, so a
              total that does not add up is impossible to enter. Tap the other number first if that
              is the one you remember.
            </p>
          </Point>
          <Point term="Games that stopped early">
            <p>
              Ran out of court time mid-game? Tap{' '}
              <strong className="text-ink">Ended early?</strong> and the two sides come unlinked so
              you can enter 9–7 and move on.
            </p>
          </Point>
          <Point term="Fix anything, whenever">
            <p>
              Wrong score in round two, spotted in round six? Open the Schedule tab, tap that game
              and change it. Standings are recalculated from scratch every time, so nothing goes
              stale and nothing needs undoing.
            </p>
          </Point>
        </div>
      </Section>

      <Section id="people" heading="When people arrive late or go home">
        <p>
          Tap <strong className="text-ink">Players</strong> in the header. Mark somebody as gone or
          add a latecomer, and the games not yet played rebuild around them — games already played
          are never touched. In a fixed-pairs session a pair leaves together, because half a team
          cannot be scheduled.
        </p>
        <Callout title="Formats react differently, and that is the point">
          <p>
            Americano has its whole schedule worked out upfront, so a roster change rebuilds
            everything from the current game onwards and tells you it has. Mexicano, King of the
            Court and Winner Stays On build the next game from the last result, so they simply use
            whoever is playing when the moment comes.
          </p>
        </Callout>
      </Section>

      <Section id="share" heading="Letting everyone else watch">
        <Steps>
          <Step n={1} title="Tap Share, then create a code">
            <p>
              You get a six-character code like <span className="nums font-semibold text-ink">K7M-4QD</span>{' '}
              and a link that contains it.
            </p>
          </Step>
          <Step n={2} title="Send the link, or read the code out">
            <p>
              Copy the link straight into the group chat — there is a button that writes the whole
              message for you. Anyone who has lost the link can go to{' '}
              <Link href="/watch" className="text-accent underline underline-offset-4">
                the watch page
              </Link>{' '}
              and type the code instead.
            </p>
          </Step>
          <Step n={3} title="They watch, they cannot touch">
            <p>
              They see the courts, every score as you enter it, the live table and the final
              results. There are no edit controls on their screen at all — not disabled ones,
              absent ones. Only you can change a score.
            </p>
          </Step>
        </Steps>
        <p>
          Made a new code? The old link stops working immediately, for everybody holding it. That is
          how you take access back from last week&rsquo;s group.
        </p>
      </Section>

      <Section id="finish" heading="Ending the night on something">
        <div className="grid gap-4 sm:grid-cols-2">
          <Point term="Just stop">
            <p>
              <strong className="text-ink">Finish here</strong> ends the session on the game you are
              on. Anything planned but unplayed is dropped, and the table on screen becomes the
              final one. It asks first, and it offers you another round instead.
            </p>
          </Point>
          <Point term="Or play a final">
            <p>
              Tap <strong className="text-ink">🏆 Finals</strong> and everything played so far
              becomes the qualifying table. The top pairs go into a bracket and the night ends on a
              final rather than just stopping. You can cancel it and go back to a plain leaderboard.
            </p>
          </Point>
        </div>
        <p>
          Either way the Results tab gives you a podium, a line for every finishing place, the
          awards nobody plays for, a copy-to-WhatsApp button and a CSV. There is also{' '}
          <strong className="text-ink">New session, same players</strong>, which is how next week
          starts.
        </p>
        <Callout title="Nothing is ever locked for good">
          <p>
            A finished session reopens. Scores are never deleted. If you tapped Finish by accident,
            tap Reopen and carry on — the standings recompute the moment you fix anything.
          </p>
        </Callout>
      </Section>

      <Section id="phone" heading="Two small things worth doing">
        <div className="grid gap-4 sm:grid-cols-2">
          <Point term="Add it to your home screen">
            <p>
              It opens like an app, full screen, with no browser bar eating the buttons. Share menu
              → Add to Home Screen.
            </p>
          </Point>
          <Point term="Watch the save dot">
            <p>
              Top right of a session. Green means saved. If it ever says{' '}
              <strong className="text-ink">Not saved · retry</strong>, the court wifi dropped — tap
              it once you have signal and nothing is lost.
            </p>
          </Point>
        </div>
      </Section>

      <Section heading="That is the whole app">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex min-h-12 items-center rounded-xl bg-accent px-6 font-semibold text-accent-ink transition-opacity active:opacity-70"
          >
            Sign in and start one
          </Link>
          <Link
            href="/how-to-play"
            className="inline-flex min-h-12 items-center rounded-xl border border-line px-6 text-ink-dim transition-colors hover:text-ink"
          >
            New to padel? Start here
          </Link>
        </div>
      </Section>
    </ArticlePage>
  );
}
