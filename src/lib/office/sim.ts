// Pure office simulation: who sits where, what each person is doing (derived
// only from run records, never guessed), how they walk between spots, and
// the walk-cycle pose. The canvas component just integrates and draws.
import { DESK_SEATS, IDLE_SPOTS, isSeatId, MANAGER_SEAT, RECEPTION_SEAT, type Facing, type Spot } from "./layout";
import { centerOf, gridFromRows, isWalkable, nearestOpenCell, planRoute, type NavGrid } from "./nav";
import { NAV_ROWS } from "./navmask";
import type { Phase } from "../clock";

// Where people go when the clock says lunch or break: never their desk.
const SOCIAL_SPOT_IDS = new Set(["cafe", "break-table", "kitchen", "lounge"]);

export interface SnapAgent {
  _id: string;
  name: string;
  jobTitle?: string;
  supervisorId: string | null;
  hiredAt: number;
}

export interface SnapRun {
  _id: string;
  agentId: string;
  parentRunId: string | null;
  status: "queued" | "running" | "done" | "failed";
  label: string;
  finishedAt: number | null;
}

export type Behavior =
  | { kind: "working"; label: string }
  | { kind: "delegating"; workerId: string; label: string }
  | { kind: "idle" };

export interface Point {
  x: number;
  y: number;
}

// ---------- seating ----------

// Seats follow roles, read off records: the first-hired agent who leads a
// team and reports to nobody takes the private office, whoever's job title
// says reception takes the front desk, everyone else fills desks in hire
// order.
const RECEPTION_TITLE = /recept|front desk/i;

export function assignSeats(agents: SnapAgent[]): Map<string, Spot> {
  const ordered = [...agents].sort((a, b) => a.hiredAt - b.hiredAt);
  const leads = new Set(ordered.map((a) => a.supervisorId).filter(Boolean));
  const seats = new Map<string, Spot>();
  const manager = ordered.find((a) => !a.supervisorId && leads.has(a._id));
  if (manager) seats.set(manager._id, MANAGER_SEAT);
  const receptionist = ordered.find((a) => !seats.has(a._id) && RECEPTION_TITLE.test(a.jobTitle ?? ""));
  if (receptionist) seats.set(receptionist._id, RECEPTION_SEAT);
  let desk = 0;
  for (const agent of ordered) {
    if (seats.has(agent._id)) continue;
    // Past eight desks people double up at the last one; hire fewer people.
    seats.set(agent._id, DESK_SEATS[Math.min(desk, DESK_SEATS.length - 1)]);
    desk += 1;
  }
  return seats;
}

// ---------- behavior from records ----------

export function deriveBehaviors(agents: SnapAgent[], runs: SnapRun[]): Map<string, Behavior> {
  const running = runs.filter((r) => r.status === "running");
  const out = new Map<string, Behavior>();
  for (const agent of agents) {
    const mine = running.filter((r) => r.agentId === agent._id);
    if (mine.length === 0) {
      out.set(agent._id, { kind: "idle" });
      continue;
    }
    // A running child of one of my runs means I am waiting on a report.
    const child = running.find((r) => r.parentRunId && mine.some((m) => m._id === r.parentRunId));
    if (child && child.agentId !== agent._id) {
      out.set(agent._id, { kind: "delegating", workerId: child.agentId, label: child.label });
    } else {
      out.set(agent._id, { kind: "working", label: mine[0].label });
    }
  }
  return out;
}

// Runs that just closed, for a brief done/failed bubble.
export function recentlyFinished(runs: SnapRun[], now: number, windowMs = 7000) {
  const out = new Map<string, "done" | "failed">();
  for (const run of runs) {
    if (run.finishedAt === null || run.finishedAt < now - windowMs) continue;
    if (run.status !== "done" && run.status !== "failed") continue;
    if (!out.has(run.agentId)) out.set(run.agentId, run.status);
  }
  return out;
}

// Where a supervisor stands while a report works: beside the worker's desk,
// on the side away from the desk, facing them.
export function standBeside(worker: Spot): Spot {
  const dx = worker.facing === "right" ? -0.045 : 0.045;
  const facing: Facing = worker.facing === "right" ? "right" : "left";
  return { id: `beside-${worker.id}`, x: worker.x + dx, y: worker.y, facing };
}

export function pickIdleSpot(seat: Spot, current: string | null, random = Math.random, phase: Phase = "work"): Spot {
  if (phase === "lunch" || phase === "break") {
    // Off the clock: the social spots only, and stay put once there.
    if (current && SOCIAL_SPOT_IDS.has(current)) return IDLE_SPOTS.find((s) => s.id === current) ?? seat;
    const social = IDLE_SPOTS.filter((s) => SOCIAL_SPOT_IDS.has(s.id));
    return social[Math.floor(random() * social.length)];
  }
  // Mostly drift back to your own desk; sometimes wander.
  if (current !== seat.id && random() < 0.4) return seat;
  const options = IDLE_SPOTS.filter((s) => s.id !== current);
  return options[Math.floor(random() * options.length)];
}

// ---------- routing ----------

const EPS = 1e-4;

function pushPoint(path: Point[], p: Point) {
  const last = path[path.length - 1];
  if (last && Math.abs(last.x - p.x) < EPS && Math.abs(last.y - p.y) < EPS) return;
  path.push(p);
}

// The office's walkability grid (walls, furniture and the outside are
// blocked). Built once from the generated mask.
export const NAV: NavGrid = gridFromRows(NAV_ROWS);

// Route between two points over open floor: A* on the grid, straightened.
// A seat is reached exactly (the last step may leave the floor, chairs are
// blocked); any other spot snaps to the nearest open cell so nobody ends
// up standing in a plant.
export function routeTo(from: Point, to: Spot, grid: NavGrid = NAV): Point[] {
  let target: Point = { x: to.x, y: to.y };
  if (!isSeatId(to.id) && !isWalkable(grid, target)) {
    const cell = nearestOpenCell(grid, target);
    if (cell) target = centerOf(grid, cell.cx, cell.cy);
  }
  const path = planRoute(grid, { x: from.x, y: from.y }, target);
  const out: Point[] = [];
  for (const p of path) pushPoint(out, p);
  return out;
}

export function facingFor(dx: number, dy: number): Facing {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "front" : "back";
}

// Advance along `path` by `dist` (scene units). Returns the new position, the
// remaining path, and the direction faced while moving.
export function advance(
  pos: Point,
  path: Point[],
  dist: number
): { pos: Point; path: Point[]; facing: Facing | null; moved: number } {
  let remaining = dist;
  let cur = { ...pos };
  let rest = path;
  let facing: Facing | null = null;
  let moved = 0;
  while (rest.length > 0 && remaining > 0) {
    const next = rest[0];
    const dx = next.x - cur.x;
    const dy = next.y - cur.y;
    const len = Math.hypot(dx, dy);
    if (len <= remaining) {
      cur = { ...next };
      rest = rest.slice(1);
      remaining -= len;
      moved += len;
      if (len > EPS) facing = facingFor(dx, dy);
    } else {
      cur = { x: cur.x + (dx / len) * remaining, y: cur.y + (dy / len) * remaining };
      facing = facingFor(dx, dy);
      moved += remaining;
      remaining = 0;
    }
  }
  return { pos: cur, path: rest, facing, moved };
}

// ---------- walk cycle ----------

export interface WalkPose {
  bob: number; // body vertical offset, fraction of sprite height (negative = up)
  legs: [{ lift: number; stride: number }, { lift: number; stride: number }];
}

// Two legs, half a cycle apart. `lift` shortens the leg (foot comes up),
// `stride` slides it forward/back. All fractions of sprite height.
export function walkPose(phase: number): WalkPose {
  const s = Math.sin(phase);
  const lift = 0.07;
  const stride = 0.05;
  return {
    bob: -0.02 * Math.abs(s),
    legs: [
      { lift: lift * Math.max(0, s), stride: stride * s },
      { lift: lift * Math.max(0, -s), stride: -stride * s },
    ],
  };
}
