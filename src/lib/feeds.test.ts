import { describe, expect, test } from "vitest";
import { DEFAULT_FEEDS, hostLabel, validateFeeds, MAX_FEEDS } from "./feeds";

describe("hostLabel", () => {
  test("derives a clean label from a URL", () => {
    expect(hostLabel("https://www.latent.space/feed")).toBe("latent.space");
    expect(hostLabel("https://simonwillison.net/atom/everything/")).toBe("simonwillison.net");
  });

  test("falls back to the raw string for garbage input", () => {
    expect(hostLabel("not a url")).toBe("not a url");
  });
});

describe("validateFeeds", () => {
  test("accepts the defaults", () => {
    expect(validateFeeds(DEFAULT_FEEDS)).toBeNull();
  });

  test("rejects empty lists, bad urls, and non-http protocols", () => {
    expect(validateFeeds([])).toMatch(/At least one/);
    expect(validateFeeds([{ name: "x", url: "nope" }])).toMatch(/not a valid URL/);
    expect(validateFeeds([{ name: "x", url: "ftp://example.com/feed" }])).toMatch(/http/);
  });

  test("rejects missing names, duplicates, and oversized lists", () => {
    expect(validateFeeds([{ name: "  ", url: "https://example.com/a" }])).toMatch(/needs a name/);
    expect(
      validateFeeds([
        { name: "a", url: "https://example.com/a" },
        { name: "b", url: "https://example.com/a" },
      ])
    ).toMatch(/Duplicate/);
    const many = Array.from({ length: MAX_FEEDS + 1 }, (_, i) => ({
      name: `f${i}`,
      url: `https://example.com/${i}`,
    }));
    expect(validateFeeds(many)).toMatch(/At most/);
  });
});
