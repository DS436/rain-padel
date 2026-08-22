/**
 * Padel headlines on the landing page.
 *
 * The feeds belong to other people, so everything here assumes they will one
 * day be slow, malformed, moved or gone — a landing page that fails to render
 * because a magazine changed its CMS would be a ridiculous way to lose the
 * front door. Every failure path returns fewer items, never an error.
 *
 * The parser is deliberately hand-rolled. RSS in the wild is not reliably valid
 * XML, a strict parser throws on the first stray ampersand, and the alternative
 * is a dependency and a bundle for four fields.
 *
 * Feed content is UNTRUSTED. Titles are rendered as React text, so they are
 * escaped for free; links are checked to be http(s) before they are ever put in
 * an href, because `javascript:` in a `<link>` is the obvious attack and costs
 * one line to close.
 */

export interface NewsFeed {
  /** shown as the byline on each headline */
  source: string;
  url: string;
  /** most feeds are English; anything else is labelled so nobody is surprised */
  language?: string;
}

export const FEEDS: NewsFeed[] = [
  { source: 'The Padel Paper', url: 'https://thepadelpaper.com/feed/' },
  { source: 'Padel Magazine', url: 'https://padelmagazine.fr/feed/', language: 'Français' },
];

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  language?: string;
  /** epoch ms, or null when the feed did not say */
  published: number | null;
}

/** How long a headline may sit in the page before it is refetched. */
export const NEWS_REVALIDATE_SECONDS = 3600;

const FETCH_TIMEOUT_MS = 6000;

/* ------------------------------- parsing ------------------------------- */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Unwrap CDATA, decode the handful of entities feeds actually use. */
export function decodeXmlText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => codePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function codePoint(n: number): string {
  return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
}

function tagText(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decodeXmlText(m[1]!) : null;
}

/** http(s) only, and the tracking parameters trimmed off for tidiness. */
export function safeLink(raw: string | null): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
  }
  return url.toString();
}

/**
 * Pull items out of an RSS or Atom document.
 *
 * `<link>` is empty on more feeds than you would expect — WordPress themes that
 * only populate `<guid>` are common — so the guid is the documented fallback
 * rather than a guess, and an item with no usable link at all is dropped rather
 * than rendered as dead text.
 */
export function parseFeed(xml: string, feed: NewsFeed, limit = 6): NewsItem[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  const out: NewsItem[] = [];

  for (const block of blocks) {
    const title = tagText(block, 'title');
    if (!title) continue;

    const href =
      safeLink(tagText(block, 'link')) ??
      safeLink(tagText(block, 'guid')) ??
      safeLink(block.match(/<link\b[^>]*href="([^"]+)"/i)?.[1] ?? null);
    if (!href) continue;

    const stamp = tagText(block, 'pubDate') ?? tagText(block, 'updated') ?? tagText(block, 'published');
    const parsed = stamp ? Date.parse(stamp) : NaN;

    out.push({
      title,
      link: href,
      source: feed.source,
      language: feed.language,
      published: Number.isFinite(parsed) ? parsed : null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/* ------------------------------ fetching ------------------------------ */

async function fetchFeed(feed: NewsFeed, perFeed: number): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: NEWS_REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), feed, perFeed);
  } catch {
    // Offline, timed out, or the feed moved. The page has plenty to say without it.
    return [];
  }
}

export interface NewsResult {
  items: NewsItem[];
  /**
   * When these headlines were read, which is what the ages are relative to.
   * It travels WITH the items rather than being stamped at render: the whole
   * page is cached for an hour, so a render-time clock would claim a freshness
   * the cached HTML does not have.
   */
  fetchedAt: number;
}

/**
 * Every feed, interleaved so one prolific source cannot crowd the others out.
 * Returns an empty list rather than throwing when everything is down.
 */
export async function fetchNews(limit = 6, feeds: NewsFeed[] = FEEDS): Promise<NewsResult> {
  const perFeed = Math.max(2, Math.ceil(limit / Math.max(1, feeds.length)) + 1);
  const results = await Promise.all(feeds.map((f) => fetchFeed(f, perFeed)));
  return { items: interleave(results).slice(0, limit), fetchedAt: Date.now() };
}

/** Round-robin across sources, then newest-first within what survives. */
export function interleave(lists: NewsItem[][]): NewsItem[] {
  const out: NewsItem[] = [];
  const depth = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < depth; i++) {
    for (const list of lists) if (list[i]) out.push(list[i]!);
  }
  return out;
}

/** "2 days ago", or null when the feed gave no date. */
export function relativeAge(published: number | null, now: number): string | null {
  if (published === null) return null;
  const mins = Math.round((now - published) / 60_000);
  if (mins < 0) return 'just now';
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}
