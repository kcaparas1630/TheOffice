// Notes between colleagues and reports to Kent. Only the heartbeat writes
// here (an agent decides to say something on its turn); the recipient reads
// it on their next turn; the chat stream shows all of it.
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const send = internalMutation({
  args: {
    fromAgentId: v.id("agents"),
    toAgentId: v.optional(v.id("agents")),
    text: v.string(),
    turnId: v.optional(v.id("turns")),
  },
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if (!text) throw new Error("Empty message.");
    return ctx.db.insert("messages", { ...args, text });
  },
});

export const markRead = internalMutation({
  args: { ids: v.array(v.id("messages")) },
  handler: async (ctx, { ids }) => {
    const now = Date.now();
    for (const id of ids) {
      const m = await ctx.db.get(id);
      if (m && !m.readAt) await ctx.db.patch(id, { readAt: now });
    }
  },
});

// Unread notes addressed to this agent, oldest first.
export const inboxFor = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_to", (q) => q.eq("toAgentId", agentId))
      .filter((q) => q.eq(q.field("readAt"), undefined))
      .collect();
    const out = [];
    for (const m of rows) {
      const from = await ctx.db.get(m.fromAgentId);
      out.push({ _id: m._id, from: from?.name ?? "?", text: m.text, at: m._creationTime });
    }
    return out.sort((a, b) => a.at - b.at);
  },
});
