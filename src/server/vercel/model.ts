import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Cheap-tier default per spec §8; no :free models (rate limits are the wrong
// failure mode for a cron job). Override with OPENROUTER_MODEL.
export const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";

export function chatModel() {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  return openrouter.chat(process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL);
}

// OpenRouter reports the request's USD cost in provider metadata when usage
// accounting is requested; runs.costUsd verifies "basically free" (spec §8).
export function extractCostUsd(providerMetadata: unknown): number | undefined {
  const cost = (providerMetadata as { openrouter?: { usage?: { cost?: number } } } | undefined)
    ?.openrouter?.usage?.cost;
  return typeof cost === "number" ? cost : undefined;
}
