import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { validateAgentName } from "../../lib/agentName";
import { findAgentByName as findByName } from "./model/agents";
import { withSkills } from "./model/skills";
import { clampLevel } from "../../lib/skills";
import { isSpriteId, SPRITE_IDS } from "../../lib/office/sprites";

export const hire = mutation({
  args: {
    name: v.string(),
    // Either a role (title + description come from it) or free text.
    roleId: v.optional(v.id("roles")),
    jobTitle: v.optional(v.string()),
    jobDescription: v.optional(v.string()),
    successfulDay: v.array(v.string()),
    traits: v.array(v.string()),
    notes: v.string(),
    supervisorName: v.optional(v.string()),
    sprite: v.optional(v.string()),
    // Skills they start with, each at a level (1–5).
    skills: v.optional(v.array(v.object({ skillId: v.id("skills"), level: v.number() }))),
  },
  handler: async (ctx, args) => {
    if (args.sprite && !isSpriteId(args.sprite)) {
      throw new Error(`Unknown sprite "${args.sprite}". Choose one of: ${SPRITE_IDS.join(", ")}.`);
    }
    const nameError = validateAgentName(args.name);
    if (nameError) throw new Error(nameError);
    let jobTitle = args.jobTitle?.trim() ?? "";
    let jobDescription = args.jobDescription?.trim() ?? "";
    if (args.roleId) {
      const role = await ctx.db.get(args.roleId);
      if (!role) throw new Error("Role not found.");
      jobTitle = role.roleName;
      jobDescription = role.roleDescription;
    }
    if (!jobTitle) throw new Error("Pick a role (or give a job title).");
    if (!jobDescription) throw new Error("Job description is required.");
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
      roleId: args.roleId,
      jobTitle,
      jobDescription,
      successfulDay: args.successfulDay.map((s) => s.trim()).filter(Boolean),
      personality: {
        traits: args.traits.map((t) => t.trim().toLowerCase()).filter(Boolean),
        notes: args.notes.trim(),
      },
      supervisorId,
      sprite: args.sprite,
      status: "idle",
    });
    const seen = new Set<string>();
    for (const s of args.skills ?? []) {
      if (seen.has(s.skillId)) continue;
      seen.add(s.skillId);
      if (!(await ctx.db.get(s.skillId))) throw new Error("Skill not found.");
      await ctx.db.insert("agentSkills", { agentId, skillId: s.skillId, level: clampLevel(s.level), uses: 0 });
    }
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
        roleId: agent.roleId ?? null,
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

// Edit an employee's profile. Only the fields given change; the name is their
// @handle and stays. `supervisorName: ""` clears the supervisor.
export const update = mutation({
  args: {
    name: v.string(),
    jobTitle: v.optional(v.string()),
    jobDescription: v.optional(v.string()),
    successfulDay: v.optional(v.array(v.string())),
    traits: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    supervisorName: v.optional(v.string()),
    roleId: v.optional(v.id("roles")),
  },
  handler: async (ctx, args) => {
    const agent = await findByName(ctx, args.name);
    if (!agent) throw new Error(`Nobody named "${args.name}" works here.`);
    const patch: Partial<{
      roleId: Id<"roles">;
      jobTitle: string;
      jobDescription: string;
      successfulDay: string[];
      personality: { traits: string[]; notes: string };
      supervisorId: Id<"agents"> | undefined;
    }> = {};

    if (args.roleId !== undefined) {
      const role = await ctx.db.get(args.roleId);
      if (!role) throw new Error("Role not found.");
      patch.roleId = role._id;
      patch.jobTitle = role.roleName;
      patch.jobDescription = role.roleDescription;
    }
    if (args.jobTitle !== undefined && args.roleId === undefined) {
      if (!args.jobTitle.trim()) throw new Error("Job title is required.");
      patch.jobTitle = args.jobTitle.trim();
    }
    if (args.jobDescription !== undefined && args.roleId === undefined) {
      if (!args.jobDescription.trim()) throw new Error("Job description is required.");
      patch.jobDescription = args.jobDescription.trim();
    }
    if (args.successfulDay !== undefined) {
      const day = args.successfulDay.map((s) => s.trim()).filter(Boolean);
      if (day.length === 0) throw new Error("Describe at least one item of a successful day.");
      patch.successfulDay = day;
    }
    if (args.traits !== undefined || args.notes !== undefined) {
      patch.personality = {
        traits:
          args.traits !== undefined
            ? args.traits.map((t) => t.trim().toLowerCase()).filter(Boolean)
            : agent.personality.traits,
        notes: args.notes !== undefined ? args.notes.trim() : agent.personality.notes,
      };
    }
    if (args.supervisorName !== undefined) {
      if (!args.supervisorName.trim()) {
        patch.supervisorId = undefined;
      } else {
        const supervisor = await findByName(ctx, args.supervisorName);
        if (!supervisor) throw new Error(`Supervisor "${args.supervisorName}" not found.`);
        if (supervisor._id === agent._id) throw new Error("An agent cannot supervise themselves.");
        if (supervisor.supervisorId === agent._id) {
          throw new Error(`${supervisor.name} already reports to ${agent.name}; no chains allowed.`);
        }
        patch.supervisorId = supervisor._id;
      }
    }

    await ctx.db.patch(agent._id, patch);
    return { name: agent.name };
  },
});

// Change an agent's look in the pixel office; omit `sprite` to go back to auto.
export const setSprite = mutation({
  args: { name: v.string(), sprite: v.optional(v.string()) },
  handler: async (ctx, { name, sprite }) => {
    const agent = await findByName(ctx, name);
    if (!agent) throw new Error(`Nobody named "${name}" works here.`);
    if (sprite && !isSpriteId(sprite)) {
      throw new Error(`Unknown sprite "${sprite}". Choose one of: ${SPRITE_IDS.join(", ")}.`);
    }
    await ctx.db.patch(agent._id, { sprite });
    return { name: agent.name, sprite: sprite ?? null };
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
    for (const held of await ctx.db
      .query("agentSkills")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect()) {
      await ctx.db.delete(held._id);
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
  handler: async (ctx, { name }) => {
    const agent = await findByName(ctx, name);
    return agent ? withSkills(ctx, agent) : null;
  },
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
