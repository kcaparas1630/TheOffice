// Run + artifact lifecycle plumbing (internal). Every unit of work in the
// office — brief runs, delegated tasks, revisions — goes through these.
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { settleAgentStatus } from "./model/runs";

export const startRun = internalMutation({
  args: {
    agentId: v.id("agents"),
    jobId: v.optional(v.id("jobs")),
    trigger: v.union(v.literal("schedule"), v.literal("chat"), v.literal("delegation")),
    parentRunId: v.optional(v.id("runs")),
    task: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.parentRunId) {
      // One level max: a child run can never itself be a parent.
      const parent = await ctx.db.get(args.parentRunId);
      if (parent?.parentRunId) throw new Error("Delegation chains are not allowed (one level max).");
    }
    const runId = await ctx.db.insert("runs", {
      agentId: args.agentId,
      jobId: args.jobId,
      trigger: args.trigger,
      parentRunId: args.parentRunId,
      task: args.task,
      status: "running",
      startedAt: Date.now(),
    });
    await ctx.db.patch(args.agentId, { status: "working" });
    return runId;
  },
});

export const finishRun = internalMutation({
  args: {
    runId: v.id("runs"),
    artifactId: v.id("artifacts"),
    costUsd: v.optional(v.number()),
  },
  handler: async (ctx, { runId, artifactId, costUsd }) => {
    const run = await ctx.db.get(runId);
    if (!run) return;
    await ctx.db.patch(runId, { status: "done", finishedAt: Date.now(), artifactId, costUsd });
    await settleAgentStatus(ctx, run.agentId);
  },
});

export const failRun = internalMutation({
  args: { runId: v.id("runs"), error: v.string() },
  handler: async (ctx, { runId, error }) => {
    const run = await ctx.db.get(runId);
    if (!run) return;
    // No silent losses: the failure is on the record the agent reports from.
    await ctx.db.patch(runId, { status: "failed", finishedAt: Date.now(), error });
    await settleAgentStatus(ctx, run.agentId);
  },
});

export const saveArtifact = internalMutation({
  args: {
    agentId: v.id("agents"),
    runId: v.id("runs"),
    kind: v.union(v.literal("brief"), v.literal("report"), v.literal("note")),
    title: v.string(),
    contentMd: v.string(),
    version: v.number(),
    parentId: v.optional(v.id("artifacts")),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
  },
  handler: async (ctx, args) => ctx.db.insert("artifacts", args),
});
