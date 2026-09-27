import { fetchNews, relativeAge, type NewsItem } from '@/lib/news';
import { ArrowUpRight } from '@/components/icons';

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
    <section id="news" className="scroll-mt-16 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-3xl px-6">
        <h2 className="text-balance text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">
          What is going on in padel
        </h2>
        <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-ink-dim">
          Headlines from around the sport, and the short version of everything you need to run a
          night yourself.
        </p>

        {items.length > 0 ? (
          <ul className="card mt-8 divide-y divide-line overflow-hidden">
            {items.map((item) => (
              <li key={item.link}>
                <Headline item={item} now={fetchedAt} />
              </li>
            ))}
          </ul>
        ) : null}

        <ul className="card mt-8 divide-y divide-line overflow-hidden">
          {GUIDES.map((g) => (
            <li key={g.title} className="px-5 py-4">
              <p className="text-[13px] text-ink-faint">{g.tag}</p>
              <h3 className="mt-0.5 text-base font-semibold">{g.title}</h3>
              <p className="mt-1.5 text-pretty text-[15px] leading-relaxed text-ink-dim">{g.body}</p>
            </li>
          ))}
        </ul>
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
      className="flex min-h-14 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/50 active:bg-surface-2"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-pretty text-[15px] font-medium leading-snug">{item.title}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-faint">
          <span className="text-ink-dim">{item.source}</span>
          {item.language ? <span>· {item.language}</span> : null}
          {age ? <span>· {age}</span> : null}
        </span>
      </span>
      <ArrowUpRight size="sm" className="text-ink-faint" />
    </a>
  );
}
