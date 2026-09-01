// Delegation (M4+): tasks flow to agents; supervisors route them.
// Inter-agent "communication" is structured records — a parent run on the
// supervisor, a child run on the worker, and the worker's artifact. One level
// max, enforced in startRun. Flavor prose is generated FROM these records,
// never load-bearing.
import { action, internalAction, internalQuery, mutation } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { generateObject, generateText } from "ai";
import type { Doc, Id } from "./_generated/dataModel";
import { chatModel } from "../vercel/model";
import {
  buildTaskPrompt,
  taskTitle,
  routingSchema,
  buildRoutingPrompt,
  resolveRouting,
  buildHandoffPrompt,
  handoffTitle,
  type AssignedBy,
} from "../vercel/tasks";
import { normalizeAgentName } from "../../lib/agentName";

export const delegationPair = internalQuery({
  args: { supervisorName: v.string(), workerName: v.string() },
  handler: async (ctx, args) => {
    const agents = await ctx.db.query("agents").collect();
    const find = (name: string) =>
      agents.find((a) => normalizeAgentName(a.name) === normalizeAgentName(name)) ?? null;
    const supervisor = find(args.supervisorName);
    if (!supervisor) throw new Error(`Nobody named "${args.supervisorName}" works here.`);
    const worker = find(args.workerName);
    if (!worker) throw new Error(`Nobody named "${args.workerName}" works here.`);
    if (worker.supervisorId !== supervisor._id) {
      throw new Error(
        `${worker.name} does not report to ${supervisor.name}. ` +
          `Set that up first: /supervisor ${worker.name} ${supervisor.name}`
      );
    }
    return { supervisor, worker };
  },
});

export const agentWithReports = internalQuery({
  args: { agentName: v.string() },
  handler: async (ctx, { agentName }) => {
    const agents = await ctx.db.query("agents").collect();
    const agent =
      agents.find((a) => normalizeAgentName(a.name) === normalizeAgentName(agentName)) ?? null;
    if (!agent) throw new Error(`Nobody named "${agentName}" works here.`);
    const reports = agents.filter((a) => a.supervisorId === agent._id);
    return { agent, reports };
  },
});

function extractCost(providerMetadata: unknown): number | undefined {
  const cost = (providerMetadata as { openrouter?: { usage?: { cost?: number } } } | undefined)
    ?.openrouter?.usage?.cost;
  return typeof cost === "number" ? cost : undefined;
}

// Shared execution: run the task as `agent`, produce the report artifact,
// close the run. Returns the artifact for the caller to link further records.
async function performTask(
  ctx: ActionCtx,
  args: {
    agent: Doc<"agents">;
    task: string;
    assignedBy: AssignedBy;
    parentRunId?: Id<"runs">;
  }
): Promise<{ artifactId: Id<"artifacts">; title: string; runId: Id<"runs">; contentMd: string }> {
  const runId: Id<"runs"> = await ctx.runMutation(internal.pipeline.startRun, {
    agentId: args.agent._id,
    trigger: args.parentRunId ? "delegation" : "chat",
    parentRunId: args.parentRunId,
    task: args.task,
  });
  try {
    const { system, prompt } = buildTaskPrompt({
      worker: args.agent,
      assignedBy: args.assignedBy,
      task: args.task,
    });
    const result = await generateText({
      model: chatModel(),
      system,
      prompt,
      providerOptions: { openrouter: { usage: { include: true } } },
    });

    const dateIso = new Date().toISOString().slice(0, 10);
    const title = taskTitle(args.task, dateIso);
    const contentMd = `# ${title}\n\n${result.text.trim()}\n`;
    const artifactId: Id<"artifacts"> = await ctx.runMutation(internal.pipeline.saveArtifact, {
      agentId: args.agent._id,
      runId,
      kind: "report",
      title,
      contentMd,
      version: 1,
      sources: [],
    });
    await ctx.runMutation(internal.pipeline.finishRun, {
      runId,
      artifactId,
      costUsd: extractCost(result.providerMetadata),
    });
    return { artifactId, title, runId, contentMd };
  } catch (error) {
    await ctx.runMutation(internal.pipeline.failRun, {
      runId,
      error: error instanceof Error ? error.message.slice(0, 500) : String(error),
    });
    throw error;
  }
}

// Explicit delegation: the CEO forces the routing (/delegate <boss> <worker> <task>).
export const delegate = action({
  args: {
    supervisorName: v.string(),
    workerName: v.string(),
    task: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ supervisor: string; worker: string; title: string }> => {
    if (!args.task.trim()) throw new Error("Describe the task to delegate.");
    const { supervisor, worker } = await ctx.runQuery(internal.delegation.delegationPair, {
      supervisorName: args.supervisorName,
      workerName: args.workerName,
    });

    const parentRunId: Id<"runs"> = await ctx.runMutation(internal.pipeline.startRun, {
      agentId: supervisor._id,
      trigger: "chat",
      task: `Delegate to ${worker.name}: ${args.task.trim()}`,
    });
    try {
      const { artifactId, title } = await performTask(ctx, {
        agent: worker,
        task: args.task.trim(),
        assignedBy: { role: "supervisor", name: supervisor.name },
        parentRunId,
      });
      await ctx.runMutation(internal.pipeline.finishRun, { runId: parentRunId, artifactId });
      return { supervisor: supervisor.name, worker: worker.name, title };
    } catch (error) {
      await ctx.runMutation(internal.pipeline.failRun, {
        runId: parentRunId,
        error: `Delegated task failed: ${
          error instanceof Error ? error.message.slice(0, 400) : String(error)
        }`,
      });
      throw error;
    }
  },
});

// Autonomous routing: the CEO assigns a task to an agent; if that agent leads
// a team, THEY decide (in persona, against their reports' job descriptions)
// whether to keep it or hand it down. The decision + reason become records.
interface AssignOutcome {
  assignee: string;
  executor: string;
  delegated: boolean;
  reason?: string;
  title: string;
}

async function runAssignTask(
  ctx: ActionCtx,
  args: { agentName: string; task: string }
): Promise<AssignOutcome> {
    if (!args.task.trim()) throw new Error("Describe the task.");
    const task = args.task.trim();
    const { agent, reports } = await ctx.runQuery(internal.delegation.agentWithReports, {
      agentName: args.agentName,
    });

    // No team → they simply do the work.
    if (reports.length === 0) {
      const { title } = await performTask(ctx, {
        agent,
        task,
        assignedBy: { role: "ceo" },
      });
      return { assignee: agent.name, executor: agent.name, delegated: false, title };
    }

    // They lead a team → routing decision, in persona.
    const routingPrompt = buildRoutingPrompt({
      supervisor: agent,
      reports: reports.map((r) => ({
        name: r.name,
        jobTitle: r.jobTitle,
        jobDescription: r.jobDescription,
      })),
      task,
    });
    const decision = await generateObject({
      model: chatModel(),
      schema: routingSchema,
      system: routingPrompt.system,
      prompt: routingPrompt.prompt,
    });
    const routing = resolveRouting(
      decision.object,
      reports.map((r) => r.name)
    );

    if (routing.kind === "self") {
      const { title } = await performTask(ctx, {
        agent,
        task,
        assignedBy: { role: "ceo" },
      });
      return {
        assignee: agent.name,
        executor: agent.name,
        delegated: false,
        reason: routing.reason,
        title,
      };
    }

    const worker = reports.find((r) => r.name === routing.workerName)!;
    const workerTask = routing.task?.trim() || task;
    const parentRunId: Id<"runs"> = await ctx.runMutation(internal.pipeline.startRun, {
      agentId: agent._id,
      trigger: "chat",
      task: `Delegate to ${worker.name} — ${routing.reason}: ${workerTask}`,
    });
    try {
      const workerResult = await performTask(ctx, {
        agent: worker,
        task: workerTask,
        assignedBy: { role: "supervisor", name: agent.name },
        parentRunId,
      });

      // The supervisor closes the loop: a covering brief to the CEO in their
      // own voice, with the worker's report attached in full below it.
      const handoff = buildHandoffPrompt({
        supervisor: agent,
        workerName: worker.name,
        task,
        reportMd: workerResult.contentMd,
      });
      const covering = await generateText({
        model: chatModel(),
        system: handoff.system,
        prompt: handoff.prompt,
        providerOptions: { openrouter: { usage: { include: true } } },
      });
      const dateIso = new Date().toISOString().slice(0, 10);
      const reportTitle = handoffTitle(task, dateIso);
      const handoffMd = [
        `# ${reportTitle}`,
        ``,
        covering.text.trim(),
        ``,
        `---`,
        ``,
        workerResult.contentMd.trim(),
      ].join("\n");
      const handoffArtifactId: Id<"artifacts"> = await ctx.runMutation(
        internal.pipeline.saveArtifact,
        {
          agentId: agent._id,
          runId: parentRunId,
          kind: "note",
          title: reportTitle,
          contentMd: handoffMd,
          version: 1,
          sources: [],
        }
      );
      await ctx.runMutation(internal.pipeline.finishRun, {
        runId: parentRunId,
        artifactId: handoffArtifactId,
        costUsd: extractCost(covering.providerMetadata),
      });
      // "She sends me the brief" — email the handoff to the CEO (best-effort;
      // skips gracefully when email isn't configured).
      await ctx.scheduler.runAfter(0, internal.email.sendArtifact, {
        artifactId: handoffArtifactId,
      });

      return {
        assignee: agent.name,
        executor: worker.name,
        delegated: true,
        reason: routing.reason,
        title: reportTitle,
      };
    } catch (error) {
      await ctx.runMutation(internal.pipeline.failRun, {
        runId: parentRunId,
        error: `Delegated task failed: ${
          error instanceof Error ? error.message.slice(0, 400) : String(error)
        }`,
      });
      throw error;
    }
}

export const assignTask = action({
  args: { agentName: v.string(), task: v.string() },
  handler: (ctx, args): Promise<AssignOutcome> => runAssignTask(ctx, args),
});

// Background variant for dispatch — same behavior, fired by the scheduler.
export const assignTaskBg = internalAction({
  args: { agentName: v.string(), task: v.string() },
  handler: async (ctx, args) => {
    await runAssignTask(ctx, args);
  },
});

// CLI `/task <name> <task> &` — validate cheaply, schedule, return at once.
// Progress shows up in /roster and /status; results in /docs and email.
export const dispatchTask = mutation({
  args: { agentName: v.string(), task: v.string() },
  handler: async (ctx, { agentName, task }) => {
    if (!task.trim()) throw new Error("Describe the task.");
    const agents = await ctx.db.query("agents").collect();
    const agent = agents.find((a) => normalizeAgentName(a.name) === normalizeAgentName(agentName));
    if (!agent) throw new Error(`Nobody named "${agentName}" works here.`);
    await ctx.scheduler.runAfter(0, internal.delegation.assignTaskBg, {
      agentName: agent.name,
      task: task.trim(),
    });
    return { agent: agent.name };
  },
});
