// The sprite catalogue: which character sets exist and which views each one
// has. Pure data, shared by the hire form, the Convex validator, and the
// canvas loader. Files live in `public/office/sprites/<id>_<view>.png`.

export type SpriteView = "front" | "back" | "right";

export interface SpriteOption {
  id: string;
  label: string;
  views: SpriteView[];
  // Which way the "right" file actually faces; some sets were drawn facing
  // left. The renderer mirrors to produce the other direction.
  sideFaces?: "left" | "right";
}

export const SPRITE_CATALOG: SpriteOption[] = [
  { id: "c01", label: "Navy suit", views: ["front", "back", "right"] },
  { id: "c03", label: "Mustard sweater", views: ["front", "back", "right"] },
  { id: "c04", label: "Blue blazer", views: ["front", "back", "right"] },
  { id: "c05", label: "Light-blue shirt", views: ["front", "back"] },
  { id: "c06", label: "Cream shirt", views: ["front", "back", "right"] },
  { id: "c07", label: "Green shirt", views: ["front", "back", "right"], sideFaces: "left" },
  { id: "c08", label: "Rust shirt", views: ["front", "back", "right"], sideFaces: "left" },
  { id: "c09", label: "Burgundy blazer", views: ["front", "back", "right"] },
  { id: "c10", label: "Dark navy suit", views: ["front", "back", "right"] },
  { id: "c11", label: "Cream sweater", views: ["front", "back", "right"] },
  { id: "c12", label: "Teal shirt", views: ["front", "back", "right"], sideFaces: "left" },
];

export const SPRITE_IDS = SPRITE_CATALOG.map((s) => s.id);

export function isSpriteId(id: string): boolean {
  return SPRITE_IDS.includes(id);
}

export function spriteUrl(id: string, view: SpriteView): string {
  return `/office/sprites/${id}_${view}.png`;
}

// Fallback when an agent was hired without choosing a look (e.g. from the
// terminal): a stable pick by name. Nothing about a role or a name implies
// a look — pick one at hire time (or /look) to be sure.
export function defaultSpriteFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SPRITE_IDS[h % SPRITE_IDS.length];
}
