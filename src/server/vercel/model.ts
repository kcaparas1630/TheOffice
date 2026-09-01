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
