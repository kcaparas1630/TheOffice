import { describe, expect, test } from "vitest";
import { parseHnHits, parseFeedXml, selectCandidates, type CandidateItem } from "./feeds";

describe("parseHnHits", () => {
  test("maps hits to candidates", () => {
    const items = parseHnHits({
      hits: [
        {
          title: "New agent framework released",
          url: "https://example.com/framework",
          points: 120,
          created_at_i: 1_756_600_000,
          objectID: "1",
        },
      ],
    });
    expect(items).toEqual([
      {
        title: "New agent framework released",
        url: "https://example.com/framework",
        source: "Hacker News",
        publishedAt: 1_756_600_000_000,
        points: 120,
      },
    ]);
  });

  test("Ask HN posts without url link the discussion", () => {
    const items = parseHnHits({
      hits: [{ title: "Ask HN: agents?", url: null, points: 50, created_at_i: 1, objectID: "42" }],
    });
    expect(items[0].url).toBe("https://news.ycombinator.com/item?id=42");
  });

  test("drops hits missing title or timestamp", () => {
    expect(
      parseHnHits({ hits: [{ title: null, created_at_i: 1 }, { title: "x", created_at_i: null }] })
    ).toEqual([]);
  });
});

describe("parseFeedXml", () => {
  test("parses RSS 2.0 items with CDATA and entities", () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item>
        <title><![CDATA[Claude &amp; agents]]></title>
        <link>https://example.com/post</link>
        <pubDate>Mon, 31 Aug 2026 08:00:00 GMT</pubDate>
        <description><![CDATA[<p>Some <b>html</b> summary</p>]]></description>
      </item>
    </channel></rss>`;
    const items = parseFeedXml(xml, "Test Feed");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Claude & agents");
    expect(items[0].url).toBe("https://example.com/post");
    expect(items[0].source).toBe("Test Feed");
    expect(items[0].publishedAt).toBe(Date.parse("Mon, 31 Aug 2026 08:00:00 GMT"));
    expect(items[0].summary).toBe("Some html summary");
  });

  test("parses Atom entries with href links", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Atom post</title>
        <link rel="alternate" href="https://example.com/atom-post"/>
        <published>2026-08-31T09:00:00Z</published>
        <summary>short</summary>
      </entry>
    </feed>`;
    const items = parseFeedXml(xml, "Atom Feed");
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://example.com/atom-post");
    expect(items[0].publishedAt).toBe(Date.parse("2026-08-31T09:00:00Z"));
  });

  test("skips entries without title or link, tolerates missing dates", () => {
    const xml = `<rss><channel>
      <item><title>No link</title></item>
      <item><title>No date</title><link>https://example.com/x</link></item>
    </channel></rss>`;
    const items = parseFeedXml(xml, "F");
    expect(items).toHaveLength(1);
    expect(items[0].publishedAt).toBe(0);
  });
});

describe("selectCandidates", () => {
  const now = Date.parse("2026-08-31T12:00:00Z");
  const mk = (hoursAgo: number, points?: number): CandidateItem => ({
    title: `t${hoursAgo}`,
    url: `https://x.com/${hoursAgo}`,
    source: "s",
    publishedAt: now - hoursAgo * 3_600_000,
    points,
  });

  test("filters to the freshness window", () => {
    const picked = selectCandidates([mk(2), mk(30)], { now, windowHours: 24, max: 10 });
    expect(picked.map((c) => c.title)).toEqual(["t2"]);
  });

  test("sorts by points then recency and caps count", () => {
    const picked = selectCandidates([mk(5, 10), mk(1, 300), mk(3), mk(2)], {
      now,
      windowHours: 24,
      max: 3,
    });
    expect(picked.map((c) => c.title)).toEqual(["t1", "t5", "t2"]);
  });
});
