"use client";

// The pixel office: a read-only viewer that animates directly off the runs
// table. Behaviors come from `deriveBehaviors` (records → intent); this file
// only integrates positions over time and draws.
import { useEffect, useMemo, useRef } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/server/convex/_generated/api";
import { isSeatId, SPRITE_HEIGHT, type Facing, type Spot } from "@/lib/office/layout";
import {
  advance,
  assignSeats,
  deriveBehaviors,
  NAV,
  pickIdleSpot,
  recentlyFinished,
  routeTo,
  standBeside,
  type Behavior,
  type Point,
} from "@/lib/office/sim";
import { defaultSpriteFor, isSpriteId } from "@/lib/office/sprites";
import { isBlockedCell } from "@/lib/office/nav";
import { drawSeated, drawSprite, loadScene, loadSprites, spriteWidth, type SpriteLibrary } from "./sprites";

export type Snapshot = FunctionReturnType<typeof api.office.snapshot>;

interface Person {
  id: string;
  name: string;
  set: string; // sprite catalogue id
  pos: Point;
  path: Point[];
  facing: Facing;
  phase: number;
  target: Spot;
  mode: Behavior["kind"];
  waitUntil: number;
}

interface Derived {
  seats: Map<string, Spot>;
  behaviors: Map<string, Behavior>;
}

const WALK_SPEED = 0.16; // scene units per second
const STEPS_PER_UNIT = 2 * Math.PI * 9; // walk-cycle radians per scene unit

const COLORS = {
  ink: "#1f1d1a",
  muted: "#6f6a62",
  working: "#2f7a3e",
  failed: "#b3261e",
  accent: "#7b2d4a",
  label: "rgba(255,255,255,0.88)",
};

export function OfficeCanvas({
  snapshot,
  selectedId,
  onSelect,
}: {
  snapshot: Snapshot | undefined;
  selectedId: string | null;
  onSelect: (agentId: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const people = useRef(new Map<string, Person>());
  const snapRef = useRef(snapshot);
  const selectedRef = useRef(selectedId);
  const derivedRef = useRef<Derived>({ seats: new Map(), behaviors: new Map() });
  const assets = useRef<{ scene?: HTMLImageElement; sprites?: SpriteLibrary; bg: string }>({
    bg: "#e6e4e1",
  });
  const geometry = useRef({ x: 0, y: 0, size: 1 });

  const derived = useMemo<Derived>(() => {
    if (!snapshot) return { seats: new Map(), behaviors: new Map() };
    return {
      seats: assignSeats(snapshot.agents),
      behaviors: deriveBehaviors(snapshot.agents, snapshot.runs),
    };
  }, [snapshot]);

  // The animation loop reads these through refs so it never restarts.
  useEffect(() => {
    snapRef.current = snapshot;
    selectedRef.current = selectedId;
    derivedRef.current = derived;
  }, [snapshot, selectedId, derived]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadScene(), loadSprites()]).then(([scene, sprites]) => {
      if (cancelled) return;
      assets.current.scene = scene;
      assets.current.sprites = sprites;
      // Match the page to the artwork's outer background so the scene blends.
      const probe = document.createElement("canvas");
      probe.width = probe.height = 1;
      const pctx = probe.getContext("2d");
      if (pctx) {
        pctx.drawImage(scene, 2, 2, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = pctx.getImageData(0, 0, 1, 1).data;
        assets.current.bg = `rgb(${r},${g},${b})`;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fontFamily =
      getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() ||
      "ui-monospace, monospace";

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = wrap.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const size = Math.min(width, height);
      geometry.current = { x: (width - size) / 2, y: (height - size) / 2, size };
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    let last = performance.now();
    let raf = 0;

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      simulate(now, dt);
      draw();
    };

    const simulate = (now: number, dt: number) => {
      const snap = snapRef.current;
      if (!snap) return;
      const { seats, behaviors } = derivedRef.current;
      const alive = new Set<string>();

      for (const agent of snap.agents) {
        alive.add(agent._id);
        const seat = seats.get(agent._id)!;
        const behavior = behaviors.get(agent._id) ?? { kind: "idle" as const };
        let person = people.current.get(agent._id);
        if (!person) {
          person = {
            id: agent._id,
            name: agent.name,
            set:
              agent.sprite && isSpriteId(agent.sprite)
                ? agent.sprite
                : defaultSpriteFor(agent.name),
            pos: { x: seat.x, y: seat.y },
            path: [],
            facing: seat.facing,
            phase: 0,
            target: seat,
            mode: "idle",
            waitUntil: now + 3000 + Math.random() * 5000,
          };
          people.current.set(agent._id, person);
        }

        // Looks can change at any time (/look, hire form); follow the record.
        person.set =
          agent.sprite && isSpriteId(agent.sprite) ? agent.sprite : defaultSpriteFor(agent.name);

        // Decide where this person should be, from records only.
        let desired: Spot | null = null;
        if (behavior.kind === "working") {
          desired = seat;
        } else if (behavior.kind === "delegating") {
          desired = standBeside(seats.get(behavior.workerId) ?? seat);
        } else if (person.mode !== "idle") {
          // Just finished: head back to the desk before drifting anywhere.
          desired = seat;
          person.waitUntil = now + 6000 + Math.random() * 6000;
        } else if (person.path.length === 0 && now >= person.waitUntil) {
          desired = pickIdleSpot(seat, person.target.id);
          person.waitUntil = Number.POSITIVE_INFINITY; // set again on arrival
        }
        person.mode = behavior.kind;

        if (desired && desired.id !== person.target.id) {
          person.target = desired;
          person.path = routeTo(person.pos, desired);
        }

        if (person.path.length > 0) {
          const moved = advance(person.pos, person.path, WALK_SPEED * dt);
          person.pos = moved.pos;
          person.path = moved.path;
          person.phase += moved.moved * STEPS_PER_UNIT;
          if (moved.facing) person.facing = moved.facing;
          if (person.path.length === 0) {
            person.facing = person.target.facing;
            person.phase = 0;
            if (person.mode === "idle") person.waitUntil = now + 4000 + Math.random() * 8000;
          }
        }
      }
      for (const id of people.current.keys()) if (!alive.has(id)) people.current.delete(id);
      if (process.env.NODE_ENV !== "production") {
        // Dev aid: the simulation state, readable from devtools as
        // `document.querySelector("canvas").dataset.sim`.
        canvas.dataset.sim = JSON.stringify(
          [...people.current.values()].map((p) => ({
            name: p.name,
            set: p.set,
            mode: p.mode,
            target: p.target.id,
            facing: p.facing,
            x: +p.pos.x.toFixed(3),
            y: +p.pos.y.toFixed(3),
            walking: p.path.length > 0,
          }))
        );
      }
    };

    const showNav =
      process.env.NODE_ENV !== "production" && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("nav");

    const draw = () => {
      const { scene, sprites, bg } = assets.current;
      const { x: ox, y: oy, size } = geometry.current;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      if (!scene || !sprites) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(scene, ox, oy, size, size);
      if (showNav) drawNavOverlay(ctx, ox, oy, size, [...people.current.values()].map((p) => [p.pos, ...p.path]));

      const snap = snapRef.current;
      if (!snap) return;
      const finished = recentlyFinished(snap.runs, Date.now());
      const { behaviors } = derivedRef.current;
      const H = SPRITE_HEIGHT * size;
      const ordered = [...people.current.values()].sort((a, b) => a.pos.y - b.pos.y);

      for (const person of ordered) {
        const set = sprites[person.set] ?? sprites[Object.keys(sprites)[0]];
        if (!set) continue;
        const px = ox + person.pos.x * size;
        const py = oy + person.pos.y * size;
        const moving = person.path.length > 0;
        const atSeat = !moving && isSeatId(person.target.id);
        const sat =
          atSeat &&
          drawSeated(ctx, set, { x: px, y: py, height: H, facing: person.facing, cover: person.target.cover ?? 0 });
        if (!sat) {
          drawSprite(ctx, set, {
            x: px,
            y: py,
            height: H,
            facing: person.facing,
            phase: person.phase,
            moving,
            seated: atSeat,
          });
        }

        // Name + status, from records.
        const behavior = behaviors.get(person.id);
        const done = finished.get(person.id);
        const lines: { text: string; color: string }[] = [{ text: person.name, color: COLORS.ink }];
        if (done) {
          lines.push({
            text: done === "done" ? "done" : "failed",
            color: done === "done" ? COLORS.working : COLORS.failed,
          });
        } else if (behavior?.kind === "working") {
          lines.push({ text: `working: ${truncate(behavior.label, 26)}`, color: COLORS.working });
        } else if (behavior?.kind === "delegating") {
          const worker = snap.agents.find((a) => a._id === behavior.workerId)?.name ?? "a report";
          lines.push({ text: `waiting on ${worker}`, color: COLORS.accent });
        }
        const topY = py - (atSeat ? H * 0.72 : H) - 6;
        drawLabel(ctx, px, topY, lines, fontFamily, person.id === selectedRef.current);
      }

      if (snap.agents.length === 0) {
        ctx.font = `13px ${fontFamily}`;
        ctx.fillStyle = COLORS.muted;
        ctx.textAlign = "center";
        ctx.fillText("Nobody works here yet. Run `npm run office` and /hire someone.", ox + size / 2, oy + size * 0.95);
      }
    };

    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { x: ox, y: oy, size } = geometry.current;
    const x = (e.clientX - rect.left - ox) / size;
    const y = (e.clientY - rect.top - oy) / size;
    const sprites = assets.current.sprites;
    const hit = [...people.current.values()]
      .sort((a, b) => b.pos.y - a.pos.y)
      .find((p) => {
        const set = sprites?.[p.set];
        const w = set ? spriteWidth(set, SPRITE_HEIGHT * size) / size : SPRITE_HEIGHT / 2;
        return Math.abs(x - p.pos.x) < w / 2 && y < p.pos.y && y > p.pos.y - SPRITE_HEIGHT;
      });
    if (hit) onSelect(hit.id);
  };

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} onClick={handleClick} className="block cursor-pointer" />
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bottom: number,
  lines: { text: string; color: string }[],
  fontFamily: string,
  selected: boolean
) {
  const lineH = 13;
  const pad = 4;
  ctx.font = `11px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const width = Math.max(...lines.map((l) => ctx.measureText(l.text).width)) + pad * 2;
  const height = lines.length * lineH + pad;
  const top = bottom - height;
  ctx.fillStyle = COLORS.label;
  ctx.fillRect(cx - width / 2, top, width, height);
  if (selected) {
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - width / 2 + 0.5, top + 0.5, width - 1, height - 1);
  }
  lines.forEach((line, i) => {
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, cx, top + pad + (i + 1) * lineH - 3);
  });
}

// Dev aid (`?nav` in the URL): tint blocked cells and trace planned paths so
// the walkability mask can be tuned against the artwork.
function drawNavOverlay(ctx: CanvasRenderingContext2D, ox: number, oy: number, size: number, paths: Point[][]) {
  const cw = size / NAV.cols;
  const ch = size / NAV.rows;
  ctx.save();
  ctx.fillStyle = "rgba(179, 38, 30, 0.28)";
  for (let cy = 0; cy < NAV.rows; cy++) {
    for (let cx = 0; cx < NAV.cols; cx++) {
      if (isBlockedCell(NAV, cx, cy)) ctx.fillRect(ox + cx * cw, oy + cy * ch, cw, ch);
    }
  }
  ctx.strokeStyle = "rgba(47, 122, 62, 0.9)";
  ctx.lineWidth = 2;
  for (const path of paths) {
    if (path.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(ox + path[0].x * size, oy + path[0].y * size);
    for (const p of path.slice(1)) ctx.lineTo(ox + p.x * size, oy + p.y * size);
    ctx.stroke();
  }
  ctx.restore();
}
