// Office-wide settings: one row. Defaults apply until the row exists, so a
// fresh office runs its heartbeat during Los Angeles office hours.
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_TIME_ZONE } from "../../lib/clock";

export interface OfficeSettings {
  heartbeat: boolean;
  timeZone: string;
  turnEveryMinutes: number;
}

export const DEFAULT_SETTINGS: OfficeSettings = {
  heartbeat: true,
  timeZone: DEFAULT_TIME_ZONE,
  turnEveryMinutes: 60,
};

export async function officeSettings(ctx: QueryCtx): Promise<OfficeSettings> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "office"))
    .first();
  if (!row) return DEFAULT_SETTINGS;
  return { heartbeat: row.heartbeat, timeZone: row.timeZone, turnEveryMinutes: row.turnEveryMinutes };
}

export const get = query({
  args: {},
  handler: async (ctx) => officeSettings(ctx),
});

export const update = mutation({
  args: {
    heartbeat: v.optional(v.boolean()),
    timeZone: v.optional(v.string()),
    turnEveryMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const current = await officeSettings(ctx);
    const next: OfficeSettings = {
      heartbeat: args.heartbeat ?? current.heartbeat,
      timeZone: args.timeZone?.trim() || current.timeZone,
      turnEveryMinutes: Math.max(5, Math.round(args.turnEveryMinutes ?? current.turnEveryMinutes)),
    };
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "office"))
      .first();
    if (row) await ctx.db.patch(row._id, next);
    else await ctx.db.insert("settings", { key: "office", ...next });
    return next;
  },
});
