// Work-state queries: the real task state injected into every chat call so
// status answers come from records, never invention. (Documents live in
// artifacts.ts; run lifecycle in runs.ts.)
import { query, internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { WorkState } from "../vercel/prompts";

const RECENT_RUNS = 10;
const RECENT_ARTIFACTS = 5;

async function collectState(ctx: QueryCtx, agentId: Id<"agents">): Promise<WorkState | null> {
  const agent = await ctx.db.get(agentId);
  if (!agent) return null;

  const supervisor = agent.supervisorId ? await ctx.db.get(agent.supervisorId) : null;
  const everyone = await ctx.db.query("agents").collect();
  const reportNames = everyone.filter((a) => a.supervisorId === agentId).map((a) => a.name);

  const jobs = await ctx.db
    .query("jobs")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .collect();

  const runs = await ctx.db
    .query("runs")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .order("desc")
    .take(RECENT_RUNS);

  const artifacts = await ctx.db
    .query("artifacts")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .order("desc")
    .take(RECENT_ARTIFACTS);

  return {
    status: agent.status,
    supervisorName: supervisor?.name,
    reportNames,
    jobs: jobs.map((j) => ({ title: j.title, schedule: j.schedule, active: j.active })),
    runs: runs.map((r) => ({
      trigger: r.trigger,
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      error: r.error,
      task: r.task,
    })),
    artifacts: artifacts.map((a) => ({
      title: a.title,
      kind: a.kind,
      version: a.version,
      createdAt: a._creationTime,
    })),
  };
}

// Used by the CLI's /status command.
export const statusForAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => collectState(ctx, agentId),
});

// Injected into every chat call so status answers reflect real task state.
export const stateForAgent = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => collectState(ctx, agentId),
});
