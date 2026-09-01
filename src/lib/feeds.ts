// Feed configuration shared by the pipeline (server) and the CLI.
// Feeds are per-job data (jobs.feeds); these are the office defaults used
// when a job doesn't specify its own.

export interface FeedSource {
  name: string;
  url: string;
}

export const DEFAULT_FEEDS: FeedSource[] = [
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" },
  { name: "Latent Space", url: "https://www.latent.space/feed" },
];

export const MAX_FEEDS = 10;

// "https://www.latent.space/feed" → "latent.space"
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function validateFeeds(feeds: FeedSource[]): string | null {
  if (feeds.length === 0) return "At least one feed is required (or reset to defaults).";
  if (feeds.length > MAX_FEEDS) return `At most ${MAX_FEEDS} feeds per job.`;
  for (const feed of feeds) {
    if (!feed.name.trim()) return `Feed "${feed.url}" needs a name.`;
    let parsed: URL;
    try {
      parsed = new URL(feed.url);
    } catch {
      return `"${feed.url}" is not a valid URL.`;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `"${feed.url}" must be http(s).`;
    }
  }
  const urls = feeds.map((f) => f.url);
  if (new Set(urls).size !== urls.length) return "Duplicate feed URLs.";
  return null;
}
