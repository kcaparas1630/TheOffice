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
