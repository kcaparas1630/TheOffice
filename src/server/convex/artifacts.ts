// Reading the office's documents: the CLI's /docs and /read, plus the
// internal lookups the email layer uses.
import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { findAgentByName, requireAgentByName } from "./model/agents";

// CLI /docs — list an agent's documents, newest first.
export const docsForAgent = query({
  args: { agentName: v.string() },
  handler: async (ctx, { agentName }) => {
    const agent = await findAgentByName(ctx, agentName);
    if (!agent) return null;
    const artifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .order("desc")
      .take(20);
    return artifacts.map((a) => ({
      title: a.title,
      kind: a.kind,
      version: a.version,
      createdAt: a._creationTime,
      sourceCount: a.sources.length,
    }));
  },
});

// CLI /read — full content of the newest document (or newest matching a title fragment).
export const readDoc = query({
  args: { agentName: v.string(), titleFragment: v.optional(v.string()) },
  handler: async (ctx, { agentName, titleFragment }) => {
    const agent = await findAgentByName(ctx, agentName);
    if (!agent) return null;
    const artifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .order("desc")
      .take(50);
    const match = titleFragment
      ? artifacts.find((a) => a.title.toLowerCase().includes(titleFragment.toLowerCase()))
      : artifacts[0];
    if (!match) return { agentName: agent.name, doc: null };
    return {
      agentName: agent.name,
      doc: {
        title: match.title,
        kind: match.kind,
        version: match.version,
        contentMd: match.contentMd,
        sources: match.sources,
      },
    };
  },
});

// Email layer: everything needed to render an artifact into a message.
export const artifactForEmail = internalQuery({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx, { artifactId }) => {
    const artifact = await ctx.db.get(artifactId);
    if (!artifact) return null;
    const agent = await ctx.db.get(artifact.agentId);
    if (!agent) return null;
    return {
      agentName: agent.name,
      artifactTitle: artifact.title,
      contentMd: artifact.contentMd,
      sources: artifact.sources,
    };
  },
});

export const latestArtifactId = internalQuery({
  args: { agentName: v.string() },
  handler: async (ctx, { agentName }) => {
    const agent = await requireAgentByName(ctx, agentName);
    const artifact = await ctx.db
      .query("artifacts")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .order("desc")
      .first();
    return artifact?._id ?? null;
  },
});
