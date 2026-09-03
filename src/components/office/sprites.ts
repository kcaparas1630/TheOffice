// Sprite sheets and the leg-animated draw routine. The art is one static
// frame per view (front/back/right); walking is faked by drawing the legs as
// two halves that alternately shorten (foot lifts) and slide (stride), with
// a body bob on top. Left views mirror the right view.
import type { Facing } from "@/lib/office/layout";
import { walkPose } from "@/lib/office/sim";
import { SPRITE_CATALOG, spriteUrl, type SpriteView } from "@/lib/office/sprites";

export interface SpriteSet {
  images: Partial<Record<SpriteView, HTMLImageElement>>;
  sideFaces: "left" | "right"; // direction the side image was drawn facing
}
export type SpriteLibrary = Record<string, SpriteSet>;

// Fraction of the sprite's height where the legs begin, and how much of the
// body shows when seated behind a desk.
const LEG_TOP = 0.66;
const SEATED_CROP = 0.72;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export async function loadSprites(): Promise<SpriteLibrary> {
  const out: SpriteLibrary = {};
  await Promise.all(
    SPRITE_CATALOG.flatMap((set) => {
      out[set.id] = { images: {}, sideFaces: set.sideFaces ?? "right" };
      return set.views.map(async (view) => {
        out[set.id].images[view] = await loadImage(spriteUrl(set.id, view));
      });
    })
  );
  return out;
}

export const loadScene = () => loadImage("/office/office_empty.png");

export interface DrawOpts {
  x: number; // feet, canvas px
  y: number;
  height: number; // canvas px
  facing: Facing;
  phase: number; // walk-cycle phase (radians)
  moving: boolean;
  seated: boolean;
}

export function spriteWidth(set: SpriteSet, height: number): number {
  const img = set.images.front ?? set.images.back;
  return img ? height * (img.naturalWidth / img.naturalHeight) : height / 2;
}

export function drawSprite(ctx: CanvasRenderingContext2D, set: SpriteSet, o: DrawOpts) {
  const side = o.facing === "left" || o.facing === "right";
  const view: SpriteView = side ? "right" : (o.facing as SpriteView);
  const img = set.images[view] ?? set.images.front;
  if (!img) return;
  // Mirror the side image when walking the other way from how it was drawn.
  const mirror = side && !!set.images.right && o.facing !== set.sideFaces;

  const H = o.height;
  const W = H * (img.naturalWidth / img.naturalHeight);
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const left = o.x - W / 2;

  ctx.save();
  if (mirror) {
    ctx.translate(o.x * 2, 0);
    ctx.scale(-1, 1);
  }

  if (o.seated) {
    const h = H * SEATED_CROP;
    ctx.drawImage(img, 0, 0, sw, sh * SEATED_CROP, left, o.y - h, W, h);
  } else if (!o.moving) {
    ctx.drawImage(img, left, o.y - H, W, H);
  } else {
    const pose = walkPose(o.phase);
    const top = o.y - H + pose.bob * H;
    ctx.drawImage(img, 0, 0, sw, sh * LEG_TOP, left, top, W, H * LEG_TOP);
    const legTop = top + H * LEG_TOP;
    const legH = H * (1 - LEG_TOP);
    // Side views get a real stride; front/back only lift (a sideways slide
    // would look like a shuffle).
    const strideScale = side ? 1 : 0.25;
    for (let i = 0; i < 2; i++) {
      const leg = pose.legs[i];
      ctx.drawImage(
        img,
        (i * sw) / 2,
        sh * LEG_TOP,
        sw / 2,
        sh * (1 - LEG_TOP),
        left + (i * W) / 2 + leg.stride * H * strideScale,
        legTop,
        W / 2,
        legH - leg.lift * H
      );
    }
  }
  ctx.restore();
}
