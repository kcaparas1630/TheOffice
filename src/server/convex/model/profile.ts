// The full profile prompt builders read: the agent row, their skills, and
// their role's duties and metrics. Duties and metrics are read from the role
// at prompt time (never copied onto the agent), so editing a role changes
// everyone holding it at once.
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { withSkills } from "./skills";
import type { RoleMetric } from "../../../lib/metrics";

export async function withProfile<T extends Doc<"agents">>(ctx: QueryCtx, agent: T) {
  const base = await withSkills(ctx, agent);
  const role = agent.roleId ? await ctx.db.get(agent.roleId) : null;
  return {
    ...base,
    duties: role?.duties ?? [],
    metrics: (role?.metrics ?? []) as RoleMetric[],
  };
}
