import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { validateAgentName } from "../../lib/agentName";
import { findAgentByName as findByName } from "./model/agents";

export const hire = mutation({
  args: {
    name: v.string(),
    jobTitle: v.string(),
    jobDescription: v.string(),
    successfulDay: v.array(v.string()),
    traits: v.array(v.string()),
    notes: v.string(),
    supervisorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const nameError = validateAgentName(args.name);
    if (nameError) throw new Error(nameError);
    if (!args.jobTitle.trim()) throw new Error("Job title is required.");
    if (!args.jobDescription.trim()) throw new Error("Job description is required.");
    if (args.successfulDay.length === 0) {
      throw new Error("Describe at least one item of a successful day.");
    }
    const existing = await findByName(ctx, args.name);
    if (existing) throw new Error(`An agent named "${existing.name}" already works here.`);

    let supervisorId: Id<"agents"> | undefined;
    if (args.supervisorName) {
      const supervisor = await findByName(ctx, args.supervisorName);
      if (!supervisor) throw new Error(`Supervisor "${args.supervisorName}" not found.`);
      supervisorId = supervisor._id;
    }

    const agentId = await ctx.db.insert("agents", {
      name: args.name.trim(),
      jobTitle: args.jobTitle.trim(),
      jobDescription: args.jobDescription.trim(),
      successfulDay: args.successfulDay.map((s) => s.trim()).filter(Boolean),
      personality: {
        traits: args.traits.map((t) => t.trim().toLowerCase()).filter(Boolean),
        notes: args.notes.trim(),
      },
      supervisorId,
      status: "idle",
    });
    return { agentId, name: args.name.trim() };
  },
});

export const roster = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    return Promise.all(
      agents.map(async (agent) => ({
        _id: agent._id,
        name: agent.name,
        jobTitle: agent.jobTitle,
        status: agent.status,
        traits: agent.personality.traits,
        supervisorName: agent.supervisorId
          ? ((await ctx.db.get(agent.supervisorId))?.name ?? null)
          : null,
      }))
    );
  },
});

export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => findByName(ctx, name),
});

export const assignSupervisor = mutation({
  args: { agentName: v.string(), supervisorName: v.string() },
  handler: async (ctx, args) => {
    const agent = await findByName(ctx, args.agentName);
    if (!agent) throw new Error(`Agent "${args.agentName}" not found.`);
    const supervisor = await findByName(ctx, args.supervisorName);
    if (!supervisor) throw new Error(`Supervisor "${args.supervisorName}" not found.`);
    if (agent._id === supervisor._id) throw new Error("An agent cannot supervise themselves.");
    if (supervisor.supervisorId === agent._id) {
      // One level max, per spec — no chains, no cycles.
      throw new Error(`${supervisor.name} already reports to ${agent.name}; no chains allowed.`);
    }
    await ctx.db.patch(agent._id, { supervisorId: supervisor._id });
    return { agent: agent.name, supervisor: supervisor.name };
  },
});

export const fire = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const agent = await findByName(ctx, name);
    if (!agent) throw new Error(`Agent "${name}" not found.`);
    const reports = await ctx.db.query("agents").collect();
    for (const report of reports) {
      if (report.supervisorId === agent._id) {
        await ctx.db.patch(report._id, { supervisorId: undefined });
      }
    }
    for (const table of ["jobs", "runs", "artifacts"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
    await ctx.db.delete(agent._id);
    return { fired: agent.name };
  },
});

export const getByNameInternal = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, { name }) => findByName(ctx, name),
});

export const saveThreadId = internalMutation({
  args: { agentId: v.id("agents"), threadId: v.string() },
  handler: async (ctx, { agentId, threadId }) => {
    await ctx.db.patch(agentId, { chatThreadId: threadId });
  },
});

export const setStatus = internalMutation({
  args: {
    agentId: v.id("agents"),
    status: v.union(v.literal("idle"), v.literal("working")),
  },
  handler: async (ctx, { agentId, status }) => {
    await ctx.db.patch(agentId, { status });
  },
});
