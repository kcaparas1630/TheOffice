// Skills: a central catalogue (imported from Smithery's registry or made by
// hand) and who holds which skill at what level. Imports upsert by slug so
// re-running is safe. Nothing imported executes — tools come from the repo.
import { action, internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { findAgentByName } from "./model/agents";
import { skillsForAgent } from "./model/skills";
import { clampLevel, mapSmitherySkill, slugify, type SkillRow, type SmitherySkill } from "../../lib/skills";
import { SKILL_SEED } from "../../lib/skillSeed";

// The whole catalogue ships to pickers (a few hundred small rows); the cap
// only guards against a runaway import. Paginate when it is earned.
const LIST_MAX = 1000;

// Replace (or clear) a skill's instructions in the side table.
async function setPrompt(ctx: MutationCtx, skillId: Id<"skills">, prompt: string | undefined) {
  const existing = await ctx.db
    .query("skillPrompts")
    .withIndex("by_skill", (q) => q.eq("skillId", skillId))
    .first();
  const text = prompt?.trim();
  if (!text) {
    if (existing) await ctx.db.delete(existing._id);
    return;
  }
  if (existing) await ctx.db.patch(existing._id, { prompt: text });
  else await ctx.db.insert("skillPrompts", { skillId, prompt: text });
}

function matches(skill: Doc<"skills">, needle: string): boolean {
  const q = needle.toLowerCase();
  return (
    skill.name.toLowerCase().includes(q) ||
    skill.slug.toLowerCase().includes(q) ||
    skill.description.toLowerCase().includes(q) ||
    (skill.category ?? "").toLowerCase().includes(q)
  );
}

function summary(s: Doc<"skills">, holders: string[]) {
  return {
    _id: s._id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    category: s.category ?? null,
    source: s.source,
    sourceUrl: s.sourceUrl ?? null,
    verified: s.verified,
    popularity: s.popularity,
    hasPrompt: s.hasPrompt,
    holders,
  };
}

// Catalogue for pickers and the Skills dialog: every skill, most popular
// first, optionally narrowed by a substring and/or a category. Also returns
// the category list with counts so the UI can offer a filter.
export const list = query({
  args: { search: v.optional(v.string()), category: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { search, category, limit }) => {
    const all = await ctx.db.query("skills").withIndex("by_popularity").order("desc").collect();
    const needle = search?.trim() ?? "";
    const wanted = category?.trim() ?? "";
    const filtered = all.filter(
      (s) => (!wanted || (s.category ?? "") === wanted) && (!needle || matches(s, needle))
    );
    const counts = new Map<string, number>();
    for (const s of all) {
      const c = s.category ?? "";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const categories = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => (a.name === "" ? 1 : b.name === "" ? -1 : a.name.localeCompare(b.name)));
    const holds = await ctx.db.query("agentSkills").collect();
    const agents = await ctx.db.query("agents").collect();
    const name = new Map(agents.map((a) => [a._id, a.name]));
    const cap = Math.min(LIST_MAX, Math.max(1, limit ?? LIST_MAX));
    return {
      total: all.length,
      matched: filtered.length,
      categories,
      skills: filtered.slice(0, cap).map((s) =>
        summary(
          s,
          holds.filter((h) => h.skillId === s._id).map((h) => name.get(h.agentId) ?? "?")
        )
      ),
    };
  },
});

export const get = query({
  args: { skillId: v.id("skills") },
  handler: async (ctx, { skillId }) => {
    const s = await ctx.db.get(skillId);
    if (!s) return null;
    const holds = await ctx.db
      .query("agentSkills")
      .withIndex("by_skill", (q) => q.eq("skillId", skillId))
      .collect();
    const holders: { name: string; level: number; uses: number }[] = [];
    for (const h of holds) {
      const a = await ctx.db.get(h.agentId);
      if (a) holders.push({ name: a.name, level: h.level, uses: h.uses });
    }
    const promptRow = await ctx.db
      .query("skillPrompts")
      .withIndex("by_skill", (q) => q.eq("skillId", skillId))
      .first();
    return {
      ...summary(s, holders.map((h) => h.name)),
      prompt: promptRow?.prompt ?? null,
      holderLevels: holders,
      importedAt: s.importedAt,
    };
  },
});

export const forAgent = query({
  args: { agentName: v.string() },
  handler: async (ctx, { agentName }) => {
    const agent = await findAgentByName(ctx, agentName);
    if (!agent) return [];
    return skillsForAgent(ctx, agent._id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    category: v.optional(v.string()),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Skill name is required.");
    if (!args.description.trim()) throw new Error("Skill description is required.");
    const slug = slugify(name);
    if (!slug) throw new Error("Skill name needs some letters or digits.");
    const clash = await ctx.db
      .query("skills")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (clash) throw new Error(`A skill named "${clash.name}" already exists.`);
    const skillId = await ctx.db.insert("skills", {
      name,
      slug,
      description: args.description.trim(),
      category: args.category?.trim() || undefined,
      source: "custom",
      hasPrompt: !!args.prompt?.trim(),
      verified: false,
      popularity: 0,
      importedAt: Date.now(),
    });
    await setPrompt(ctx, skillId, args.prompt);
    return { skillId, name };
  },
});

export const update = mutation({
  args: {
    skillId: v.id("skills"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) throw new Error("Skill not found.");
    const patch: Partial<Doc<"skills">> = {};
    if (args.name !== undefined) {
      if (!args.name.trim()) throw new Error("Skill name is required.");
      patch.name = args.name.trim();
    }
    if (args.description !== undefined) {
      if (!args.description.trim()) throw new Error("Skill description is required.");
      patch.description = args.description.trim();
    }
    if (args.category !== undefined) patch.category = args.category.trim() || undefined;
    if (args.prompt !== undefined) {
      patch.hasPrompt = !!args.prompt.trim();
      await setPrompt(ctx, skill._id, args.prompt);
    }
    await ctx.db.patch(skill._id, patch);
    return { name: patch.name ?? skill.name };
  },
});

export const remove = mutation({
  args: { skillId: v.id("skills") },
  handler: async (ctx, { skillId }) => {
    const skill = await ctx.db.get(skillId);
    if (!skill) throw new Error("Skill not found.");
    const holds = await ctx.db
      .query("agentSkills")
      .withIndex("by_skill", (q) => q.eq("skillId", skillId))
      .collect();
    if (holds.length > 0) {
      const names: string[] = [];
      for (const h of holds) names.push((await ctx.db.get(h.agentId))?.name ?? "?");
      throw new Error(`${skill.name} is held by ${names.join(", ")}. Remove it from them first.`);
    }
    await setPrompt(ctx, skillId, undefined);
    await ctx.db.delete(skillId);
    return { removed: skill.name };
  },
});

// ---- holding skills ----

export const assign = mutation({
  args: { agentName: v.string(), skillId: v.id("skills"), level: v.optional(v.number()) },
  handler: async (ctx, { agentName, skillId, level }) => {
    const agent = await findAgentByName(ctx, agentName);
    if (!agent) throw new Error(`Nobody named "${agentName}" works here.`);
    const skill = await ctx.db.get(skillId);
    if (!skill) throw new Error("Skill not found.");
    const existing = await ctx.db
      .query("agentSkills")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .filter((q) => q.eq(q.field("skillId"), skillId))
      .first();
    const lvl = clampLevel(level ?? 1);
    if (existing) {
      await ctx.db.patch(existing._id, { level: lvl });
    } else {
      await ctx.db.insert("agentSkills", { agentId: agent._id, skillId, level: lvl, uses: 0 });
    }
    return { agent: agent.name, skill: skill.name, level: lvl };
  },
});

export const unassign = mutation({
  args: { agentName: v.string(), skillId: v.id("skills") },
  handler: async (ctx, { agentName, skillId }) => {
    const agent = await findAgentByName(ctx, agentName);
    if (!agent) throw new Error(`Nobody named "${agentName}" works here.`);
    const existing = await ctx.db
      .query("agentSkills")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .filter((q) => q.eq(q.field("skillId"), skillId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { agent: agent.name };
  },
});

// ---- importing from Smithery ----

// Insert-or-update rows by slug; the one write path for every bulk source.
async function upsertRows(ctx: MutationCtx, rows: SkillRow[]) {
  let created = 0;
  let updated = 0;
  for (const raw of rows) {
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_slug", (q) => q.eq("slug", raw.slug))
      .first();
    const doc = {
      name: raw.name,
      slug: raw.slug,
      description: raw.description,
      category: raw.category ?? undefined,
      source: raw.source,
      namespace: raw.namespace ?? undefined,
      sourceUrl: raw.sourceUrl ?? undefined,
      hasPrompt: !!raw.prompt,
      verified: raw.verified,
      popularity: raw.popularity,
    };
    let skillId: Id<"skills">;
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      skillId = existing._id;
      updated += 1;
    } else {
      skillId = await ctx.db.insert("skills", { ...doc, importedAt: Date.now() });
      created += 1;
    }
    await setPrompt(ctx, skillId, raw.prompt ?? undefined);
  }
  return { created, updated };
}

export const upsertBatch = internalMutation({
  args: { rows: v.array(v.any()) },
  handler: async (ctx, { rows }) => upsertRows(ctx, rows as SkillRow[]),
});

// The office's own catalogue (src/lib/skillSeed.ts): work and life skills
// across every sector — finance, planning, social, emotional, research,
// coding, operations… Idempotent: re-seeding updates text, never duplicates,
// and never touches who holds what.
export const seed = mutation({
  args: {},
  returns: v.object({ created: v.number(), updated: v.number() }),
  handler: async (ctx) => {
    const rows: SkillRow[] = SKILL_SEED.map((s) => ({
      name: s.name,
      slug: slugify(s.name),
      description: s.description,
      category: s.category,
      source: "custom",
      namespace: null,
      sourceUrl: null,
      prompt: s.prompt,
      verified: true,
      popularity: 0,
    }));
    return upsertRows(ctx, rows);
  },
});

const SMITHERY_API = "https://api.smithery.ai/skills";
const PAGE_SIZE = 100;

// Pull a slice of the registry (needs SMITHERY_API_KEY in the Convex env):
// verified skills by default, `pages` pages of 100, most active first as
// the API returns them; optionally a search term.
export const importFromSmithery = action({
  args: {
    query: v.optional(v.string()),
    pages: v.optional(v.number()),
    verifiedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, { query, pages, verifiedOnly }) => {
    const key = process.env.SMITHERY_API_KEY;
    if (!key) throw new Error("SMITHERY_API_KEY is not set: npx convex env set SMITHERY_API_KEY <key>");
    const maxPages = Math.min(10, Math.max(1, pages ?? 3));
    let created = 0;
    let updated = 0;
    let fetched = 0;
    let totalPages = 1;
    for (let page = 1; page <= Math.min(maxPages, totalPages); page++) {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (query?.trim()) params.set("q", query.trim());
      if (verifiedOnly ?? true) params.set("verified", "true");
      const res = await fetch(`${SMITHERY_API}?${params}`, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Smithery ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as {
        skills: SmitherySkill[];
        pagination?: { totalPages?: number; totalCount?: number };
      };
      totalPages = body.pagination?.totalPages ?? 1;
      const rows = body.skills.filter((s) => s.namespace && s.slug).map(mapSmitherySkill);
      fetched += rows.length;
      if (rows.length > 0) {
        const r = await ctx.runMutation(internal.skills.upsertBatch, { rows });
        created += r.created;
        updated += r.updated;
      }
      if (body.skills.length < PAGE_SIZE) break;
    }
    return { fetched, created, updated };
  },
});

export type { Id };

// Reset the catalogue (dev aid; also used before re-importing after a schema
// change). Refuses while anyone holds a skill.
export const wipeCatalogue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const held = await ctx.db.query("agentSkills").first();
    if (held) throw new Error("Someone still holds a skill; unassign first.");
    let removed = 0;
    for (const s of await ctx.db.query("skills").collect()) {
      await ctx.db.delete(s._id);
      removed += 1;
    }
    return { removed };
  },
});
