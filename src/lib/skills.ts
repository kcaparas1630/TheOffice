// Skills: pure rules shared by the web, the CLI and Convex. A skill is a
// catalogue entry (from Smithery or hand-made); an agent holds it at a level
// from 1 to 5. Levels rise with counted uses (completed runs whose tools
// belonged to the skill) and never fall on their own.

export const LEVEL_LABELS = ["", "learning", "working", "solid", "strong", "expert"] as const;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

// Cumulative uses needed to *reach* each level: 50 for 2, then +100, +300,
// +500 (Kent's ladder). Index = level.
export const LEVEL_THRESHOLDS = [0, 0, 50, 150, 450, 950] as const;

export function levelLabel(level: number): string {
  return LEVEL_LABELS[clampLevel(level)];
}

export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
}

// The level a use count has earned on its own.
export function levelFor(uses: number): number {
  let level = MIN_LEVEL;
  for (let l = MIN_LEVEL; l <= MAX_LEVEL; l++) if (uses >= LEVEL_THRESHOLDS[l]) level = l;
  return level;
}

// Uses still needed for the next level, or null at the top.
export function usesToNext(uses: number, level: number): number | null {
  const next = clampLevel(level) + 1;
  if (next > MAX_LEVEL) return null;
  return Math.max(0, LEVEL_THRESHOLDS[next] - uses);
}

// After `added` more uses: the new count and level (manual levels are a
// floor — the counter only ever promotes).
export function applyUses(current: { uses: number; level: number }, added: number) {
  const uses = current.uses + Math.max(0, added);
  const level = Math.max(clampLevel(current.level), levelFor(uses));
  return { uses, level, promoted: level > clampLevel(current.level) };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

// What we keep of a Smithery registry record (GET https://api.smithery.ai/skills).
export interface SmitherySkill {
  id?: string;
  namespace: string;
  slug: string;
  displayName?: string | null;
  description?: string | null;
  prompt?: string | null;
  categories?: string[] | null;
  gitUrl?: string | null;
  verified?: boolean;
  totalActivations?: number | null;
  qualityScore?: number | null;
}

export interface SkillRow {
  name: string;
  slug: string; // "namespace/slug" for Smithery, plain slug for custom
  description: string;
  category: string | null;
  source: "smithery" | "custom";
  namespace: string | null;
  sourceUrl: string | null;
  prompt: string | null;
  verified: boolean;
  popularity: number;
}

const MAX_PROMPT_CHARS = 20_000;

export function mapSmitherySkill(s: SmitherySkill): SkillRow {
  const name = (s.displayName ?? "").trim() || s.slug;
  return {
    name,
    slug: `${s.namespace}/${s.slug}`,
    description: (s.description ?? "").trim(),
    category: s.categories?.[0] ?? null,
    source: "smithery",
    namespace: s.namespace,
    sourceUrl: s.gitUrl ?? `https://smithery.ai/skills/${s.namespace}/${s.slug}`,
    prompt: s.prompt ? s.prompt.slice(0, MAX_PROMPT_CHARS) : null,
    verified: !!s.verified,
    popularity: s.totalActivations ?? 0,
  };
}
