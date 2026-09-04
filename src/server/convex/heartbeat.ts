// The office heartbeat: one clock gives each idle agent a turn during
// working hours. On a turn the agent reads its records — duties, scorecard,
// inbox, colleagues — and picks ONE action: work, delegate, message, report,
// or rest. Every choice is a `turns` row; work becomes runs and artifacts,
// notes become `messages`. Nothing here is scheduled by Kent; the cron is
// plumbing, the agents decide.
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { generateObject } from "ai";
import { chatModel } from "../vercel/model";
import { withProfile } from "./model/profile";
import { requireAgentByName } from "./model/agents";
import { collectState } from "./work";
import { officeSettings } from "./settings";
import { performTask } from "./delegation";
import { phaseAt, type Phase } from "../../lib/clock";
import {
  buildTurnPrompt,
  resolveTurn,
  turnDecisionSchema,
  turnSummary,
  type TurnContext,
} from "../vercel/turns";

// Cost guard: at most this many agents start a turn per tick.
export const MAX_TURNS_PER_TICK = 2;
const RECENT_TURNS = 6;

// Cron entry (every 10 minutes). `force` ignores the clock and cooldowns —
// used by /turn and tests, never by the cron.
export const tick = internalMutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    const settings = await officeSettings(ctx);
    const now = Date.now();
    if (!force && !settings.heartbeat) return { phase: "paused" as const, turns: [] as string[] };
    const phase = phaseAt(now, settings.timeZone);
    if (!force && phase !== "work") return { phase, turns: [] as string[] };

    const cooldown = settings.turnEveryMinutes * 60_000;
    const agents = await ctx.db.query("agents").collect();
    const due = agents
      .filter((a) => a.status === "idle" && (force || now - (a.lastTurnAt ?? 0) >= cooldown))
      .sort((a, b) => (a.lastTurnAt ?? 0) - (b.lastTurnAt ?? 0))
      .slice(0, MAX_TURNS_PER_TICK);
    for (const agent of due) {
      await ctx.db.patch(agent._id, { lastTurnAt: now });
      await ctx.scheduler.runAfter(0, internal.heartbeat.takeTurn, { agentId: agent._id });
    }
    return { phase, turns: due.map((a) => a.name) };
  },
});

// `/turn Name`: give one person a turn right now, clock or not.
export const giveTurn = mutation({
  args: { agentName: v.string() },
  handler: async (ctx, { agentName }) => {
    const agent = await requireAgentByName(ctx, agentName);
    if (agent.status === "working") throw new Error(`${agent.name} is in the middle of a run; try again when it ends.`);
    await ctx.db.patch(agent._id, { lastTurnAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.heartbeat.takeTurn, { agentId: agent._id });
    return { agent: agent.name };
  },
});

type AgentProfileDoc = Awaited<ReturnType<typeof withProfile<Doc<"agents">>>>;

interface TurnBundle {
  agent: AgentProfileDoc;
  turn: TurnContext;
  inboxIds: Id<"messages">[];
}

// Everything a turn needs, read in one query so the decision sees one
// consistent snapshot of the records.
export const turnContext = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }): Promise<TurnBundle | null> => {
    const agent = await ctx.db.get(agentId);
    if (!agent) return null;
    const profile = await withProfile(ctx, agent);
    const state = await collectState(ctx, agentId);
    if (!state) return null;
    const settings = await officeSettings(ctx);
    const now = Date.now();
    const everyone = await ctx.db.query("agents").collect();
    const colleagues = everyone
      .filter((o) => o._id !== agentId)
      .map((o) => ({
        name: o.name,
        jobTitle: o.jobTitle,
        relation:
          o.supervisorId === agentId ? ("report" as const) : o._id === agent.supervisorId ? ("supervisor" as const) : ("peer" as const),
        status: o.status,
      }));
    const inbox = await ctx.runQuery(internal.messages.inboxFor, { agentId });
    const turns = await ctx.db
      .query("turns")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .order("desc")
      .take(RECENT_TURNS);
    return {
      agent: profile,
      inboxIds: inbox.map((m) => m._id),
      turn: {
        profile,
        state,
        phase: phaseAt(now, settings.timeZone),
        colleagues,
        inbox: inbox.map((m) => ({ from: m.from, text: m.text, at: m.at })),
        recentTurns: turns.map((t) => ({ at: t.at, action: t.action, summary: t.summary })),
        now,
      },
    };
  },
});

export const recordTurn = internalMutation({
  args: {
    agentId: v.id("agents"),
    phase: v.string(),
    action: v.string(),
    reason: v.string(),
    summary: v.string(),
    runId: v.optional(v.id("runs")),
    messageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => ctx.db.insert("turns", { ...args, at: Date.now() }),
});

// One turn: decide, act, record. Failures are turns too ("failed"), so a
// broken model call shows in the log instead of vanishing.
export const takeTurn = internalAction({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }): Promise<void> => {
    const bundle: TurnBundle | null = await ctx.runQuery(internal.heartbeat.turnContext, { agentId });
    if (!bundle) return;
    const { agent, turn, inboxIds } = bundle;
    const phase: Phase = turn.phase;
    try {
      const { system, prompt } = buildTurnPrompt(turn);
      const decision = await generateObject({ model: chatModel(), schema: turnDecisionSchema, system, prompt });
      const chosen = resolveTurn(decision.object, turn);
      const summary = turnSummary(chosen);
      let runId: Id<"runs"> | undefined;
      let messageId: Id<"messages"> | undefined;

      switch (chosen.action) {
        case "work": {
          const r = await performTask(ctx, { agent, task: chosen.task, assignedBy: { role: "self" }, trigger: "heartbeat" });
          runId = r.runId;
          break;
        }
        case "delegate": {
          const worker = await ctx.runQuery(internal.agents.getByNameInternal, { name: chosen.to });
          if (!worker) throw new Error(`${chosen.to} is not on the roster.`);
          const parentRunId: Id<"runs"> = await ctx.runMutation(internal.runs.startRun, {
            agentId,
            trigger: "heartbeat",
            task: `Delegate to ${worker.name} — ${chosen.reason}: ${chosen.task}`,
          });
          runId = parentRunId;
          try {
            const r = await performTask(ctx, {
              agent: worker,
              task: chosen.task,
              assignedBy: { role: "supervisor", name: agent.name },
              parentRunId,
            });
            await ctx.runMutation(internal.runs.finishRun, { runId: parentRunId, artifactId: r.artifactId });
          } catch (error) {
            await ctx.runMutation(internal.runs.failRun, {
              runId: parentRunId,
              error: `Delegated task failed: ${error instanceof Error ? error.message.slice(0, 400) : String(error)}`,
            });
            throw error;
          }
          break;
        }
        case "message": {
          const to = await ctx.runQuery(internal.agents.getByNameInternal, { name: chosen.to });
          if (!to) throw new Error(`${chosen.to} is not on the roster.`);
          messageId = await ctx.runMutation(internal.messages.send, { fromAgentId: agentId, toAgentId: to._id, text: chosen.text });
          break;
        }
        case "report": {
          messageId = await ctx.runMutation(internal.messages.send, { fromAgentId: agentId, text: chosen.text });
          break;
        }
        case "rest":
          break;
      }

      await ctx.runMutation(internal.heartbeat.recordTurn, {
        agentId,
        phase,
        action: chosen.action,
        reason: chosen.reason,
        summary,
        runId,
        messageId,
      });
      if (inboxIds.length > 0) await ctx.runMutation(internal.messages.markRead, { ids: inboxIds });
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 300) : String(error);
      await ctx.runMutation(internal.heartbeat.recordTurn, {
        agentId,
        phase,
        action: "failed",
        reason,
        summary: `failed: ${reason.slice(0, 80)}`,
      });
    }
  },
});
