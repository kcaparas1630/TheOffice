// Shared agent lookups — plain helpers, not Convex functions (nothing in here
// appears in the API). The cast is small; case-insensitive scans are fine.
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { normalizeAgentName } from "../../../lib/agentName";

export async function findAgentByName(ctx: QueryCtx, name: string): Promise<Doc<"agents"> | null> {
  const agents = await ctx.db.query("agents").collect();
  const target = normalizeAgentName(name);
  return agents.find((a) => normalizeAgentName(a.name) === target) ?? null;
}

export async function requireAgentByName(ctx: QueryCtx, name: string): Promise<Doc<"agents">> {
  const agent = await findAgentByName(ctx, name);
  if (!agent) throw new Error(`Nobody named "${name}" works here.`);
  return agent;
}
