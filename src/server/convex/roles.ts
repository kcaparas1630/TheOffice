// Roles: defined once, assigned to people. The role owns the job title and
// the job description; agents copy both when assigned so prompts, seating
// and the CLI keep reading `agent.jobTitle` / `agent.jobDescription`. Editing
// a role re-syncs everyone who holds it.
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function findRoleByName(ctx: QueryCtx, name: string): Promise<Doc<"roles"> | null> {
  const target = name.trim().toLowerCase();
  const roles = await ctx.db.query("roles").collect();
  return roles.find((r) => r.roleName.toLowerCase() === target) ?? null;
}

// Copy the role's title/description onto everyone holding it.
export async function syncHolders(ctx: MutationCtx, role: Doc<"roles">) {
  const agents = await ctx.db.query("agents").collect();
  for (const agent of agents) {
    if (agent.roleId === role._id) {
      await ctx.db.patch(agent._id, { jobTitle: role.roleName, jobDescription: role.roleDescription });
    }
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db.query("roles").collect();
    const agents = await ctx.db.query("agents").collect();
    const byId = new Map(roles.map((r) => [r._id, r]));
    return roles
      .map((r) => ({
        _id: r._id,
        roleName: r.roleName,
        roleDescription: r.roleDescription,
        department: r.department ?? null,
        supervisorId: r.supervisorId ?? null,
        supervisorName: r.supervisorId ? (byId.get(r.supervisorId)?.roleName ?? null) : null,
        createdAt: r._creationTime,
        holders: agents.filter((a) => a.roleId === r._id).map((a) => a.name),
      }))
      .sort((a, b) => (a.department ?? "").localeCompare(b.department ?? "") || a.roleName.localeCompare(b.roleName));
  },
});

export const create = mutation({
  args: {
    roleName: v.string(),
    roleDescription: v.string(),
    department: v.optional(v.string()),
    supervisorId: v.optional(v.id("roles")),
  },
  handler: async (ctx, args) => {
    const roleName = args.roleName.trim();
    if (!roleName) throw new Error("Role name is required.");
    if (!args.roleDescription.trim()) throw new Error("Role description is required.");
    if (await findRoleByName(ctx, roleName)) throw new Error(`A role named "${roleName}" already exists.`);
    if (args.supervisorId && !(await ctx.db.get(args.supervisorId))) throw new Error("Supervisor role not found.");
    const roleId = await ctx.db.insert("roles", {
      roleName,
      roleDescription: args.roleDescription.trim(),
      department: args.department?.trim() || undefined,
      supervisorId: args.supervisorId,
    });
    return { roleId, roleName };
  },
});

export const update = mutation({
  args: {
    roleId: v.id("roles"),
    roleName: v.optional(v.string()),
    roleDescription: v.optional(v.string()),
    department: v.optional(v.string()),
    // "" clears the supervisor.
    supervisorId: v.optional(v.union(v.id("roles"), v.literal(""))),
  },
  handler: async (ctx, args) => {
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found.");
    const patch: Partial<Doc<"roles">> = {};
    if (args.roleName !== undefined) {
      const roleName = args.roleName.trim();
      if (!roleName) throw new Error("Role name is required.");
      const clash = await findRoleByName(ctx, roleName);
      if (clash && clash._id !== role._id) throw new Error(`A role named "${roleName}" already exists.`);
      patch.roleName = roleName;
    }
    if (args.roleDescription !== undefined) {
      if (!args.roleDescription.trim()) throw new Error("Role description is required.");
      patch.roleDescription = args.roleDescription.trim();
    }
    if (args.department !== undefined) patch.department = args.department.trim() || undefined;
    if (args.supervisorId !== undefined) {
      if (args.supervisorId === "") {
        patch.supervisorId = undefined;
      } else {
        if (args.supervisorId === role._id) throw new Error("A role cannot report to itself.");
        const boss = await ctx.db.get(args.supervisorId);
        if (!boss) throw new Error("Supervisor role not found.");
        if (boss.supervisorId === role._id) throw new Error(`${boss.roleName} already reports to ${role.roleName}.`);
        patch.supervisorId = args.supervisorId;
      }
    }
    await ctx.db.patch(role._id, patch);
    const updated = (await ctx.db.get(role._id))!;
    await syncHolders(ctx, updated);
    return { roleName: updated.roleName };
  },
});

export const remove = mutation({
  args: { roleId: v.id("roles") },
  handler: async (ctx, { roleId }) => {
    const role = await ctx.db.get(roleId);
    if (!role) throw new Error("Role not found.");
    const agents = await ctx.db.query("agents").collect();
    const holders = agents.filter((a) => a.roleId === roleId).map((a) => a.name);
    if (holders.length > 0) {
      throw new Error(`${role.roleName} is held by ${holders.join(", ")}. Reassign them first.`);
    }
    const roles = await ctx.db.query("roles").collect();
    for (const r of roles) {
      if (r.supervisorId === roleId) await ctx.db.patch(r._id, { supervisorId: undefined });
    }
    await ctx.db.delete(roleId);
    return { removed: role.roleName };
  },
});

// A starter org chart across departments. Idempotent: existing names are
// left alone, so it is safe to run on a live office.
export const STARTER_ROLES: {
  roleName: string;
  department: string;
  roleDescription: string;
  reportsTo?: string;
}[] = [
  {
    roleName: "Chief of Staff",
    department: "Corporate",
    roleDescription:
      "Runs the office on the CEO's behalf: keeps every open thread in view, routes work to the right department, surfaces blockers early, and turns scattered updates into short, decision-ready briefs.",
  },
  {
    roleName: "Executive Assistant",
    department: "Corporate",
    roleDescription:
      "Keeps the CEO's day running: schedules, follow-ups, meeting notes and the small logistics that would otherwise slip.",
    reportsTo: "Chief of Staff",
  },
  {
    roleName: "Receptionist",
    department: "Front desk",
    roleDescription:
      "First point of contact for the office: greets visitors, answers general questions, and routes requests to whoever can actually help.",
    reportsTo: "Chief of Staff",
  },
  {
    roleName: "Head of IT",
    department: "IT",
    roleDescription:
      "Owns the office's tools and systems: keeps them reliable and secure, evaluates new tech, and explains trade-offs in plain language.",
    reportsTo: "Chief of Staff",
  },
  {
    roleName: "IT Support Engineer",
    department: "IT",
    roleDescription:
      "Fixes what breaks and documents how: laptops, accounts, access, and the recurring questions that deserve a written answer.",
    reportsTo: "Head of IT",
  },
  {
    roleName: "Head of Sales",
    department: "Sales",
    roleDescription:
      "Builds and runs the pipeline: qualifies leads, prioritises accounts, and reports honestly on what is moving and what is stuck.",
    reportsTo: "Chief of Staff",
  },
  {
    roleName: "Account Executive",
    department: "Sales",
    roleDescription:
      "Works deals from first call to close: discovery, proposals, follow-ups, and clean notes on every account.",
    reportsTo: "Head of Sales",
  },
  {
    roleName: "Head of Marketing",
    department: "Marketing",
    roleDescription:
      "Shapes how the company is seen: positioning, campaigns, and a steady read on what the market is talking about.",
    reportsTo: "Chief of Staff",
  },
  {
    roleName: "Content Marketer",
    department: "Marketing",
    roleDescription:
      "Writes the words people actually read: posts, newsletters, launch notes, and the research behind them.",
    reportsTo: "Head of Marketing",
  },
  {
    roleName: "Head of Customer Success",
    department: "Customer Success",
    roleDescription:
      "Makes sure customers get value after they sign: onboarding, health checks, renewals, and escalations that reach the right people.",
    reportsTo: "Chief of Staff",
  },
  {
    roleName: "Customer Success Manager",
    department: "Customer Success",
    roleDescription:
      "Owns a book of customers: regular check-ins, clear answers to their questions, and early warning when something is off.",
    reportsTo: "Head of Customer Success",
  },
  {
    roleName: "Researcher",
    department: "Corporate",
    roleDescription:
      "Digs into whatever the office needs to understand next and turns it into clear, sourced, CEO-ready write-ups.",
    reportsTo: "Chief of Staff",
  },
];

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const created: string[] = [];
    const ids = new Map<string, Id<"roles">>();
    for (const r of await ctx.db.query("roles").collect()) ids.set(r.roleName.toLowerCase(), r._id);
    for (const r of STARTER_ROLES) {
      if (ids.has(r.roleName.toLowerCase())) continue;
      const id = await ctx.db.insert("roles", {
        roleName: r.roleName,
        roleDescription: r.roleDescription,
        department: r.department,
      });
      ids.set(r.roleName.toLowerCase(), id);
      created.push(r.roleName);
    }
    // Second pass: wire the org chart now that every role exists.
    for (const r of STARTER_ROLES) {
      if (!r.reportsTo) continue;
      const id = ids.get(r.roleName.toLowerCase());
      const boss = ids.get(r.reportsTo.toLowerCase());
      if (!id || !boss) continue;
      const role = await ctx.db.get(id);
      if (role && !role.supervisorId) await ctx.db.patch(id, { supervisorId: boss });
    }
    // Anyone whose free-text job title matches a role name gets the role.
    const adopted: string[] = [];
    for (const agent of await ctx.db.query("agents").collect()) {
      if (agent.roleId) continue;
      const id = ids.get(agent.jobTitle.trim().toLowerCase());
      if (!id) continue;
      const role = (await ctx.db.get(id))!;
      await ctx.db.patch(agent._id, { roleId: id, jobTitle: role.roleName, jobDescription: role.roleDescription });
      adopted.push(`${agent.name} → ${role.roleName}`);
    }
    return { created, adopted };
  },
});
