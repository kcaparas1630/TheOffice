// Pure email rendering — no I/O. Turns a brief artifact into subject/text/html.
// The markdown here is our own constrained output (briefToMarkdown), so a tiny
// hand-rolled converter beats a dependency.

export interface EmailInput {
  agentName: string;
  artifactTitle: string;
  contentMd: string;
  sources: { title: string; url: string }[];
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function mdLineToHtml(line: string): string {
  if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
  if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
  if (line.startsWith("> ")) return `<blockquote>${escapeHtml(line.slice(2))}</blockquote>`;
  if (line.startsWith("→ ")) {
    const url = line.slice(2).trim();
    return `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`;
  }
  if (/^_[^_]+_$/.test(line.trim())) {
    return `<p><em>${escapeHtml(line.trim().slice(1, -1))}</em></p>`;
  }
  return `<p>${escapeHtml(line)}</p>`;
}

export function renderBriefEmail(input: EmailInput): RenderedEmail {
  const subject = `${input.artifactTitle} — from ${input.agentName}`;

  const body = input.contentMd
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map(mdLineToHtml)
    .join("\n");

  const html = [
    `<div style="font-family: ui-monospace, Menlo, Consolas, monospace; max-width: 640px; margin: 0 auto; line-height: 1.5;">`,
    body,
    `<hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;">`,
    `<p style="color: #888; font-size: 12px;">Sent by ${escapeHtml(input.agentName)} from The Office. ` +
      `Reply-to is not monitored — talk to ${escapeHtml(input.agentName)} in the terminal.</p>`,
    `</div>`,
  ].join("\n");

  // Plain-text fallback: the markdown itself reads fine in a terminal or text client.
  const text =
    input.contentMd +
    `\n\n—\nSent by ${input.agentName} from The Office. This mailbox is send-only.\n`;

  return { subject, text, html };
}
