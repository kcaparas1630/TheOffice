import { describe, expect, test } from "vitest";
import { renderBriefEmail } from "./email";

const input = {
  agentName: "Edna",
  artifactTitle: "Daily Tech Brief — 2026-09-01",
  contentMd: [
    "# Daily Tech Brief — 2026-09-01",
    "",
    "_2026-09-01_",
    "",
    "## Agent memory as a file format",
    "",
    "Standardizing agent memory enables persistent state & composition.",
    "",
    "→ https://example.com/memory?a=1&b=2",
    "",
    "> Slow day — keeping it short rather than padded.",
  ].join("\n"),
  sources: [{ title: "Memory fields", url: "https://example.com/memory?a=1&b=2" }],
};

describe("renderBriefEmail", () => {
  test("subject names the document and the sender agent", () => {
    const { subject } = renderBriefEmail(input);
    expect(subject).toBe("Daily Tech Brief — 2026-09-01 — from Edna");
  });

  test("html renders headings, links, and blockquotes", () => {
    const { html } = renderBriefEmail(input);
    expect(html).toContain("<h1>Daily Tech Brief — 2026-09-01</h1>");
    expect(html).toContain("<h2>Agent memory as a file format</h2>");
    expect(html).toContain('<a href="https://example.com/memory?a=1&amp;b=2">');
    expect(html).toContain("<blockquote>Slow day — keeping it short rather than padded.</blockquote>");
    expect(html).toContain("<em>2026-09-01</em>");
  });

  test("html escapes markup in content (no injection from feed titles)", () => {
    const { html } = renderBriefEmail({
      ...input,
      contentMd: '## <script>alert("x")</script> & friends',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; friends");
  });

  test("text fallback is the markdown plus a send-only notice", () => {
    const { text } = renderBriefEmail(input);
    expect(text).toContain("# Daily Tech Brief — 2026-09-01");
    expect(text).toContain("send-only");
  });

  test("body notes the mailbox is not monitored (no inbound channels)", () => {
    const { html } = renderBriefEmail(input);
    expect(html).toContain("Reply-to is not monitored");
  });
});
