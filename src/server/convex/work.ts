// Work-state queries: the real task state injected into every chat call so
// status answers come from records, never invention. (Documents live in
// artifacts.ts; run lifecycle in runs.ts.)
import { query, internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { WorkState } from "../vercel/prompts";
import {
  computeMeasures,
  scoreMetrics,
  SCORE_WINDOW_MS,
  type MetricScore,
  type RoleMetric,
  type RunRow,
} from "../../lib/metrics";

const RECENT_RUNS = 10;
const RECENT_ARTIFACTS = 5;

// Score the role's metrics from the last 7 days of runs and documents. The
// numbers come from rows, so an agent can only report what actually happened.
async function scorecardFor(ctx: QueryCtx, agentId: Id<"agents">, metrics: RoleMetric[]): Promise<MetricScore[]> {
  if (metrics.length === 0) return [];
  const now = Date.now();
  const since = now - SCORE_WINDOW_MS;
  const recent = await ctx.db
    .query("runs")
    .filter((q) => q.or(q.gte(q.field("startedAt"), since), q.eq(q.field("status"), "running")))
    .collect();
  const ownerOf = new Map(recent.map((r) => [r._id, r.agentId]));
  const runs: RunRow[] = [];
  for (const r of recent) {
    let parentAgentId: Id<"agents"> | null = null;
    if (r.parentRunId) {
      parentAgentId = ownerOf.get(r.parentRunId) ?? (await ctx.db.get(r.parentRunId))?.agentId ?? null;
    }
    runs.push({
      agentId: r.agentId,
      parentAgentId,
      trigger: r.trigger,
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt ?? null,
    });
  }
  const artifacts = await ctx.db
    .query("artifacts")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .filter((q) => q.gte(q.field("_creationTime"), since))
    .collect();
  const values = computeMeasures({ agentId, now, runs, artifactsAt: artifacts.map((a) => a._creationTime) });
  return scoreMetrics(metrics, values);
}

export async function collectState(ctx: QueryCtx, agentId: Id<"agents">): Promise<WorkState | null> {
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

  const role = agent.roleId ? await ctx.db.get(agent.roleId) : null;
  const scorecard = await scorecardFor(ctx, agentId, (role?.metrics ?? []) as RoleMetric[]);

  return {
    scorecard,
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

// The Employees dialog's Job tab: the role's duties and the scored metrics.
export const scorecardForAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) return null;
    const role = agent.roleId ? await ctx.db.get(agent.roleId) : null;
    const metrics = (role?.metrics ?? []) as RoleMetric[];
    return {
      roleName: role?.roleName ?? null,
      duties: role?.duties ?? [],
      scorecard: await scorecardFor(ctx, agentId, metrics),
      windowDays: 7,
    };
  },
});

// Injected into every chat call so status answers reflect real task state.
export const stateForAgent = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => collectState(ctx, agentId),
});
