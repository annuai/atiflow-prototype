import type { TrafficZone } from './types';

type Gate = NonNullable<TrafficZone['gate']>;
/** Unit normal of a Line gate towards the side it applies to (the side robots come from). */
export function gateNormal(g: Gate): [number, number] {
  const dx = g.b[0] - g.a[0],
    dy = g.b[1] - g.a[1],
    l = Math.hypot(dx, dy) || 1;
  return [(-dy / l) * g.side, (dx / l) * g.side];
}
/** How far a point is from the gate's line towards its controlled side (negative = on the free side). */
export const gateDepthAt = (g: Gate, x: number, y: number) => {
  const n = gateNormal(g);
  return (x - g.a[0]) * n[0] + (y - g.a[1]) * n[1];
};
/** A robot heading `theta` is coming from the controlled side when it moves towards the line. */
export const comesFromGateSide = (g: Gate, theta: number) => {
  const n = gateNormal(g);
  return Math.cos(theta) * n[0] + Math.sin(theta) * n[1] < 0;
};
