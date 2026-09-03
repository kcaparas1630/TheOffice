// Where people can stand in `public/office/office_empty.png`, as fractions of
// the scene's width/height. Hand-placed against the artwork; tune here, not
// in the renderer.

export type Facing = "front" | "back" | "left" | "right";

export interface Spot {
  id: string;
  x: number;
  y: number; // where the feet go
  facing: Facing; // which way to face once arrived
  // Seats only: how much of a sitting figure is hidden behind the desk
  // (fraction of its height, from the bottom).
  cover?: number;
}

// Walks are planned over the walkability grid (see nav.ts / navmask.ts), so
// spots only need a position and a facing.

// The private office, top-left. Whoever runs the place sits here.
export const MANAGER_SEAT: Spot = { id: "manager", x: 0.175, y: 0.175, facing: "front", cover: 0.35 };

// The reception desk, bottom-left. Whoever's job is reception sits here.
export const RECEPTION_SEAT: Spot = { id: "reception", x: 0.25, y: 0.7, facing: "front", cover: 0.35 };

// Seats are the only spots that sit on furniture (chairs are blocked cells).
export function isSeatId(id: string): boolean {
  return id === "manager" || id === "reception" || id.startsWith("desk-");
}

// Open-plan desks: two clusters of four. Chairs are on the outer columns and
// face inward, so left-column seats face right and vice-versa.
export const DESK_SEATS: Spot[] = [
  { id: "desk-1", x: 0.245, y: 0.455, facing: "right", cover: 0.1 },
  { id: "desk-2", x: 0.418, y: 0.455, facing: "left", cover: 0.1 },
  { id: "desk-3", x: 0.535, y: 0.455, facing: "right", cover: 0.1 },
  { id: "desk-4", x: 0.72, y: 0.455, facing: "left", cover: 0.1 },
  { id: "desk-5", x: 0.245, y: 0.555, facing: "right", cover: 0.1 },
  { id: "desk-6", x: 0.418, y: 0.555, facing: "left", cover: 0.1 },
  { id: "desk-7", x: 0.535, y: 0.555, facing: "right", cover: 0.1 },
  { id: "desk-8", x: 0.72, y: 0.555, facing: "left", cover: 0.1 },
];

// Places to drift to when there is nothing to do.
export const IDLE_SPOTS: Spot[] = [
  { id: "cafe", x: 0.11, y: 0.58, facing: "back" },
  { id: "break-table", x: 0.71, y: 0.3, facing: "back" },
  { id: "kitchen", x: 0.76, y: 0.19, facing: "back" },
  { id: "lounge", x: 0.29, y: 0.79, facing: "back" },
  { id: "entrance", x: 0.5, y: 0.84, facing: "front" },
  { id: "bookshelf", x: 0.85, y: 0.5, facing: "right" },
  { id: "plant", x: 0.09, y: 0.42, facing: "left" },
];

// Sprite height as a fraction of scene height; width follows the 1:2 art.
export const SPRITE_HEIGHT = 0.085;
