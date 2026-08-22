import Link from 'next/link';
import { ArticlePage, Callout, Point, Section } from '@/components/SiteChrome';

export const metadata = {
  title: 'How to play padel — the rules, in plain English',
  description:
    'Padel in one page: the court, the serve, the walls, and how scoring works — plus how a social Americano night scores it differently.',
};

export default function HowToPlayPage() {
  return (
    <ArticlePage
      eyebrow="New to padel"
      title="How to play padel"
      standfirst="Padel is doubles, in a glass box, with an underarm serve. If you have played any racket sport you will rally within ten minutes. These are the rules that actually come up on court."
    >
      <Section id="basics" heading="The shape of the game">
        <p>
          Padel is played <strong className="text-ink">two against two</strong> on an enclosed court
          about 20 metres by 10 — roughly a third the size of a tennis court. The back and part of
          the side walls are glass, the rest is wire mesh, and all of it is in play. Rackets are
          solid, stringless and perforated. The ball looks like a tennis ball and is very slightly
          softer.
        </p>
        <p>
          The net splits the court. Each side has two service boxes. Everything else you already
          know from tennis mostly transfers, with two big exceptions: the serve is underarm, and the
          walls keep the ball alive.
        </p>
      </Section>

      <Section id="serve" heading="Serving">
        <div className="grid gap-4 sm:grid-cols-2">
          <Point term="Underarm, below the waist">
            <p>
              Bounce the ball on the ground behind the service line, then strike it at or below
              waist height. No overhead serve. You get two attempts, exactly like tennis.
            </p>
          </Point>
          <Point term="Diagonally, into the box">
            <p>
              The serve must land in the service box diagonally opposite. Serving starts from the
              right and alternates sides every point.
            </p>
          </Point>
          <Point term="Glass is fine, mesh is not">
            <p>
              After it bounces in the correct box, the ball may hit the back glass and stay in play.
              If it touches the <em>wire mesh</em> instead, that serve is a fault.
            </p>
          </Point>
          <Point term="Feet behind the line">
            <p>
              Stay behind the service line and inside your half until you have hit the ball, or it
              is a foot fault.
            </p>
          </Point>
        </div>
      </Section>

      <Section id="walls" heading="The walls — the bit that makes it padel">
        <p>
          This is the rule everyone gets wrong in their first game, and it is simpler than it
          sounds:
        </p>
        <Callout title="On your side, the floor comes first">
          <p>
            When the ball comes over the net it must bounce on <strong className="text-ink">your
            floor</strong> before it touches any of your walls. Once it has bounced, you can let it
            come off the glass and hit it back — that is normal padel, not a trick shot.
          </p>
          <p>
            If the ball hits your wall <em>before</em> bouncing on your floor, you have lost the
            point. And you cannot volley the ball into your own wall to get it over.
          </p>
        </Callout>
        <p>
          Your shot may hit the opponents&rsquo; walls freely once it has crossed the net and
          bounced on their floor. A ball that goes over the surrounding fence and lands in is a
          legal winner — which is why the smash is the shot everybody wants to learn.
        </p>
        <p>You lose the point the usual ways too: two bounces, into the net, or hitting yourself.</p>
      </Section>

      <Section id="scoring" heading="Scoring">
        <p>
          Official padel scoring is tennis scoring: <span className="nums">15</span>,{' '}
          <span className="nums">30</span>, <span className="nums">40</span>, game — deuce and
          advantage at 40–40, six games to a set, a tiebreak at 6–6, and usually best of three sets.
          Many clubs and tournaments now play a <em>golden point</em> instead of advantage: at
          40–40 the next point wins the game, and the receiving pair chooses which side takes it.
        </p>
        <Callout title="A social night scores it differently, on purpose">
          <p>
            Americano, Mexicano and the other social formats throw sets away. Instead every game is
            a race to a fixed number of points — 24 is the usual choice — and{' '}
            <strong className="text-ink">both players on a side bank the whole team score</strong>.
            Win 14–10 and you each get 14; lose it and you each get 10.
          </p>
          <p>
            That single change is what makes a mixed-ability night work. Being drawn with the
            weakest player costs you a few points rather than your evening, and losing 11–13 is
            still a good round. It is the rule Rain Padel is built around.
          </p>
        </Callout>
      </Section>

      <Section id="etiquette" heading="Five things nobody tells you">
        <div className="grid gap-4 sm:grid-cols-2">
          <Point term="Play the glass, do not fear it">
            <p>
              Beginners sprint at every deep ball. Let it pass, wait for it to come off the back
              glass, and hit it as it comes to you. The wall is your friend.
            </p>
          </Point>
          <Point term="The net is where points are won">
            <p>
              Both pairs try to take the net. Lobbing is not defensive here — it is the main way to
              push a pair off the net and take it yourself.
            </p>
          </Point>
          <Point term="Softer beats harder">
            <p>
              A ball hit hard comes off the glass fast and sits up for the other pair. Control
              wins more padel points than power does.
            </p>
          </Point>
          <Point term="Stay level with your partner">
            <p>
              Move up and back as a pair. One at the net and one at the back is the formation that
              loses points.
            </p>
          </Point>
          <Point term="You do not need your own racket">
            <p>Every club rents them. Bring trainers with grip and a ball or two.</p>
          </Point>
          <Point term="Four is the magic number">
            <p>
              Padel is doubles. Singles courts exist but are rare — if you are organising, plan in
              multiples of four and use the rotation to absorb the rest.
            </p>
          </Point>
        </div>
      </Section>

      <Section heading="Ready to run a night?">
        <p>
          If you have four or more people and a court booked, the next page is the one you want —
          it walks through setting up a session and scoring it as you play.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/guide"
            className="inline-flex min-h-12 items-center rounded-xl bg-accent px-6 font-semibold text-accent-ink transition-opacity active:opacity-70"
          >
            How to use the app
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center rounded-xl border border-line px-6 text-ink-dim transition-colors hover:text-ink"
          >
            The formats
          </Link>
        </div>
      </Section>
    </ArticlePage>
  );
}
