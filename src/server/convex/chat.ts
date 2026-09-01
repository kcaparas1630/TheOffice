import { Agent } from "@convex-dev/agent";
import { v } from "convex/values";
import { action } from "./_generated/server";
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
