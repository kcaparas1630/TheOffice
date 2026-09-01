// Shared run-state helpers — plain helpers, not Convex functions.
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// An agent goes idle only when NONE of their runs are still going — with
// parallel runs, the first one to finish must not flip the agent to idle.
export async function settleAgentStatus(ctx: MutationCtx, agentId: Id<"agents">): Promise<void> {
  const running = await ctx.db
    .query("runs")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .filter((q) => q.eq(q.field("status"), "running"))
    .first();
  if (!running) await ctx.db.patch(agentId, { status: "idle" });
}
