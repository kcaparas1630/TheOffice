// The sprite catalogue: which character sets exist and which views each one
// has. Pure data, shared by the hire form, the Convex validator, and the
// canvas loader. Files live in `public/office/sprites/<id>_<view>.png`.

export type SpriteView = "front" | "back" | "right";

// Which way a sitting pose was drawn: facing the viewer (a desk you sit
// behind), sideways (an open-plan desk; mirrored for the other side), or away.
export type SitFacing = "front" | "right" | "back";

export interface SpriteOption {
  id: string;
  label: string;
  views: SpriteView[];
  // Which way the "right" file actually faces; some sets were drawn facing
  // left. The renderer mirrors to produce the other direction.
  sideFaces?: "left" | "right";
  // Sitting pose (`poses/<id>_sit.png`), if the set has one.
  sit?: SitFacing;
}

export const SPRITE_CATALOG: SpriteOption[] = [
  { id: "c01", label: "Navy suit", views: ["front", "back", "right"], sit: "front" },
  { id: "c03", label: "Mustard sweater", views: ["front", "back", "right"] },
  { id: "c04", label: "Blue blazer", views: ["front", "back", "right"], sit: "right" },
  { id: "c05", label: "Light-blue shirt", views: ["front", "back"], sit: "right" },
  { id: "c06", label: "Cream shirt", views: ["front", "back", "right"], sit: "right" },
  { id: "c07", label: "Green shirt", views: ["front", "back", "right"], sideFaces: "left", sit: "right" },
  { id: "c08", label: "Rust shirt", views: ["front", "back", "right"], sideFaces: "left", sit: "right" },
  { id: "c09", label: "Burgundy blazer", views: ["front", "back", "right"], sit: "front" },
  { id: "c10", label: "Dark navy suit", views: ["front", "back", "right"], sit: "right" },
  { id: "c11", label: "Cream sweater", views: ["front", "back", "right"], sit: "back" },
  { id: "c12", label: "Teal shirt", views: ["front", "back", "right"], sideFaces: "left", sit: "right" },
];

export type PoseName = "sit" | "coffee" | "copier";

export function poseUrl(id: string, pose: PoseName): string {
  return `/office/sprites/poses/${id}_${pose}.png`;
}

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
