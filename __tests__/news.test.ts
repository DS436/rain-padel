import { describe, expect, it } from 'vitest';
import {
  decodeXmlText,
  interleave,
  parseFeed,
  relativeAge,
  safeLink,
  type NewsItem,
} from '@/lib/news';

/**
 * The feeds belong to other people, so every test here is a way one of them
 * could be wrong: a stray ampersand, an empty link, a hostile href, a date in
 * a format nobody has seen since 2004.
 */

const FEED = { source: 'Test Paper', url: 'https://example.com/feed/' };

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Test Paper</title>
  <link>https://example.com</link>
  <item>
    <title>Coello &#038; Tapia take the title</title>
    <link>https://example.com/one/?utm_source=rss&#038;utm_medium=rss</link>
    <pubDate>Thu, 20 Aug 2026 08:58:00 +0000</pubDate>
  </item>
  <item>
    <title><![CDATA[Why <b>clubs</b> are switching]]></title>
    <link></link>
    <guid isPermaLink="false">https://example.com/two/</guid>
  </item>
</channel></rss>`;

describe('decoding what feeds actually send', () => {
  it('unwraps CDATA and strips the markup inside it', () => {
    expect(decodeXmlText('<![CDATA[Why <b>clubs</b> switch]]>')).toBe('Why clubs switch');
  });

  it('decodes numeric and named entities', () => {
    expect(decodeXmlText('Coello &#038; Tapia &amp; friends')).toBe('Coello & Tapia & friends');
    expect(decodeXmlText('padel&#8217;s finest')).toBe('padel’s finest');
    expect(decodeXmlText('&#x2019;')).toBe('’');
  });

  it('leaves an entity it does not know rather than mangling it', () => {
    expect(decodeXmlText('a &weird; b')).toBe('a &weird; b');
  });
});

describe('links', () => {
  it('accepts http and https and nothing else', () => {
    expect(safeLink('https://example.com/x')).toBe('https://example.com/x');
    expect(safeLink('http://example.com/x')).toBe('http://example.com/x');
    expect(safeLink('javascript:alert(1)')).toBeNull();
    expect(safeLink('data:text/html,<script>')).toBeNull();
    expect(safeLink('not a url')).toBeNull();
    expect(safeLink(null)).toBeNull();
  });

  it('trims tracking parameters and keeps the real ones', () => {
    expect(safeLink('https://example.com/a?utm_source=rss&id=7&utm_medium=x')).toBe(
      'https://example.com/a?id=7',
    );
  });
});

describe('parsing a feed', () => {
  it('reads title, link and date', () => {
    const items = parseFeed(RSS, FEED);
    expect(items[0]!.title).toBe('Coello & Tapia take the title');
    expect(items[0]!.link).toBe('https://example.com/one/');
    expect(items[0]!.source).toBe('Test Paper');
    expect(items[0]!.published).toBe(Date.parse('Thu, 20 Aug 2026 08:58:00 +0000'));
  });

  it('falls back to the guid when the link element is empty', () => {
    expect(parseFeed(RSS, FEED)[1]!.link).toBe('https://example.com/two/');
  });

  it('reads Atom entries and their href links', () => {
    const atom = `<feed><entry><title>Atom item</title>
      <link rel="alternate" href="https://example.com/atom/"/>
      <updated>2026-08-20T08:58:00Z</updated></entry></feed>`;
    const items = parseFeed(atom, FEED);
    expect(items[0]!.link).toBe('https://example.com/atom/');
    expect(items[0]!.published).toBe(Date.parse('2026-08-20T08:58:00Z'));
  });

  it('drops an item with no usable link rather than rendering dead text', () => {
    const broken = `<rss><channel><item><title>No link here</title></item></channel></rss>`;
    expect(parseFeed(broken, FEED)).toEqual([]);
  });

  it('survives a document that is not really XML', () => {
    expect(parseFeed('<html>404 & sorry</html>', FEED)).toEqual([]);
    expect(parseFeed('', FEED)).toEqual([]);
  });

  it('keeps an item whose date is unparseable, without a date', () => {
    const odd = `<rss><item><title>T</title><link>https://example.com/z</link>
      <pubDate>sometime last Tuesday</pubDate></item></rss>`;
    expect(parseFeed(odd, FEED)[0]!.published).toBeNull();
  });

  it('honours the limit', () => {
    expect(parseFeed(RSS, FEED, 1)).toHaveLength(1);
  });
});

describe('mixing sources', () => {
  const item = (title: string, source: string): NewsItem => ({
    title,
    link: `https://example.com/${title}`,
    source,
    published: null,
  });

  it('round-robins so one prolific feed cannot crowd the rest out', () => {
    const mixed = interleave([
      [item('a1', 'A'), item('a2', 'A'), item('a3', 'A')],
      [item('b1', 'B')],
    ]);
    expect(mixed.map((i) => i.title)).toEqual(['a1', 'b1', 'a2', 'a3']);
  });

  it('copes with every feed being empty', () => {
    expect(interleave([[], []])).toEqual([]);
  });
});

describe('ages', () => {
  const now = Date.parse('2026-08-22T12:00:00Z');
  it('reads the way people say it', () => {
    expect(relativeAge(now - 30 * 60_000, now)).toBe('30m ago');
    expect(relativeAge(now - 5 * 3_600_000, now)).toBe('5h ago');
    expect(relativeAge(now - 3 * 86_400_000, now)).toBe('3d ago');
    expect(relativeAge(now - 20 * 86_400_000, now)).toBe('3w ago');
  });
  it('says nothing when the feed said nothing', () => {
    expect(relativeAge(null, now)).toBeNull();
  });
  it('does not print a negative age when a clock disagrees', () => {
    expect(relativeAge(now + 60_000, now)).toBe('just now');
  });
});
