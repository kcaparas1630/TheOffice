// Walkability grid + pathfinding for the pixel office. The scene is divided
// into cells; each is open floor or blocked (walls, furniture, outside). Walks
// are planned with A* over open cells and then straightened, so nobody
// strolls through a desk. Pure; the mask itself lives in `navmask.ts`.

export interface Point {
  x: number;
  y: number;
}

export interface NavGrid {
  cols: number;
  rows: number;
  blocked: Uint8Array; // row-major, 1 = blocked
}

// Build a grid from ASCII rows ('#' blocked, anything else open).
export function gridFromRows(rows: string[]): NavGrid {
  const cols = rows[0]?.length ?? 0;
  const blocked = new Uint8Array(cols * rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < cols; x++) blocked[y * cols + x] = row[x] === "#" ? 1 : 0;
  });
  return { cols, rows: rows.length, blocked };
}

export function cellOf(grid: NavGrid, p: Point): { cx: number; cy: number } {
  return {
    cx: Math.min(grid.cols - 1, Math.max(0, Math.floor(p.x * grid.cols))),
    cy: Math.min(grid.rows - 1, Math.max(0, Math.floor(p.y * grid.rows))),
  };
}

export function centerOf(grid: NavGrid, cx: number, cy: number): Point {
  return { x: (cx + 0.5) / grid.cols, y: (cy + 0.5) / grid.rows };
}

export function isBlockedCell(grid: NavGrid, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) return true;
  return grid.blocked[cy * grid.cols + cx] === 1;
}

export function isWalkable(grid: NavGrid, p: Point): boolean {
  if (p.x < 0 || p.y < 0 || p.x >= 1 || p.y >= 1) return false;
  const { cx, cy } = cellOf(grid, p);
  return !isBlockedCell(grid, cx, cy);
}

// Open cells near `p`, nearest first (ring search), up to `limit`.
export function openCellsNear(grid: NavGrid, p: Point, limit = 8): { cx: number; cy: number }[] {
  const { cx, cy } = cellOf(grid, p);
  const found: { cx: number; cy: number; d: number }[] = [];
  const maxR = Math.max(grid.cols, grid.rows);
  for (let r = 0; r <= maxR && found.length < limit; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (isBlockedCell(grid, x, y)) continue;
        found.push({ cx: x, cy: y, d: dx * dx + dy * dy });
      }
    }
  }
  return found
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map(({ cx, cy }) => ({ cx, cy }));
}

// The closest open cell to `p`, or null if the grid is solid.
export function nearestOpenCell(grid: NavGrid, p: Point): { cx: number; cy: number } | null {
  return openCellsNear(grid, p, 1)[0] ?? null;
}

// A walker is a small disc, not a point: the point plus four offsets of
// `RADIUS` cells must all be on open floor, so routes never brush a corner.
const RADIUS = 0.35;

export function isClearAround(grid: NavGrid, p: Point): boolean {
  const rx = RADIUS / grid.cols;
  const ry = RADIUS / grid.rows;
  return (
    isWalkable(grid, p) &&
    isWalkable(grid, { x: p.x - rx, y: p.y }) &&
    isWalkable(grid, { x: p.x + rx, y: p.y }) &&
    isWalkable(grid, { x: p.x, y: p.y - ry }) &&
    isWalkable(grid, { x: p.x, y: p.y + ry })
  );
}

// Sample the segment a few times per cell; true if the disc stays clear.
export function lineIsClear(grid: NavGrid, a: Point, b: Point): boolean {
  const steps = Math.ceil(Math.max(Math.abs(b.x - a.x) * grid.cols, Math.abs(b.y - a.y) * grid.rows) * 4) + 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!isClearAround(grid, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
  }
  return true;
}

// A* over open cells (8-connected, no corner cutting). Returns cell centres
// from the cell nearest `from` to the nearest reachable cell around `to`
// (a seat can sit in a pocket the mask sealed off, so a few candidates are
// tried), or null if none is reachable.
export function findCellPath(grid: NavGrid, from: Point, to: Point): Point[] | null {
  const start = nearestOpenCell(grid, from);
  if (!start) return null;
  const goal = nearestReachableCell(grid, start, to);
  if (!goal) return null;
  return astar(grid, start, goal);
}

// Flood-fill from `start` (4-connected, which is what the no-corner-cutting
// A* can traverse) and return the reached cell closest to `to`. Furniture
// can wall a seat off on the near side, so "nearest open" is not enough.
export function nearestReachableCell(
  grid: NavGrid,
  start: { cx: number; cy: number },
  to: Point
): { cx: number; cy: number } | null {
  const target = cellOf(grid, to);
  const seen = new Uint8Array(grid.cols * grid.rows);
  const queue: number[] = [start.cy * grid.cols + start.cx];
  seen[queue[0]] = 1;
  let best: { cx: number; cy: number; d: number } | null = null;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const cx = i % grid.cols;
    const cy = Math.floor(i / grid.cols);
    const d = (cx - target.cx) ** 2 + (cy - target.cy) ** 2;
    if (!best || d < best.d) best = { cx, cy, d };
    if (d === 0) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (isBlockedCell(grid, nx, ny)) continue;
      const ni = ny * grid.cols + nx;
      if (!seen[ni]) {
        seen[ni] = 1;
        queue.push(ni);
      }
    }
  }
  return best ? { cx: best.cx, cy: best.cy } : null;
}

function astar(
  grid: NavGrid,
  start: { cx: number; cy: number },
  goal: { cx: number; cy: number }
): Point[] | null {
  const n = grid.cols * grid.rows;
  const idx = (x: number, y: number) => y * grid.cols + x;
  const s = idx(start.cx, start.cy);
  const g = idx(goal.cx, goal.cy);
  const gScore = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open: number[] = [s];
  const f = new Float64Array(n).fill(Infinity);
  const h = (i: number) => {
    const dx = Math.abs((i % grid.cols) - goal.cx);
    const dy = Math.abs(Math.floor(i / grid.cols) - goal.cy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  gScore[s] = 0;
  f[s] = h(s);

  while (open.length > 0) {
    // Smallest f; the grid is small enough that a linear scan is fine.
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open[bi];
    open.splice(bi, 1);
    if (cur === g) break;
    closed[cur] = 1;
    const cx = cur % grid.cols;
    const cy = Math.floor(cur / grid.cols);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (isBlockedCell(grid, nx, ny)) continue;
        // No squeezing diagonally between two blocked cells.
        if (dx !== 0 && dy !== 0 && (isBlockedCell(grid, cx + dx, cy) || isBlockedCell(grid, cx, cy + dy))) continue;
        const ni = idx(nx, ny);
        if (closed[ni]) continue;
        const tentative = gScore[cur] + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
        if (tentative < gScore[ni]) {
          gScore[ni] = tentative;
          came[ni] = cur;
          f[ni] = tentative + h(ni);
          if (!open.includes(ni)) open.push(ni);
        }
      }
    }
  }
  if (came[g] === -1 && g !== s) return null;
  const cells: Point[] = [];
  for (let i = g; i !== -1; i = came[i]) {
    cells.push(centerOf(grid, i % grid.cols, Math.floor(i / grid.cols)));
    if (i === s) break;
  }
  return cells.reverse();
}

// Drop waypoints that a straight line can skip (string pulling).
export function simplifyPath(grid: NavGrid, path: Point[]): Point[] {
  if (path.length <= 2) return path;
  const out: Point[] = [path[0]];
  let anchor = 0;
  for (let i = 2; i <= path.length; i++) {
    if (i === path.length || !lineIsClear(grid, path[anchor], path[i])) {
      out.push(path[i - 1]);
      anchor = i - 1;
    }
  }
  return out;
}

// Full route from `from` to `to`: planned over open cells, straightened, and
// ending exactly on `to` (seats sit on furniture, so the last step is allowed
// to leave the open floor). Falls back to a straight line if unreachable.
export function planRoute(grid: NavGrid, from: Point, to: Point): Point[] {
  const cells = findCellPath(grid, from, to);
  if (!cells) return [from, to];
  const full = [from, ...cells, to];
  const simplified = simplifyPath(grid, full);
  // simplifyPath keeps endpoints; make sure the final target is exact.
  simplified[simplified.length - 1] = to;
  return simplified;
}
