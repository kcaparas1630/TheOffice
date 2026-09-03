import { Agent, listMessages, extractText } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { chatModel } from "../vercel/model";
import { buildSystemPrompt, formatWorkState } from "../vercel/prompts";

// One shared component Agent; the office-agent persona is injected per call
// via `instructions` built from the agent's row + live work state.
const office = new Agent(components.agent, {
  name: "the-office",
  languageModel: chatModel(),
});

export const sendMessage = action({
  args: { agentName: v.string(), message: v.string() },
  handler: async (
    ctx,
    { agentName, message }
  ): Promise<{ agentName: string; reply: string }> => {
    const agent = await ctx.runQuery(internal.agents.getByNameInternal, { name: agentName });
    if (!agent) {
      throw new Error(`Nobody named "${agentName}" works here. Check /roster or /hire them.`);
    }

    let threadId = agent.chatThreadId;
    if (!threadId) {
      const created = await office.createThread(ctx, {
        userId: "kent",
        title: `Chat with ${agent.name}`,
      });
      threadId = created.threadId;
      await ctx.runMutation(internal.agents.saveThreadId, {
        agentId: agent._id,
        threadId,
      });
    }

    const state = await ctx.runQuery(internal.work.stateForAgent, { agentId: agent._id });
    const instructions =
      buildSystemPrompt(agent) + (state ? `\n\n${formatWorkState(state)}` : "");

    const result = await office.generateText(
      ctx,
      { threadId, userId: "kent" },
      { prompt: message, instructions }
    );

    return { agentName: agent.name, reply: result.text };
  },
});

// Office viewer: an agent's conversation, newest page first (reactive).
// One stream for the whole office: the newest messages from every agent's
// thread, merged by time. Threads stay per-agent underneath (the terminal
// and the agents' memory depend on that); this is just how the web reads them.
const TIMELINE_PER_AGENT = 60;
const TIMELINE_MAX = 200;

export const timeline = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    const all: {
      _id: string;
      agentId: string;
      agentName: string;
      role: string;
      text: string;
      status: string;
      createdAt: number;
      order: number;
      stepOrder: number;
    }[] = [];
    for (const agent of agents) {
      if (!agent.chatThreadId) continue;
      const result = await listMessages(ctx, components.agent, {
        threadId: agent.chatThreadId,
        paginationOpts: { numItems: TIMELINE_PER_AGENT, cursor: null },
        excludeToolMessages: true,
        statuses: ["success", "pending"],
      });
      for (const m of result.page) {
        all.push({
          _id: m._id,
          agentId: agent._id,
          agentName: agent.name,
          role: m.message?.role ?? "assistant",
          text: m.text ?? (m.message ? extractText(m.message) : "") ?? "",
          status: m.status,
          createdAt: m._creationTime,
          order: m.order,
          stepOrder: m.stepOrder,
        });
      }
    }
    all.sort((a, b) => a.createdAt - b.createdAt || a.order - b.order || a.stepOrder - b.stepOrder);
    return all.slice(-TIMELINE_MAX);
  },
});

export const messages = query({
  args: { agentName: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { agentName, paginationOpts }) => {
    const agent = await ctx.runQuery(internal.agents.getByNameInternal, { name: agentName });
    if (!agent?.chatThreadId) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const result = await listMessages(ctx, components.agent, {
      threadId: agent.chatThreadId,
      paginationOpts,
      excludeToolMessages: true,
      statuses: ["success", "pending"],
    });
    return {
      ...result,
      page: result.page.map((m) => ({
        _id: m._id,
        role: m.message?.role ?? "assistant",
        text: m.text ?? (m.message ? extractText(m.message) : "") ?? "",
        status: m.status,
        createdAt: m._creationTime,
        order: m.order,
        stepOrder: m.stepOrder,
      })),
    };
  },
});
