import type { Vec2 } from './types';
export type Poly = [number, number][];
export const pointInPoly = (x: number, y: number, p: Poly): boolean => {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if (p[i][1] > y !== p[j][1] > y && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0])
      c = !c;
  return c;
};
export const polyCenter = (p: Poly): Vec2 => ({
  x: p.reduce((a, q) => a + q[0], 0) / p.length,
  y: p.reduce((a, q) => a + q[1], 0) / p.length,
});
/** Shortest signed angle from a to b in (-pi, pi]; safe for unwrapped (accumulated) angles. */
export const angleDiff = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d <= -Math.PI) d += Math.PI * 2;
  return d;
};
/** Closest point on segment a-b to p: distance and segment heading. */
export const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const vx = bx - ax,
    vy = by - ay,
    L2 = vx * vx + vy * vy || 1e-9;
  const u = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2));
  return { d: Math.hypot(px - (ax + u * vx), py - (ay + u * vy)), heading: Math.atan2(vy, vx) };
};
