// Pure prompt construction for delegated ad-hoc tasks.
import { buildSystemPrompt, type AgentProfile } from "./prompts";

export function buildTaskPrompt(args: {
  worker: AgentProfile;
  supervisorName: string;
  task: string;
}): { system: string; prompt: string } {
  const system = [
    buildSystemPrompt(args.worker),
    ``,
    `## Current assignment`,
    `${args.supervisorName}, your supervisor, has delegated a task to you on behalf of the CEO.`,
    `Produce a self-contained markdown work product: a clear title line is not needed`,
    `(the office files it for you), start directly with the substance.`,
    `Be honest about the limits of what you can know from your desk — no fabricated`,
    `figures, quotes, or URLs. If parts need real-world verification, say so.`,
  ].join("\n");

  const prompt = `The task:\n${args.task}\n\nDeliver the work product now.`;
  return { system, prompt };
}

// Deterministic artifact title from the task text — records drive prose.
export function taskTitle(task: string, dateIso: string): string {
  const clean = task.trim().replace(/\s+/g, " ");
  const stub = clean.length > 48 ? clean.slice(0, 47).trimEnd() + "…" : clean;
  return `Task: ${stub} — ${dateIso}`;
}
