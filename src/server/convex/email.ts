// Send-only email (spec §10: outbound notifications are fine, inbound never).
// Provider: Resend HTTP API — no SMTP, works in the default Convex runtime.
//
// Required deployment env (npx convex env set ...):
//   RESEND_API_KEY    — from resend.com (free tier)
//   OFFICE_CEO_EMAIL  — where briefs get delivered
// Optional:
//   OFFICE_EMAIL_FROM — defaults to Resend's no-domain-setup sender
import { action, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { renderBriefEmail } from "../../lib/email";
import { normalizeAgentName } from "../../lib/agentName";

const DEFAULT_FROM = "The Office <onboarding@resend.dev>";

type SendResult =
  | { sent: true; to: string; subject: string }
  | { sent: false; reason: string };

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
    const agents = await ctx.db.query("agents").collect();
    const agent = agents.find((a) => normalizeAgentName(a.name) === normalizeAgentName(agentName));
    if (!agent) throw new Error(`Nobody named "${agentName}" works here.`);
    const artifact = await ctx.db
      .query("artifacts")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .order("desc")
      .first();
    return artifact?._id ?? null;
  },
});

async function deliver(input: {
  agentName: string;
  artifactTitle: string;
  contentMd: string;
  sources: { title: string; url: string }[];
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.OFFICE_CEO_EMAIL;
  if (!apiKey || !to) {
    return {
      sent: false,
      reason:
        "Email not configured. Set RESEND_API_KEY and OFFICE_CEO_EMAIL with `npx convex env set`.",
    };
  }

  const email = renderBriefEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.OFFICE_EMAIL_FROM ?? DEFAULT_FROM,
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    return { sent: false, reason: `Resend ${response.status}: ${detail}` };
  }
  return { sent: true, to, subject: email.subject };
}

// Fired by the pipeline after a scheduled brief lands. Best-effort by design:
// a mail failure must never fail (or retroactively taint) the run itself.
export const sendArtifact = internalAction({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx, { artifactId }): Promise<SendResult> => {
    const input = await ctx.runQuery(internal.email.artifactForEmail, { artifactId });
    if (!input) return { sent: false, reason: "Artifact not found." };
    const result = await deliver(input);
    if (!result.sent) console.error(`Email skipped/failed: ${result.reason}`);
    return result;
  },
});

// CLI /email — send an agent's latest document on demand.
export const emailLatest = action({
  args: { agentName: v.string() },
  handler: async (ctx, { agentName }): Promise<SendResult> => {
    const artifactId = await ctx.runQuery(internal.email.latestArtifactId, { agentName });
    if (!artifactId) return { sent: false, reason: `${agentName} has no documents to send yet.` };
    const input = await ctx.runQuery(internal.email.artifactForEmail, { artifactId });
    if (!input) return { sent: false, reason: "Artifact not found." };
    return deliver(input);
  },
});
