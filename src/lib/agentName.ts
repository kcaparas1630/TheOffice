// Agent names are @-mentionable handles: one word, letters/digits/hyphens.
// Shared between the CLI wizard (early feedback) and Convex mutations (enforcement).

export const AGENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9-]{1,23}$/;

export function validateAgentName(name: string): string | null {
  if (!name.trim()) return "Name is required.";
  if (/\s/.test(name)) return "Name must be a single word (it becomes the @mention handle).";
  if (!AGENT_NAME_PATTERN.test(name)) {
    return "Name must start with a letter and use only letters, digits, or hyphens (2-24 chars).";
  }
  return null;
}

export function normalizeAgentName(name: string): string {
  return name.trim().toLowerCase();
}
