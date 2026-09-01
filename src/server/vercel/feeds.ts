// Pure feed parsing — no I/O here. Fetching happens in the Convex action;
// these functions turn raw responses into candidate items deterministically
// (cheap, no hallucination surface). The LLM only filters/ranks/synthesizes.

export interface CandidateItem {
  title: string;
  url: string;
  source: string;
  publishedAt: number; // epoch ms
  points?: number;
  summary?: string;
}

interface HnHit {
  title?: string | null;
  url?: string | null;
  points?: number | null;
  created_at_i?: number | null;
  objectID?: string;
}

export function parseHnHits(json: { hits?: HnHit[] }, source = "Hacker News"): CandidateItem[] {
  return (json.hits ?? [])
    .filter((h) => h.title && h.created_at_i)
    .map((h) => ({
      title: h.title!,
      // Ask/Show HN posts have no external url; link the HN discussion instead.
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      source,
      publishedAt: h.created_at_i! * 1000,
      points: h.points ?? undefined,
    }));
}

// Minimal RSS 2.0 / Atom item extraction. The Convex runtime has no DOMParser,
// and feed markup in the wild is messy — this extracts just what we need.
const stripTags = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

function firstMatch(block: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const m = block.match(pattern);
    if (m) return m[1].trim();
  }
  return undefined;
}

export function parseFeedXml(xml: string, source: string): CandidateItem[] {
  const blocks = xml.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/g) ?? [];
  const items: CandidateItem[] = [];
  for (const block of blocks) {
    const title = firstMatch(block, [/<title[^>]*>([\s\S]*?)<\/title>/]);
    const url =
      firstMatch(block, [
        /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/,
        /<link[^>]*href="([^"]+)"/,
        /<link[^>]*>([\s\S]*?)<\/link>/,
      ]) ?? undefined;
    const dateRaw = firstMatch(block, [
      /<pubDate>([\s\S]*?)<\/pubDate>/,
      /<published>([\s\S]*?)<\/published>/,
      /<updated>([\s\S]*?)<\/updated>/,
      /<dc:date>([\s\S]*?)<\/dc:date>/,
    ]);
    const summaryRaw = firstMatch(block, [
      /<description>([\s\S]*?)<\/description>/,
      /<summary[^>]*>([\s\S]*?)<\/summary>/,
      /<content[^>]*>([\s\S]*?)<\/content>/,
    ]);
    if (!title || !url) continue;
    const publishedAt = dateRaw ? Date.parse(stripTags(dateRaw)) : NaN;
    items.push({
      title: stripTags(title),
      url: stripTags(url),
      source,
      publishedAt: Number.isNaN(publishedAt) ? 0 : publishedAt,
      summary: summaryRaw ? stripTags(summaryRaw).slice(0, 400) : undefined,
    });
  }
  return items;
}

export function selectCandidates(
  items: CandidateItem[],
  opts: { now: number; windowHours: number; max: number }
): CandidateItem[] {
  const cutoff = opts.now - opts.windowHours * 3_600_000;
  return items
    .filter((i) => i.publishedAt >= cutoff && i.publishedAt <= opts.now + 3_600_000)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || b.publishedAt - a.publishedAt)
    .slice(0, opts.max);
}
