import type { RobotTelemetry } from '../../src/core/types';

export type Rect = { x: number; y: number; th: number; l: number; w: number };
const corners = (r: Rect) => { const c = Math.cos(r.th), s = Math.sin(r.th); return [[r.l / 2, r.w / 2], [r.l / 2, -r.w / 2], [-r.l / 2, -r.w / 2], [-r.l / 2, r.w / 2]].map(([a, b]) => [r.x + a * c - b * s, r.y + a * s + b * c]); };
/** Separating-axis test on the real rectangles: true when they overlap or touch. */
export function touching(a: Rect, b: Rect) {
  const A = corners(a), B = corners(b);
  for (const poly of [A, B]) for (let i = 0; i < 4; i++) {
    const p = poly[i], q = poly[(i + 1) % 4]; const nx = -(q[1] - p[1]), ny = q[0] - p[0];
    const pr = (P: number[][]) => P.map((v) => v[0] * nx + v[1] * ny); const pa = pr(A), pb = pr(B);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}
/** A robot (1.2 x 0.85 m) and, while it tows one, its trolley (1.1 x 0.7 m). */
export const rects = (t: RobotTelemetry): Rect[] => [{ x: t.pose.x, y: t.pose.y, th: t.pose.theta, l: 1.2, w: 0.85 }, ...(t.trailer ? [{ x: t.trailer.x, y: t.trailer.y, th: t.trailer.theta, l: 1.1, w: 0.7 }] : [])];
