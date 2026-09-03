// Pure office simulation: who sits where, what each person is doing (derived
// only from run records, never guessed), how they walk between spots, and
// the walk-cycle pose. The canvas component just integrates and draws.
import {
  AISLE_X,
  DESK_SEATS,
  IDLE_SPOTS,
  LANE_Y,
  MANAGER_SEAT,
  type Facing,
  type LaneId,
  type Spot,
} from "./layout";

export interface SnapAgent {
  _id: string;
  name: string;
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

// The first-hired agent who leads a team and reports to nobody takes the
// private office; everyone else fills desks in hire order.
export function assignSeats(agents: SnapAgent[]): Map<string, Spot> {
  const ordered = [...agents].sort((a, b) => a.hiredAt - b.hiredAt);
  const leads = new Set(ordered.map((a) => a.supervisorId).filter(Boolean));
  const seats = new Map<string, Spot>();
  const manager = ordered.find((a) => !a.supervisorId && leads.has(a._id));
  if (manager) seats.set(manager._id, MANAGER_SEAT);
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
  return { id: `beside-${worker.id}`, x: worker.x + dx, y: worker.y, facing, lane: worker.lane };
}

export function pickIdleSpot(seat: Spot, current: string | null, random = Math.random): Spot {
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

// Manhattan route: up/down to your corridor, along it (via the aisle if the
// destination is on the other corridor), then up/down to the target.
export function routeTo(from: Point, fromLane: LaneId, to: Spot): Point[] {
  const path: Point[] = [{ x: from.x, y: from.y }];
  const y0 = LANE_Y[fromLane];
  const y1 = LANE_Y[to.lane];
  pushPoint(path, { x: from.x, y: y0 });
  if (fromLane !== to.lane) {
    pushPoint(path, { x: AISLE_X, y: y0 });
    pushPoint(path, { x: AISLE_X, y: y1 });
  }
  pushPoint(path, { x: to.x, y: y1 });
  pushPoint(path, { x: to.x, y: to.y });
  return path;
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

// Every spot sits nearer one corridor than the other, so the corridor a
// walker should use is simply the closer one; this also recovers cleanly
// when a walk is interrupted mid-route.
export function nearestLane(y: number): LaneId {
  return Math.abs(y - LANE_Y.H1) <= Math.abs(y - LANE_Y.H2) ? "H1" : "H2";
}
