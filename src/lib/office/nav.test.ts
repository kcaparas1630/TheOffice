import { describe, expect, test } from "vitest";
import { findCellPath, gridFromRows, isWalkable, lineIsClear, nearestOpenCell, planRoute, simplifyPath } from "./nav";
import { NAV_ROWS } from "./navmask";
import { DESK_SEATS, IDLE_SPOTS, MANAGER_SEAT, RECEPTION_SEAT } from "./layout";

// A room with a wall down the middle and a gap at the bottom.
const ROOM = gridFromRows([
  "..........",
  "....#.....",
  "....#.....",
  "....#.....",
  "....#.....",
  "....#.....",
  "....#.....",
  "....#.....",
  "..........",
  "..........",
]);

describe("nav grid", () => {
  test("walkability follows the mask", () => {
    expect(isWalkable(ROOM, { x: 0.05, y: 0.05 })).toBe(true);
    expect(isWalkable(ROOM, { x: 0.45, y: 0.35 })).toBe(false);
    expect(isWalkable(ROOM, { x: -1, y: 0.5 })).toBe(false);
  });

  test("nearest open cell steps off furniture", () => {
    expect(nearestOpenCell(ROOM, { x: 0.45, y: 0.35 })).toEqual({ cx: 3, cy: 3 });
    expect(nearestOpenCell(ROOM, { x: 0.15, y: 0.15 })).toEqual({ cx: 1, cy: 1 });
  });

  test("routes around the wall instead of through it", () => {
    const from = { x: 0.15, y: 0.35 };
    const to = { x: 0.85, y: 0.35 };
    expect(lineIsClear(ROOM, from, to)).toBe(false);
    const cells = findCellPath(ROOM, from, to)!;
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) expect(isWalkable(ROOM, c)).toBe(true);
    // Goes through the gap at the top or bottom, never the wall column.
    expect(cells.some((c) => c.y < 0.1 || c.y > 0.8)).toBe(true);

    const route = planRoute(ROOM, from, to);
    expect(route[0]).toEqual(from);
    expect(route[route.length - 1]).toEqual(to);
    for (let i = 1; i < route.length; i++) expect(lineIsClear(ROOM, route[i - 1], route[i])).toBe(true);
    expect(route.length).toBeLessThan(cells.length + 2);
  });

  test("straightening keeps only the corners that matter", () => {
    const open = gridFromRows(["....", "....", "....", "...."]);
    const zigzag = [
      { x: 0.1, y: 0.1 },
      { x: 0.4, y: 0.1 },
      { x: 0.6, y: 0.4 },
      { x: 0.9, y: 0.9 },
    ];
    expect(simplifyPath(open, zigzag)).toEqual([zigzag[0], zigzag[3]]);
  });

  test("a walled-off target is approached as closely as the floor allows", () => {
    const boxed = gridFromRows(["..#..", "..#..", "..#..", "..#..", "..#.."]);
    // Stops at the near side of the wall (column 1), never crosses it.
    const cells = findCellPath(boxed, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 })!;
    expect(cells[cells.length - 1]).toEqual({ x: 0.3, y: 0.5 });
    // The full route still ends on the requested point (a seat may sit on furniture).
    const route = planRoute(boxed, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 });
    expect(route[route.length - 1]).toEqual({ x: 0.9, y: 0.5 });
  });
});

describe("the office mask", () => {
  const grid = gridFromRows(NAV_ROWS);

  test("every seat and idle spot is reachable from the entrance", () => {
    const entrance = IDLE_SPOTS.find((s) => s.id === "entrance")!;
    for (const spot of [MANAGER_SEAT, RECEPTION_SEAT, ...DESK_SEATS, ...IDLE_SPOTS]) {
      const cells = findCellPath(grid, entrance, spot);
      expect(cells, `${spot.id} unreachable`).not.toBeNull();
    }
  });

  test("the outside of the building is blocked", () => {
    expect(isWalkable(grid, { x: 0.02, y: 0.02 })).toBe(false);
    expect(isWalkable(grid, { x: 0.98, y: 0.98 })).toBe(false);
  });
});
