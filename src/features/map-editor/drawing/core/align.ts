import { applyPoint, type Similarity } from '@/core/similarity';
import type { P } from './types';

/** The drawing's own centre point (its frame, metres) is what a person thinks of as "where the drawing is": these move, turn and scale the drawing about it. */
export const centreOf = (b: { minX: number; minY: number; maxX: number; maxY: number }): P => [
  (b.minX + b.maxX) / 2,
  (b.minY + b.maxY) / 2,
];

/** The move that sends the drawing frame's point `c` to map point `at` with the given scale and turn. */
export function placeCentre(c: P, at: P, scale: number, rot: number): Similarity {
  const cos = Math.cos(rot) * scale,
    sin = Math.sin(rot) * scale;
  return { scale, rot, dx: at[0] - (c[0] * cos - c[1] * sin), dy: at[1] - (c[0] * sin + c[1] * cos) };
}
/** Same move, but the drawing stays where it is on the map while it turns or grows about its centre. */
export function aboutCentre(t: Similarity, c: P, patch: Partial<Pick<Similarity, 'scale' | 'rot'>>): Similarity {
  return placeCentre(c, applyPoint(t, c), patch.scale ?? t.scale, patch.rot ?? t.rot);
}
/** Where a map point is in the drawing's frame. */
export function invert(t: Similarity, [x, y]: P): P {
  const cos = Math.cos(t.rot) * t.scale,
    sin = Math.sin(t.rot) * t.scale;
  const d = cos * cos + sin * sin || 1;
  const px = x - t.dx,
    py = y - t.dy;
  return [(px * cos + py * sin) / d, (-px * sin + py * cos) / d];
}
/**
 * The move that takes two points of the drawing onto two points of the map. By default the scale stays as it is (a drawing with the right units is already to scale; two clicks are never exact
 * enough to improve on that), so only the turn and the position are solved; `fitScale` lets the distance between the points set the scale too.
 */
export function twoPoints(pairs: { from: P; to: P }[], scale: number, fitScale = false): Similarity | null {
  if (pairs.length < 2) return null;
  const [a, b] = pairs;
  const fx = b.from[0] - a.from[0],
    fy = b.from[1] - a.from[1],
    tx = b.to[0] - a.to[0],
    ty = b.to[1] - a.to[1];
  const fl = Math.hypot(fx, fy),
    tl = Math.hypot(tx, ty);
  if (fl < 1e-6 || tl < 1e-6) return null;
  const rot = Math.atan2(ty, tx) - Math.atan2(fy, fx);
  const s = fitScale ? tl / fl : scale;
  const mf: P = [(a.from[0] + b.from[0]) / 2, (a.from[1] + b.from[1]) / 2];
  const mt: P = [(a.to[0] + b.to[0]) / 2, (a.to[1] + b.to[1]) / 2];
  return placeCentre(mf, mt, s, rot);
}
/** The matrix that draws the drawing frame onto an SVG whose x is `x - minX` and y is `maxY - y` (the editor's canvas). */
export function svgMatrix(t: Similarity, minX: number, maxY: number): string {
  const c = Math.cos(t.rot) * t.scale,
    s = Math.sin(t.rot) * t.scale;
  return `matrix(${c} ${-s} ${-s} ${-c} ${t.dx - minX} ${maxY - t.dy})`;
}
