import { fetchNews, relativeAge, type NewsItem } from '@/lib/news';

/**
 * Headlines from elsewhere in padel, plus the things this app can explain itself.
 *
 * Fetched on the server and cached for an hour, so nobody's first visit waits on
 * somebody else's magazine — and if every feed is down the guides carry the
 * section on their own rather than leaving a hole where the news was.
 *
 * Everything below the fold is written here, not fetched: format explainers age
 * far better than headlines and are the actual reason somebody who has never run
 * an Americano lands on this page.
 */

interface Guide {
  title: string;
  body: string;
  tag: string;
}

const GUIDES: Guide[] = [
  {
    tag: 'Format',
    title: 'Americano, Mexicano, Mixicano',
    body: 'Americano works through every partnership in turn and is decided before the first serve. Mexicano re-ranks everyone after every game so winners drift toward court one. Mixicano is either of those with one rule added: every pair is one player from each half of the roster.',
  },
  {
    tag: 'Scoring',
    title: 'Why nobody counts wins',
    body: 'A 24-point game ending 14–10 gives both winners 14 and both losers 10. You accumulate points, not victories, which is what stops a weak draw ruining somebody’s night — losing 11–13 is still a good game.',
  },
  {
    tag: 'Running it',
    title: 'How long should a night be?',
    body: 'Do not decide up front. One round is a full cycle — with eight players that is seven games, about an hour and ten. Start there, add rounds while you play, and end on the game you are on when the court time runs out.',
  },
  {
    tag: 'Fairness',
    title: 'Sit-outs, and who takes them',
    body: 'Any group that is not a multiple of four means somebody rests each game. The rotation levels those out rather than picking at random, so nobody sits a second time before everyone has sat once.',
  },
  {
    tag: 'Finishing',
    title: 'Give the night an ending',
    body: 'A points table just stops. A knockout gives it a last game everybody watches: the group stage seeds the bracket, the top pairs play semis and a final, and a drawn game goes to the better seed so nothing runs late.',
  },
  {
    tag: 'Kit',
    title: 'Bring one more ball than you think',
    body: 'A padel ball is a little softer and slightly lower-pressure than a tennis ball, and a night of eight people will flatten a tube. Two tubes for a two-hour session, and label them if you are running a ladder.',
  },
];

export async function PadelNews() {
  const { items, fetchedAt } = await fetchNews(6);

  return (
    <section id="news" className="border-y border-line/60 bg-surface/30 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-5xl px-5">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          What is going on in padel
        </h2>
        <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-ink-dim">
          Headlines from around the sport, and the short version of everything you need to run a
          night yourself.
        </p>

        {items.length > 0 ? (
          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.link}>
                <Headline item={item} now={fetchedAt} />
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((g) => (
            <article key={g.title}>
              <span className="text-[10px] uppercase tracking-[0.14em] text-accent">{g.tag}</span>
              <h3 className="mt-1 text-base font-semibold">{g.title}</h3>
              <p className="mt-2 text-pretty leading-relaxed text-ink-dim">{g.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * `noopener noreferrer` on every outbound link, and the destination host shown
 * next to the source name — the text of a headline is written by somebody else,
 * so the one thing worth being explicit about is where tapping it goes.
 */
function Headline({ item, now }: { item: NewsItem; now: number }) {
  const age = relativeAge(item.published, now);
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent/40"
    >
      <span className="text-pretty font-medium leading-snug">{item.title}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
        <span className="text-ink-dim">{item.source}</span>
        {item.language ? <span>· {item.language}</span> : null}
        {age ? <span>· {age}</span> : null}
        <span aria-hidden className="ml-auto">
          ↗
        </span>
      </span>
    </a>
  );
}
