// Pure prompt construction for an agent's turn on the office heartbeat:
// given their profile, work state (with scorecard), colleagues, inbox and
// recent turns, the agent picks ONE action. The decision is structured and
// validated here so only records-backed moves reach the runtime.
import { z } from "zod";
import { buildSystemPrompt, formatWorkState, type AgentProfile, type WorkState } from "./prompts";
import { describePhase, type Phase } from "../../lib/clock";

export const TURN_ACTIONS = ["work", "delegate", "message", "report", "rest"] as const;
export type TurnAction = (typeof TURN_ACTIONS)[number];

export const turnDecisionSchema = z.object({
  action: z.enum(TURN_ACTIONS),
  reason: z
    .string()
    .describe("One sentence: which duty, which metric that is behind, or which inbox message this answers."),
  task: z.string().optional().describe("For work or delegate: the one deliverable, one sentence, concrete."),
  to: z.string().optional().describe("For delegate or message: the colleague's name exactly as listed."),
  message: z.string().optional().describe("For message or report: the text. Short, specific, no status chatter."),
});
export type TurnDecision = z.infer<typeof turnDecisionSchema>;

export interface Colleague {
  name: string;
  jobTitle: string;
  relation: "report" | "supervisor" | "peer";
  status: "idle" | "working";
}

export interface InboxItem {
  from: string;
  text: string;
  at: number;
}

export interface PastTurn {
  at: number;
  action: string;
  summary: string;
}

export interface TurnContext {
  profile: AgentProfile;
  state: WorkState;
  phase: Phase;
  colleagues: Colleague[];
  inbox: InboxItem[];
  recentTurns: PastTurn[];
  now: number;
}

const ago = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

export function buildTurnPrompt(ctx: TurnContext): { system: string; prompt: string } {
  const reports = ctx.colleagues.filter((c) => c.relation === "report");
  const lines = [
    buildSystemPrompt(ctx.profile),
    ``,
    formatWorkState(ctx.state),
    ``,
    `## Colleagues`,
    ...(ctx.colleagues.length === 0
      ? [`Nobody else works here yet.`]
      : ctx.colleagues.map(
          (c) =>
            `- ${c.name} (${c.jobTitle}) — ${
              c.relation === "report" ? "reports to you" : c.relation === "supervisor" ? "your supervisor" : "peer"
            }, ${c.status}`
        )),
    ``,
    `## Your inbox (unread, from colleagues)`,
    ...(ctx.inbox.length === 0
      ? [`Empty.`]
      : ctx.inbox.map((m) => `- from ${m.from}, ${ago(ctx.now - m.at)}: "${m.text}"`)),
    ``,
    `## Your recent turns`,
    ...(ctx.recentTurns.length === 0
      ? [`None yet — this is your first turn.`]
      : ctx.recentTurns.map((t) => `- ${ago(ctx.now - t.at)}: ${t.action} — ${t.summary}`)),
  ];
  const system = lines.join("\n");

  const prompt = [
    `It is your turn. It is ${describePhase(ctx.phase)} at the office. Choose exactly ONE action:`,
    ``,
    `- work: produce one concrete deliverable from your duties that moves a metric marked "behind" on your scorecard. Describe it in one sentence as \`task\`. Do not redo a document already listed above this week.`,
    reports.length > 0
      ? `- delegate: hand one concrete task to someone who reports to you (${reports.map((r) => r.name).join(", ")}) as \`to\` + \`task\`. Only when it fits their job better than yours.`
      : `- delegate: not available — nobody reports to you.`,
    `- message: a short note to a colleague (\`to\` + \`message\`) when you need something from them, or to answer an inbox message. Not for pleasantries.`,
    `- report: a short note to Kent (\`message\`) only for something he must know or decide. Never a status update he can read from records.`,
    `- rest: when nothing is behind, the inbox is empty, and nothing needs saying. Resting is a good answer, not a failure.`,
    ``,
    `Rules: answer the inbox before anything else. Never invent progress; the scorecard is counted from records, not by you. One action, then stop.`,
  ].join("\n");

  return { system, prompt };
}

export type ResolvedTurn =
  | { action: "work"; task: string; reason: string }
  | { action: "delegate"; to: string; task: string; reason: string }
  | { action: "message"; to: string; text: string; reason: string }
  | { action: "report"; text: string; reason: string }
  | { action: "rest"; reason: string };

// Make the model's decision safe: names must be real, delegation only down
// the chain, required fields present. Anything malformed becomes a rest with
// the reason on record — the office never guesses what was meant.
export function resolveTurn(d: TurnDecision, ctx: TurnContext): ResolvedTurn {
  const reason = d.reason.trim() || "no reason given";
  const find = (name: string | undefined) =>
    ctx.colleagues.find((c) => c.name.toLowerCase() === (name ?? "").trim().toLowerCase()) ?? null;
  const task = d.task?.trim() ?? "";
  const text = d.message?.trim() ?? "";

  switch (d.action) {
    case "work":
      if (!task) return { action: "rest", reason: `wanted to work but gave no task (${reason})` };
      return { action: "work", task, reason };
    case "delegate": {
      const who = find(d.to);
      if (!who) return { action: "rest", reason: `wanted to delegate to unknown "${d.to ?? ""}" (${reason})` };
      if (who.relation !== "report") return { action: "rest", reason: `${who.name} does not report to them (${reason})` };
      if (!task) return { action: "rest", reason: `wanted to delegate to ${who.name} but gave no task (${reason})` };
      return { action: "delegate", to: who.name, task, reason };
    }
    case "message": {
      const who = find(d.to);
      if (!who) return { action: "rest", reason: `wanted to message unknown "${d.to ?? ""}" (${reason})` };
      if (!text) return { action: "rest", reason: `wanted to message ${who.name} but wrote nothing (${reason})` };
      return { action: "message", to: who.name, text, reason };
    }
    case "report":
      if (!text) return { action: "rest", reason: `wanted to report but wrote nothing (${reason})` };
      return { action: "report", text, reason };
    case "rest":
      return { action: "rest", reason };
  }
}

// One line for the turns record and the office log.
export function turnSummary(t: ResolvedTurn): string {
  const clip = (s: string) => (s.length > 90 ? s.slice(0, 89).trimEnd() + "…" : s);
  switch (t.action) {
    case "work":
      return `work: ${clip(t.task)}`;
    case "delegate":
      return `delegate to ${t.to}: ${clip(t.task)}`;
    case "message":
      return `message to ${t.to}: ${clip(t.text)}`;
    case "report":
      return `report to Kent: ${clip(t.text)}`;
    case "rest":
      return `rest: ${clip(t.reason)}`;
  }
}
