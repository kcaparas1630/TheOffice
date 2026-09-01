// Pure brief-generation logic: the structured-output schema, the prompt that
// feeds candidates + job spec + lessons to the LLM, and the markdown renderer.
import { z } from "zod";
import type { CandidateItem } from "./feeds";

export const briefSchema = z.object({
  slowDay: z
    .boolean()
    .describe("True if little of substance happened — a short honest brief beats a padded one."),
  items: z
    .array(
      z.object({
        headline: z.string().describe("Tight headline for the item"),
        whyItMatters: z.string().describe("One tight paragraph, why-it-matters first"),
        url: z.string().describe("Exact url copied from the candidate list — never invent one"),
      })
    )
    .describe("5-8 items max on a normal day; fewer on a slow day"),
});
export type Brief = z.infer<typeof briefSchema>;

export function buildBriefPrompt(args: {
  jobTitle: string;
  spec: string;
  lessons: string[];
  candidates: CandidateItem[];
}): { system: string; prompt: string } {
  const system = [
    `You produce "${args.jobTitle}" — selecting and synthesizing from a fixed candidate list.`,
    ``,
    `## What good looks like (the job spec)`,
    args.spec,
    ...(args.lessons.length > 0
      ? [``, `## Durable lessons from past critiques (always apply)`, ...args.lessons.map((l) => `- ${l}`)]
      : []),
    ``,
    `## Hard rules`,
    `- Choose ONLY from the candidate items provided. Copy urls exactly; never invent or alter them.`,
    `- Judge newsworthiness against the spec, not general popularity.`,
    `- If candidates are thin, set slowDay=true and include only what genuinely matters.`,
  ].join("\n");

  const prompt = [
    `Candidate items (title | source | age | points | summary):`,
    ...args.candidates.map((c, i) => {
      const points = c.points != null ? `${c.points} pts` : "-";
      const summary = c.summary ? ` | ${c.summary}` : "";
      return `${i + 1}. ${c.title} | ${c.source} | ${new Date(c.publishedAt).toISOString()} | ${points} | ${c.url}${summary}`;
    }),
    ``,
    `Produce the brief.`,
  ].join("\n");

  return { system, prompt };
}

export function buildRevisionPrompt(args: {
  jobTitle: string;
  spec: string;
  lessons: string[];
  originalMd: string;
  critique: string;
}): { system: string; prompt: string } {
  const system = [
    `You revise "${args.jobTitle}" documents against a critique.`,
    ``,
    `## What good looks like (the job spec)`,
    args.spec,
    ...(args.lessons.length > 0
      ? [``, `## Durable lessons from past critiques (always apply)`, ...args.lessons.map((l) => `- ${l}`)]
      : []),
    ``,
    `## Hard rules`,
    `- Extract the concrete standard behind the critique and revise against it — don't pad, improve.`,
    `- Keep only urls that appear in the original document; never invent new ones.`,
  ].join("\n");

  const prompt = [
    `## Original document`,
    args.originalMd,
    ``,
    `## Critique from the CEO`,
    args.critique,
    ``,
    `Produce the revised brief.`,
  ].join("\n");

  return { system, prompt };
}

export const LESSON_PROMPT =
  "Distill the following critique into ONE short, durable, reusable rule for future briefs " +
  "(imperative, max 20 words, no preamble). Critique: ";

export function briefToMarkdown(brief: Brief, args: { title: string; dateIso: string }): string {
  const lines = [`# ${args.title}`, ``, `_${args.dateIso}_`, ``];
  if (brief.slowDay) {
    lines.push(`> Slow day — keeping it short rather than padded.`, ``);
  }
  for (const item of brief.items) {
    lines.push(`## ${item.headline}`, ``, `${item.whyItMatters}`, ``, `→ ${item.url}`, ``);
  }
  return lines.join("\n").trimEnd() + "\n";
}
