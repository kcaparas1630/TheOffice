import { describe, expect, test } from "vitest";
import { buildBriefPrompt, buildRevisionPrompt, briefToMarkdown } from "./brief";
import type { CandidateItem } from "./feeds";

const candidates: CandidateItem[] = [
  {
    title: "AI SDK 7.1 released",
    url: "https://example.com/sdk",
    source: "HN",
    publishedAt: Date.parse("2026-08-31T08:00:00Z"),
    points: 210,
    summary: "New tool loop APIs",
  },
];

describe("buildBriefPrompt", () => {
  test("spec and lessons drive the system prompt", () => {
    const { system } = buildBriefPrompt({
      jobTitle: "Daily Tech Brief",
      spec: "5-8 items max, why-it-matters first.",
      lessons: ["Lead with agent-framework news."],
      candidates,
    });
    expect(system).toContain("5-8 items max");
    expect(system).toContain("Lead with agent-framework news.");
    expect(system).toContain("never invent or alter");
  });

  test("candidates appear with exact urls in the prompt", () => {
    const { prompt } = buildBriefPrompt({
      jobTitle: "Brief",
      spec: "spec",
      lessons: [],
      candidates,
    });
    expect(prompt).toContain("AI SDK 7.1 released");
    expect(prompt).toContain("https://example.com/sdk");
    expect(prompt).toContain("210 pts");
  });

  test("no lessons section when there are none", () => {
    const { system } = buildBriefPrompt({ jobTitle: "B", spec: "s", lessons: [], candidates });
    expect(system).not.toContain("Durable lessons");
  });
});

describe("buildRevisionPrompt", () => {
  test("carries original content, critique, and spec", () => {
    const { system, prompt } = buildRevisionPrompt({
      jobTitle: "Daily Tech Brief",
      spec: "tight paragraphs",
      lessons: ["No funding news."],
      originalMd: "# Old brief\ncontent here",
      critique: "Too long, cut the fluff",
    });
    expect(system).toContain("tight paragraphs");
    expect(system).toContain("No funding news.");
    expect(prompt).toContain("# Old brief");
    expect(prompt).toContain("Too long, cut the fluff");
  });
});

describe("briefToMarkdown", () => {
  test("renders items with headline, why-it-matters, and link", () => {
    const md = briefToMarkdown(
      {
        slowDay: false,
        items: [
          { headline: "SDK 7.1", whyItMatters: "Tool loops got simpler.", url: "https://example.com/sdk" },
        ],
      },
      { title: "Daily Tech Brief — 2026-08-31", dateIso: "2026-08-31" }
    );
    expect(md).toContain("# Daily Tech Brief — 2026-08-31");
    expect(md).toContain("## SDK 7.1");
    expect(md).toContain("Tool loops got simpler.");
    expect(md).toContain("→ https://example.com/sdk");
    expect(md).not.toContain("Slow day");
  });

  test("slow days say so instead of padding", () => {
    const md = briefToMarkdown(
      { slowDay: true, items: [] },
      { title: "Brief", dateIso: "2026-08-31" }
    );
    expect(md).toContain("Slow day");
  });
});
