// Run + artifact lifecycle plumbing (internal). Every unit of work in the
// office — brief runs, delegated tasks, revisions — goes through these.
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { settleAgentStatus } from "./model/runs";
import { bumpSkillUses } from "./model/skills";

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
    // Skills whose tools the run invoked (from the model's step list, never prose).
    skillIds: v.optional(v.array(v.id("skills"))),
  },
  handler: async (ctx, { runId, artifactId, costUsd, skillIds }) => {
    const run = await ctx.db.get(runId);
    if (!run) return;
    await ctx.db.patch(runId, { status: "done", finishedAt: Date.now(), artifactId, costUsd, skillIds });
    await settleAgentStatus(ctx, run.agentId);
    const promoted = skillIds?.length ? await bumpSkillUses(ctx, run.agentId, skillIds) : [];
    return { promoted };
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

// A run only ends through finishRun/failRun, which the action itself calls.
// If the process dies first (backend restart, the action time limit, a hung
// fetch) the row stays "running" and its agent stays "working" forever. The
// reaper cron closes those out as failures so the record — and the office —
// stops lying. Anything alive this long is dead; real runs finish in minutes.
export const STALE_RUN_MS = 15 * 60_000;

export const reapStaleRuns = internalMutation({
  args: { olderThanMs: v.optional(v.number()) },
  returns: v.number(),
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - (olderThanMs ?? STALE_RUN_MS);
    const stale = await ctx.db
      .query("runs")
      .filter((q) => q.and(q.eq(q.field("status"), "running"), q.lt(q.field("startedAt"), cutoff)))
      .collect();
    for (const run of stale) {
      await ctx.db.patch(run._id, {
        status: "failed",
        finishedAt: Date.now(),
        error: "Timed out: the run never reported back (process ended mid-run).",
      });
      await settleAgentStatus(ctx, run.agentId);
    }
    return stale.length;
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
