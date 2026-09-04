// Shared skill helpers — plain functions, not Convex functions.
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { applyUses } from "../../../lib/skills";

export interface HeldSkill {
  skillId: Id<"skills">;
  name: string;
  slug: string;
  level: number;
  uses: number;
}

// The skills an agent holds, with names resolved (for prompts and the UI).
export async function skillsForAgent(ctx: QueryCtx, agentId: Id<"agents">): Promise<HeldSkill[]> {
  const rows = await ctx.db
    .query("agentSkills")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .collect();
  const out: HeldSkill[] = [];
  for (const row of rows) {
    const skill = await ctx.db.get(row.skillId);
    if (!skill) continue;
    out.push({ skillId: skill._id, name: skill.name, slug: skill.slug, level: row.level, uses: row.uses });
  }
  return out.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
}

// An agent row plus their skills — the shape prompt builders read.
export async function withSkills<T extends Doc<"agents">>(ctx: QueryCtx, agent: T) {
  return { ...agent, skills: await skillsForAgent(ctx, agent._id) };
}

// Count one completed run against each skill it used; promote when a
// threshold is crossed. Returns the promotions so callers can announce them.
export async function bumpSkillUses(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  skillIds: Id<"skills">[]
): Promise<{ skillId: Id<"skills">; level: number }[]> {
  const promoted: { skillId: Id<"skills">; level: number }[] = [];
  for (const skillId of new Set(skillIds)) {
    const row = await ctx.db
      .query("agentSkills")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .filter((q) => q.eq(q.field("skillId"), skillId))
      .first();
    if (!row) continue; // only skills they actually hold earn uses
    const next = applyUses({ uses: row.uses, level: row.level }, 1);
    await ctx.db.patch(row._id, { uses: next.uses, level: next.level });
    if (next.promoted) promoted.push({ skillId, level: next.level });
  }
  return promoted;
}
