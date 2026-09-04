// The brief pipeline: deterministic feed fetch → one generateObject call →
// artifact + run records. Orchestration lives here as task records, never
// inside an SDK loop. Also home to revisions and the cron entry point.
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { generateObject, generateText } from "ai";
import type { Id } from "./_generated/dataModel";
import { chatModel, extractCostUsd } from "../vercel/model";
import { withSkills } from "./model/skills";
import { parseHnHits, parseFeedXml, selectCandidates, type CandidateItem } from "../vercel/feeds";
import {
  briefSchema,
  buildBriefPrompt,
  buildRevisionPrompt,
  briefToMarkdown,
  LESSON_PROMPT,
} from "../vercel/brief";
import { findAgentByName, requireAgentByName } from "./model/agents";
import { DEFAULT_FEEDS, type FeedSource } from "../../lib/feeds";

const HN_MIN_POINTS = 30;
const WINDOW_HOURS = 24;
const FALLBACK_WINDOW_HOURS = 48;
const MAX_CANDIDATES = 40;

// One slow source must not stall the whole brief (or push the action into
// its time limit, which leaves the run stranded).
const FETCH_TIMEOUT_MS = 20_000;
const fetchWithTimeout = (url: string) => fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

async function fetchCandidates(now: number, feeds: FeedSource[]): Promise<CandidateItem[]> {
  const sinceSec = Math.floor((now - FALLBACK_WINDOW_HOURS * 3_600_000) / 1000);
  const hnParams = new URLSearchParams({
    tags: "story",
    hitsPerPage: "50",
    numericFilters: `points>${HN_MIN_POINTS},created_at_i>${sinceSec}`,
  });
  const sources: Promise<CandidateItem[]>[] = [
    fetchWithTimeout(`https://hn.algolia.com/api/v1/search_by_date?${hnParams}`)
      .then((r) => r.json())
      .then((json) => parseHnHits(json)),
    ...feeds.map((feed) =>
      fetchWithTimeout(feed.url)
        .then((r) => r.text())
        .then((xml) => parseFeedXml(xml, feed.name))
    ),
  ];
  const results = await Promise.allSettled(sources);
  const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const fresh = selectCandidates(items, { now, windowHours: WINDOW_HOURS, max: MAX_CANDIDATES });
  if (fresh.length >= 5) return fresh;
  // Slow news window — widen to 48h rather than starve the brief.
  return selectCandidates(items, { now, windowHours: FALLBACK_WINDOW_HOURS, max: MAX_CANDIDATES });
}

// ---------- lookups (internal) ----------

export const getJobWithAgent = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    const agent = await ctx.db.get(job.agentId);
    if (!agent) return null;
    return { job, agent: await withSkills(ctx, agent) };
  },
});

export const jobsForAgent = internalQuery({
  args: { agentId: v.id("agents"), title: v.optional(v.string()) },
  handler: async (ctx, { agentId, title }) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();
    return jobs
      .filter((j) => j.active && (!title || j.title.toLowerCase() === title.toLowerCase()))
      .map((j) => j._id);
  },
});

export const latestArtifactContext = internalQuery({
  args: { agentName: v.string() },
  handler: async (ctx, { agentName }) => {
    const agent = await findAgentByName(ctx, agentName);
    if (!agent) return null;
    const artifact = await ctx.db
      .query("artifacts")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .order("desc")
      .first();
    if (!artifact) return { agent, artifact: null, job: null };
    const originalRun = await ctx.db.get(artifact.runId);
    const job = originalRun?.jobId ? await ctx.db.get(originalRun.jobId) : null;
    return { agent, artifact, job };
  },
});

// ---------- execution ----------

export const executeJob = internalAction({
  args: {
    jobId: v.id("jobs"),
    trigger: v.union(v.literal("schedule"), v.literal("chat")),
  },
  handler: async (
    ctx,
    { jobId, trigger }
  ): Promise<{ title: string; items: number; slowDay: boolean }> => {
    const loaded = await ctx.runQuery(internal.briefs.getJobWithAgent, { jobId });
    if (!loaded) throw new Error("Job not found.");
    const { job, agent } = loaded;

    const runId: Id<"runs"> = await ctx.runMutation(internal.runs.startRun, {
      agentId: agent._id,
      jobId,
      trigger,
    });

    try {
      const now = Date.now();
      const candidates = await fetchCandidates(now, job.feeds ?? DEFAULT_FEEDS);
      const dateIso = new Date(now).toISOString().slice(0, 10);
      const title = `${job.title} — ${dateIso}`;

      let brief;
      let costUsd: number | undefined;
      let sources: { title: string; url: string }[] = [];

      if (candidates.length === 0) {
        brief = { slowDay: true, items: [] };
      } else {
        const { system, prompt } = buildBriefPrompt({
          jobTitle: job.title,
          spec: job.spec,
          lessons: job.lessons,
          candidates,
        });
        const result = await generateObject({
          model: chatModel(),
          schema: briefSchema,
          system,
          prompt,
          providerOptions: { openrouter: { usage: { include: true } } },
        });
        brief = result.object;
        costUsd = extractCostUsd(result.providerMetadata);
        const byUrl = new Map(candidates.map((c) => [c.url, c]));
        sources = brief.items.map((i) => ({
          title: byUrl.get(i.url)?.title ?? i.headline,
          url: i.url,
        }));
      }

      const contentMd = briefToMarkdown(brief, { title, dateIso });
      const artifactId: Id<"artifacts"> = await ctx.runMutation(internal.runs.saveArtifact, {
        agentId: agent._id,
        runId,
        kind: "brief",
        title,
        contentMd,
        version: 1,
        sources,
      });
      await ctx.runMutation(internal.runs.finishRun, { runId, artifactId, costUsd });
      if (trigger === "schedule") {
        // Cron runs happen while nobody's at the terminal — deliver by email.
        // Best-effort: a mail failure never fails the run.
        await ctx.scheduler.runAfter(0, internal.email.sendArtifact, { artifactId });
      }
      return { title, items: brief.items.length, slowDay: brief.slowDay };
    } catch (error) {
      await ctx.runMutation(internal.runs.failRun, {
        runId,
        error: error instanceof Error ? error.message.slice(0, 500) : String(error),
      });
      throw error;
    }
  },
});

// CLI manual trigger: run an agent's job right now, blocking until done.
export const runJobNow = action({
  args: { agentName: v.string(), jobTitle: v.optional(v.string()) },
  handler: async (
    ctx,
    { agentName, jobTitle }
  ): Promise<{ title: string; items: number; slowDay: boolean }> => {
    const agent = await ctx.runQuery(internal.agents.getByNameInternal, { name: agentName });
    if (!agent) throw new Error(`Nobody named "${agentName}" works here.`);
    const jobIds = await ctx.runQuery(internal.briefs.jobsForAgent, {
      agentId: agent._id,
      title: jobTitle,
    });
    if (jobIds.length === 0) {
      throw new Error(`${agent.name} has no ${jobTitle ? `job titled "${jobTitle}"` : "active job"}. Use /assign.`);
    }
    return await ctx.runAction(internal.briefs.executeJob, { jobId: jobIds[0], trigger: "chat" });
  },
});

// CLI `/run <name> &` — kick the job off in the background and return
// immediately; progress is visible via /roster and /status.
export const dispatchJobNow = mutation({
  args: { agentName: v.string(), jobTitle: v.optional(v.string()) },
  handler: async (ctx, { agentName, jobTitle }) => {
    const agent = await requireAgentByName(ctx, agentName);
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const job = jobs.find(
      (j) => j.active && (!jobTitle || j.title.toLowerCase() === jobTitle.toLowerCase())
    );
    if (!job) {
      throw new Error(
        `${agent.name} has no ${jobTitle ? `job titled "${jobTitle}"` : "active job"}. Use /assign.`
      );
    }
    await ctx.scheduler.runAfter(0, internal.briefs.executeJob, {
      jobId: job._id,
      trigger: "chat",
    });
    return { agent: agent.name, title: job.title };
  },
});

// Cron entry: schedule every active job for immediate execution.
export const runScheduledJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    for (const job of jobs) {
      if (!job.active) continue;
      await ctx.scheduler.runAfter(0, internal.briefs.executeJob, {
        jobId: job._id,
        trigger: "schedule",
      });
    }
  },
});

// ---------- revision ("this sucks, redo it because X") ----------

export const revise = action({
  args: { agentName: v.string(), critique: v.string() },
  handler: async (
    ctx,
    { agentName, critique }
  ): Promise<{ title: string; version: number }> => {
    if (!critique.trim()) throw new Error("Tell them what was wrong — the critique is the input.");
    const context = await ctx.runQuery(internal.briefs.latestArtifactContext, { agentName });
    if (!context) throw new Error(`Nobody named "${agentName}" works here.`);
    const { agent, artifact, job } = context;
    if (!artifact) throw new Error(`${agent.name} has no documents to revise yet. Try /run first.`);

    const runId: Id<"runs"> = await ctx.runMutation(internal.runs.startRun, {
      agentId: agent._id,
      jobId: job?._id,
      trigger: "chat",
    });

    try {
      const { system, prompt } = buildRevisionPrompt({
        jobTitle: job?.title ?? artifact.title,
        spec: job?.spec ?? agent.jobDescription,
        lessons: job?.lessons ?? [],
        originalMd: artifact.contentMd,
        critique,
      });
      const result = await generateObject({
        model: chatModel(),
        schema: briefSchema,
        system,
        prompt,
        providerOptions: { openrouter: { usage: { include: true } } },
      });

      const version = artifact.version + 1;
      const title = artifact.title.replace(/ \(v\d+\)$/, "") + ` (v${version})`;
      const contentMd = briefToMarkdown(result.object, {
        title,
        dateIso: new Date().toISOString().slice(0, 10),
      });
      const keptUrls = new Set(result.object.items.map((i) => i.url));
      const artifactId: Id<"artifacts"> = await ctx.runMutation(internal.runs.saveArtifact, {
        agentId: agent._id,
        runId,
        kind: artifact.kind,
        title,
        contentMd,
        version,
        parentId: artifact._id,
        sources: artifact.sources.filter((s) => keptUrls.has(s.url)),
      });
      await ctx.runMutation(internal.runs.finishRun, {
        runId,
        artifactId,
        costUsd: extractCostUsd(result.providerMetadata),
      });

      // Lessons accretion: distill the critique into a durable one-line rule.
      if (job) {
        try {
          const lesson = await generateText({
            model: chatModel(),
            prompt: LESSON_PROMPT + critique,
          });
          await ctx.runMutation(internal.jobs.appendLesson, {
            jobId: job._id,
            lesson: lesson.text.split("\n")[0],
          });
        } catch {
          // Lesson distillation is best-effort; the revision itself already landed.
        }
      }

      return { title, version };
    } catch (error) {
      await ctx.runMutation(internal.runs.failRun, {
        runId,
        error: error instanceof Error ? error.message.slice(0, 500) : String(error),
      });
      throw error;
    }
  },
});
