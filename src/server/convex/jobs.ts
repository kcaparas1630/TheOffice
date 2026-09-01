import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { findAgentByName, requireAgentByName } from "./model/agents";
import { validateFeeds } from "../../lib/feeds";

const MAX_LESSONS = 20;

const feedsValidator = v.array(v.object({ name: v.string(), url: v.string() }));

export const assign = mutation({
  args: {
    agentName: v.string(),
    title: v.string(),
    spec: v.string(),
    schedule: v.optional(v.string()), // informational in v1; the cron runs daily 15:00 UTC
    feeds: v.optional(feedsValidator), // per-job sources; omit for office defaults
  },
  handler: async (ctx, args) => {
    const agent = await requireAgentByName(ctx, args.agentName);
    if (!args.title.trim()) throw new Error("Job title is required.");
    if (!args.spec.trim()) throw new Error("A spec (what 'good' means) is required.");
    if (args.feeds) {
      const feedError = validateFeeds(args.feeds);
      if (feedError) throw new Error(feedError);
    }

    const existing = await ctx.db
      .query("jobs")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    if (existing.some((j) => j.title.toLowerCase() === args.title.trim().toLowerCase())) {
      throw new Error(`${agent.name} already has a job titled "${args.title.trim()}".`);
    }

    const jobId = await ctx.db.insert("jobs", {
      agentId: agent._id,
      title: args.title.trim(),
      spec: args.spec.trim(),
      schedule: args.schedule?.trim() || "0 15 * * *",
      lessons: [],
      feeds: args.feeds,
      active: true,
    });
    return { jobId, agent: agent.name, title: args.title.trim() };
  },
});

export const listForAgent = query({
  args: { agentName: v.string() },
  handler: async (ctx, { agentName }) => {
    const agent = await findAgentByName(ctx, agentName);
    if (!agent) return null;
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    return jobs.map((j) => ({
      _id: j._id,
      title: j.title,
      schedule: j.schedule,
      spec: j.spec,
      lessons: j.lessons,
      feeds: j.feeds ?? null, // null = office defaults
      active: j.active,
    }));
  },
});

// Replace a job's feed list; omit `feeds` to reset to the office defaults.
export const setFeeds = mutation({
  args: { jobId: v.id("jobs"), feeds: v.optional(feedsValidator) },
  handler: async (ctx, { jobId, feeds }) => {
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Job not found.");
    if (feeds) {
      const feedError = validateFeeds(feeds);
      if (feedError) throw new Error(feedError);
    }
    await ctx.db.patch(jobId, { feeds });
    return { title: job.title, feedCount: feeds?.length ?? null };
  },
});

export const setActive = mutation({
  args: { jobId: v.id("jobs"), active: v.boolean() },
  handler: async (ctx, { jobId, active }) => {
    await ctx.db.patch(jobId, { active });
  },
});

export const appendLesson = internalMutation({
  args: { jobId: v.id("jobs"), lesson: v.string() },
  handler: async (ctx, { jobId, lesson }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    const cleaned = lesson.trim().replace(/^["'\s-]+|["'\s]+$/g, "");
    if (!cleaned) return;
    // Critiques compound instead of evaporating — but keep the list bounded.
    const lessons = [...job.lessons, cleaned].slice(-MAX_LESSONS);
    await ctx.db.patch(jobId, { lessons });
  },
});
