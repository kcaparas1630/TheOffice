// Where people can stand in `public/office/office_empty.png`, as fractions of
// the scene's width/height. Hand-placed against the artwork; tune here, not
// in the renderer.

export type Facing = "front" | "back" | "left" | "right";
export type LaneId = "H1" | "H2";

export interface Spot {
  id: string;
  x: number;
  y: number; // where the feet go
  facing: Facing; // which way to face once arrived
  lane: LaneId; // the corridor used to reach it
}

// Two horizontal corridors (above and below the desk clusters) joined by the
// vertical aisle between the clusters. Walks are routed along these so nobody
// strolls straight through a desk.
export const LANE_Y: Record<LaneId, number> = { H1: 0.34, H2: 0.615 };
export const AISLE_X = 0.475;

// The private office, top-left. Whoever runs the place sits here.
export const MANAGER_SEAT: Spot = { id: "manager", x: 0.175, y: 0.175, facing: "front", lane: "H1" };

// Open-plan desks: two clusters of four. Chairs are on the outer columns and
// face inward, so left-column seats face right and vice-versa.
export const DESK_SEATS: Spot[] = [
  { id: "desk-1", x: 0.245, y: 0.455, facing: "right", lane: "H1" },
  { id: "desk-2", x: 0.418, y: 0.455, facing: "left", lane: "H1" },
  { id: "desk-3", x: 0.535, y: 0.455, facing: "right", lane: "H1" },
  { id: "desk-4", x: 0.72, y: 0.455, facing: "left", lane: "H1" },
  { id: "desk-5", x: 0.245, y: 0.555, facing: "right", lane: "H2" },
  { id: "desk-6", x: 0.418, y: 0.555, facing: "left", lane: "H2" },
  { id: "desk-7", x: 0.535, y: 0.555, facing: "right", lane: "H2" },
  { id: "desk-8", x: 0.72, y: 0.555, facing: "left", lane: "H2" },
];

// Places to drift to when there is nothing to do.
export const IDLE_SPOTS: Spot[] = [
  { id: "cafe", x: 0.11, y: 0.58, facing: "back", lane: "H2" },
  { id: "break-table", x: 0.71, y: 0.3, facing: "back", lane: "H1" },
  { id: "kitchen", x: 0.76, y: 0.19, facing: "back", lane: "H1" },
  { id: "lounge", x: 0.31, y: 0.86, facing: "front", lane: "H2" },
  { id: "entrance", x: 0.5, y: 0.84, facing: "front", lane: "H2" },
  { id: "bookshelf", x: 0.85, y: 0.5, facing: "right", lane: "H2" },
  { id: "plant", x: 0.09, y: 0.42, facing: "left", lane: "H1" },
];

// Sprite height as a fraction of scene height; width follows the 1:2 art.
export const SPRITE_HEIGHT = 0.085;
