// Delegation (M4): a supervisor hands a task to one of their reports.
// Inter-agent "communication" is structured records — a parent run on the
// supervisor, a child run on the worker, and the worker's artifact. One level
// max, enforced in startRun. Flavor prose is generated FROM these records,
// never load-bearing.
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { generateText } from "ai";
import type { Id } from "./_generated/dataModel";
import { chatModel } from "../vercel/model";
import { buildTaskPrompt, taskTitle } from "../vercel/tasks";
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

    // Parent run: the supervisor is on the hook for the outcome.
    const parentRunId: Id<"runs"> = await ctx.runMutation(internal.pipeline.startRun, {
      agentId: supervisor._id,
      trigger: "chat",
      task: `Delegate to ${worker.name}: ${args.task.trim()}`,
    });
    // Child run: the worker does the work.
    const childRunId: Id<"runs"> = await ctx.runMutation(internal.pipeline.startRun, {
      agentId: worker._id,
      trigger: "delegation",
      parentRunId,
      task: args.task.trim(),
    });

    try {
      const { system, prompt } = buildTaskPrompt({
        worker,
        supervisorName: supervisor.name,
        task: args.task.trim(),
      });
      const result = await generateText({
        model: chatModel(),
        system,
        prompt,
        providerOptions: { openrouter: { usage: { include: true } } },
      });

      const dateIso = new Date().toISOString().slice(0, 10);
      const title = taskTitle(args.task, dateIso);
      const artifactId: Id<"artifacts"> = await ctx.runMutation(internal.pipeline.saveArtifact, {
        agentId: worker._id,
        runId: childRunId,
        kind: "report",
        title,
        contentMd: `# ${title}\n\n${result.text.trim()}\n`,
        version: 1,
        sources: [],
      });

      const costUsd = (
        result.providerMetadata as { openrouter?: { usage?: { cost?: number } } } | undefined
      )?.openrouter?.usage?.cost;
      await ctx.runMutation(internal.pipeline.finishRun, {
        runId: childRunId,
        artifactId,
        costUsd: typeof costUsd === "number" ? costUsd : undefined,
      });
      // The parent closes with the delivered artifact — the supervisor's record
      // points at what their report produced.
      await ctx.runMutation(internal.pipeline.finishRun, { runId: parentRunId, artifactId });

      return { supervisor: supervisor.name, worker: worker.name, title };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : String(error);
      await ctx.runMutation(internal.pipeline.failRun, { runId: childRunId, error: message });
      await ctx.runMutation(internal.pipeline.failRun, {
        runId: parentRunId,
        error: `Delegated task failed: ${message}`,
      });
      throw error;
    }
  },
});
