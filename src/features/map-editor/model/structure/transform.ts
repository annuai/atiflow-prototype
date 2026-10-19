import type { P } from './types';

type Box = { cx: number; cy: number; w: number; h: number };
const MIN = 0.2; // a straight wall has no height: the box still needs one to be grabbed and scaled

/** The straight (not turned) box round some points: what a wall or an outline is resized and turned by. */
export function boxAround(points: P[]): Box {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.max(MIN, x1 - x0), h: Math.max(MIN, y1 - y0) };
}

/** The same points carried from the straight box `from` into the box `to` (moved, scaled, turned by `to.rot`). */
export function carry(points: P[], from: Box, to: Box & { rot: number }): P[] {
  const c = Math.cos(to.rot),
    s = Math.sin(to.rot);
  return points.map(([x, y]) => {
    const lx = ((x - from.cx) / from.w) * to.w,
      ly = ((y - from.cy) / from.h) * to.h;
    return [Math.round((to.cx + lx * c - ly * s) * 100) / 100, Math.round((to.cy + lx * s + ly * c) * 100) / 100];
  });
}
