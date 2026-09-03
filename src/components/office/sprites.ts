// Sprite sheets and the leg-animated draw routine. The art is one static
// frame per view (front/back/right); walking is faked by drawing the legs as
// two halves that alternately shorten (foot lifts) and slide (stride), with
// a body bob on top. Left views mirror the right view.
import type { Facing } from "@/lib/office/layout";
import { walkPose } from "@/lib/office/sim";
import { poseUrl, SPRITE_CATALOG, spriteUrl, type SitFacing, type SpriteView } from "@/lib/office/sprites";

// A pose image trimmed to its opaque pixels (pose files vary in canvas size).
export interface PoseImage {
  img: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface SpriteSet {
  images: Partial<Record<SpriteView, HTMLImageElement>>;
  sideFaces: "left" | "right"; // direction the side image was drawn facing
  sit?: { image: PoseImage; facing: SitFacing };
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

// Bounding box of the non-transparent pixels, measured on a downscaled copy.
function trimBox(img: HTMLImageElement): PoseImage {
  const scale = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return { img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight };
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight };
  const inv = 1 / scale;
  return {
    img,
    sx: Math.floor(x0 * inv),
    sy: Math.floor(y0 * inv),
    sw: Math.ceil((x1 - x0 + 1) * inv),
    sh: Math.ceil((y1 - y0 + 1) * inv),
  };
}

export async function loadSprites(): Promise<SpriteLibrary> {
  const out: SpriteLibrary = {};
  await Promise.all(
    SPRITE_CATALOG.flatMap((set) => {
      out[set.id] = { images: {}, sideFaces: set.sideFaces ?? "right" };
      const loads = set.views.map(async (view) => {
        out[set.id].images[view] = await loadImage(spriteUrl(set.id, view));
      });
      if (set.sit) {
        const facing = set.sit;
        loads.push(
          loadImage(poseUrl(set.id, "sit")).then((img) => {
            out[set.id].sit = { image: trimBox(img), facing };
          })
        );
      }
      return loads;
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

// A seated figure is shorter than a standing one.
const SEATED_SCALE = 0.8;

export interface SeatedOpts {
  x: number; // feet, canvas px
  y: number;
  height: number; // standing height, canvas px
  facing: Facing;
  cover: number; // fraction hidden behind the desk, from the bottom
}

// Draw the set's sitting pose if it suits the seat (a front pose behind a
// desk you face, a side pose at an open-plan desk, mirrored as needed).
// Returns false when there is no suitable pose so the caller can fall back.
export function drawSeated(ctx: CanvasRenderingContext2D, set: SpriteSet, o: SeatedOpts): boolean {
  const pose = set.sit;
  if (!pose) return false;
  const side = o.facing === "left" || o.facing === "right";
  const suits = side ? pose.facing === "right" : pose.facing === o.facing;
  if (!suits) return false;

  const { img, sx, sy, sw, sh } = pose.image;
  const H = o.height * SEATED_SCALE;
  const W = H * (sw / sh);
  const visible = Math.max(0.2, 1 - o.cover);
  const left = o.x - W / 2;

  ctx.save();
  if (side && o.facing === "left") {
    ctx.translate(o.x * 2, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, sx, sy, sw, sh * visible, left, o.y - H, W, H * visible);
  ctx.restore();
  return true;
}
