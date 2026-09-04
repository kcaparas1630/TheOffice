// Pure prompt construction for ad-hoc tasks and routing decisions.
import { z } from "zod";
import { buildSystemPrompt, type AgentProfile } from "./prompts";

export type AssignedBy = { role: "supervisor"; name: string } | { role: "ceo" } | { role: "self" };

export function buildTaskPrompt(args: {
  worker: AgentProfile;
  assignedBy: AssignedBy;
  task: string;
}): { system: string; prompt: string } {
  const assignmentLine =
    args.assignedBy.role === "supervisor"
      ? `${args.assignedBy.name}, your supervisor, has delegated a task to you on behalf of the CEO.`
      : args.assignedBy.role === "self"
        ? `You picked this up yourself on your turn, as one of your duties.`
        : `The CEO has assigned a task to you directly.`;
  const system = [
    buildSystemPrompt(args.worker),
    ``,
    `## Current assignment`,
    assignmentLine,
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

// ---------- routing: a supervisor decides who handles an incoming task ----------

export interface ReportSummary {
  name: string;
  jobTitle: string;
  jobDescription: string;
}

export const routingSchema = z.object({
  decision: z
    .enum(["self", "delegate"])
    .describe("'delegate' only if one of your reports' job descriptions fits the task better"),
  workerName: z
    .string()
    .nullable()
    .describe("Exact name of the ONE report to delegate to; null when keeping it yourself"),
  reason: z.string().describe("One short sentence explaining the routing choice"),
  refinedTask: z
    .string()
    .optional()
    .describe("Optional: sharpen the task wording for whoever executes it; keep the CEO's intent"),
});
export type RoutingDecision = z.infer<typeof routingSchema>;

export function buildRoutingPrompt(args: {
  supervisor: AgentProfile;
  reports: ReportSummary[];
  task: string;
}): { system: string; prompt: string } {
  const system = [
    buildSystemPrompt(args.supervisor),
    ``,
    `## Routing a new assignment`,
    `The CEO has handed you a task. As a supervisor you decide who handles it:`,
    `keep it yourself, or delegate it to ONE of your reports.`,
    ``,
    `Your reports:`,
    ...args.reports.map((r) => `- ${r.name} — ${r.jobTitle}: ${r.jobDescription}`),
    ``,
    `Routing rules:`,
    `- Delegate when a report's job description fits the task better than your own.`,
    `- Keep it when the task is squarely your own job, or when it needs your judgment as supervisor.`,
    `- Only the names listed above exist. Never invent a name.`,
    `- Either way, you remain accountable for the outcome.`,
  ].join("\n");

  const prompt = `The task from the CEO:\n${args.task}\n\nDecide the routing now.`;
  return { system, prompt };
}

// After a delegated task completes, the supervisor reports back to the CEO:
// a short covering brief in their own voice, with the report attached below.
export function buildHandoffPrompt(args: {
  supervisor: AgentProfile;
  workerName: string;
  task: string;
  reportMd: string;
}): { system: string; prompt: string } {
  const system = [
    buildSystemPrompt(args.supervisor),
    ``,
    `## Reporting back to the CEO`,
    `You delegated a task to ${args.workerName}, and they have delivered.`,
    `Write a SHORT covering brief to the CEO (3-6 sentences, in your voice):`,
    `what was asked, who did the work, and the key takeaways worth the CEO's`,
    `attention. Do not rewrite or pad the report — it will be attached in full`,
    `below your brief. Only reference things actually present in the report.`,
  ].join("\n");

  const prompt = [
    `## The CEO's original ask`,
    args.task,
    ``,
    `## ${args.workerName}'s delivered report`,
    args.reportMd,
    ``,
    `Write your covering brief now.`,
  ].join("\n");

  return { system, prompt };
}

export function handoffTitle(task: string, dateIso: string): string {
  const clean = task.trim().replace(/\s+/g, " ");
  const stub = clean.length > 40 ? clean.slice(0, 39).trimEnd() + "…" : clean;
  return `Report to CEO: ${stub} — ${dateIso}`;
}

// Deterministic guard on the LLM's routing choice: an invalid or missing
// worker name falls back to self-execution — never a crash, never a phantom.
export type ResolvedRouting =
  | { kind: "self"; reason: string }
  | { kind: "delegate"; workerName: string; reason: string; task?: string };

export function resolveRouting(decision: RoutingDecision, reportNames: string[]): ResolvedRouting {
  if (decision.decision === "delegate") {
    const match = reportNames.find(
      (n) => n.toLowerCase() === (decision.workerName ?? "").trim().toLowerCase()
    );
    if (match) {
      return { kind: "delegate", workerName: match, reason: decision.reason, task: decision.refinedTask };
    }
    // Weak models sometimes decide to delegate but leave workerName empty while
    // naming the report in their reasoning. If exactly one report is named
    // there, recover it deterministically; ambiguity falls back to self.
    const mentioned = reportNames.filter((n) =>
      new RegExp(`\\b${n}\\b`, "i").test(decision.reason)
    );
    if (mentioned.length === 1) {
      return {
        kind: "delegate",
        workerName: mentioned[0],
        reason: decision.reason,
        task: decision.refinedTask,
      };
    }
    return {
      kind: "self",
      reason: `${decision.reason} (wanted to delegate to "${decision.workerName ?? "?"}", who doesn't report to them — kept it instead)`,
    };
  }
  return { kind: "self", reason: decision.reason };
}
