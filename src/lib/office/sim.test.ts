import { describe, expect, test } from "vitest";
import {
  advance,
  assignSeats,
  deriveBehaviors,
  recentlyFinished,
  routeTo,
  standBeside,
  walkPose,
  type SnapAgent,
  type SnapRun,
} from "./sim";
import { AISLE_X, DESK_SEATS, LANE_Y, MANAGER_SEAT } from "./layout";

const hazel: SnapAgent = { _id: "hazel", name: "Hazel", supervisorId: null, hiredAt: 1 };
const milton: SnapAgent = { _id: "milton", name: "Milton", supervisorId: "hazel", hiredAt: 2 };
const otto: SnapAgent = { _id: "otto", name: "Otto", supervisorId: null, hiredAt: 3 };

const run = (over: Partial<SnapRun>): SnapRun => ({
  _id: "r",
  agentId: "hazel",
  parentRunId: null,
  status: "running",
  label: "daily tech brief",
  finishedAt: null,
  ...over,
});

describe("assignSeats", () => {
  test("the team lead takes the office; others fill desks in hire order", () => {
    const seats = assignSeats([otto, milton, hazel]);
    expect(seats.get("hazel")).toBe(MANAGER_SEAT);
    expect(seats.get("milton")).toBe(DESK_SEATS[0]);
    expect(seats.get("otto")).toBe(DESK_SEATS[1]);
  });

  test("nobody leads, nobody gets the office", () => {
    const seats = assignSeats([hazel, otto]);
    expect(seats.get("hazel")).toBe(DESK_SEATS[0]);
  });
});

describe("deriveBehaviors", () => {
  test("idle without running runs; working with one", () => {
    const b = deriveBehaviors([hazel], [run({ status: "done", finishedAt: 5 })]);
    expect(b.get("hazel")).toEqual({ kind: "idle" });
    expect(deriveBehaviors([hazel], [run({})]).get("hazel")).toEqual({
      kind: "working",
      label: "daily tech brief",
    });
  });

  test("a running child run makes the supervisor delegating and the worker working", () => {
    const runs = [
      run({ _id: "parent", label: "whale report" }),
      run({ _id: "child", agentId: "milton", parentRunId: "parent", label: "whale report" }),
    ];
    const b = deriveBehaviors([hazel, milton], runs);
    expect(b.get("hazel")).toEqual({ kind: "delegating", workerId: "milton", label: "whale report" });
    expect(b.get("milton")).toEqual({ kind: "working", label: "whale report" });
  });

  test("recentlyFinished only reports runs closed inside the window", () => {
    const runs = [
      run({ _id: "a", status: "done", finishedAt: 10_000 }),
      run({ _id: "b", agentId: "milton", status: "failed", finishedAt: 1_000 }),
    ];
    const recent = recentlyFinished(runs, 12_000, 5_000);
    expect(recent.get("hazel")).toBe("done");
    expect(recent.has("milton")).toBe(false);
  });
});

describe("routing", () => {
  test("stays on corridors and uses the aisle to change corridors", () => {
    const path = routeTo({ x: 0.245, y: 0.455 }, "H1", DESK_SEATS[7]); // H1 -> H2
    expect(path[1]).toEqual({ x: 0.245, y: LANE_Y.H1 });
    expect(path[2]).toEqual({ x: AISLE_X, y: LANE_Y.H1 });
    expect(path[3]).toEqual({ x: AISLE_X, y: LANE_Y.H2 });
    expect(path[path.length - 1]).toEqual({ x: DESK_SEATS[7].x, y: DESK_SEATS[7].y });
  });

  test("advance walks along the path and reports facing", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    const step = advance({ x: 0, y: 0 }, path, 1.5);
    expect(step.pos).toEqual({ x: 1, y: 0.5 });
    expect(step.facing).toBe("front"); // heading down the screen
    expect(step.path).toEqual([{ x: 1, y: 1 }]);
    const done = advance(step.pos, step.path, 5);
    expect(done.path).toEqual([]);
    expect(done.pos).toEqual({ x: 1, y: 1 });
  });

  test("standBeside puts the supervisor on the open side, facing the worker", () => {
    const beside = standBeside(DESK_SEATS[0]); // faces right -> stand to the left
    expect(beside.x).toBeLessThan(DESK_SEATS[0].x);
    expect(beside.facing).toBe("right");
  });
});

describe("walkPose", () => {
  test("legs alternate: only one foot is lifted at a time", () => {
    const a = walkPose(Math.PI / 2);
    expect(a.legs[0].lift).toBeGreaterThan(0);
    expect(a.legs[1].lift).toBe(0);
    const b = walkPose((3 * Math.PI) / 2);
    expect(b.legs[0].lift).toBe(0);
    expect(b.legs[1].lift).toBeGreaterThan(0);
    expect(walkPose(0).bob).toBeCloseTo(0);
  });
});
