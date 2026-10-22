type P = [number, number];

/** A move of the drawing onto the map: scale, then rotate (radians, counter-clockwise) about the origin, then shift (metres). */
export interface Similarity {
  scale: number;
  rot: number;
  dx: number;
  dy: number;
}
export const IDENTITY: Similarity = { scale: 1, rot: 0, dx: 0, dy: 0 };

export const applyPoint = (t: Similarity, [x, y]: P): P => {
  const c = Math.cos(t.rot) * t.scale,
    s = Math.sin(t.rot) * t.scale;
  return [x * c - y * s + t.dx, x * s + y * c + t.dy];
};

/**
 * The move that takes each `from` point onto its `to` point as well as it can (least squares; two pairs fix it exactly). Used for "this corner of the drawing is that corner of the map".
 */
export function solveSimilarity(pairs: { from: P; to: P }[]): Similarity {
  if (pairs.length < 2) return IDENTITY;
  const n = pairs.length;
  const mf = [pairs.reduce((a, p) => a + p.from[0], 0) / n, pairs.reduce((a, p) => a + p.from[1], 0) / n];
  const mt = [pairs.reduce((a, p) => a + p.to[0], 0) / n, pairs.reduce((a, p) => a + p.to[1], 0) / n];
  let a = 0,
    b = 0,
    d = 0;
  for (const { from, to } of pairs) {
    const fx = from[0] - mf[0],
      fy = from[1] - mf[1],
      tx = to[0] - mt[0],
      ty = to[1] - mt[1];
    a += fx * tx + fy * ty; // sum of cos parts
    b += fx * ty - fy * tx; // sum of sin parts
    d += fx * fx + fy * fy;
  }
  if (d === 0) return IDENTITY;
  const scale = Math.hypot(a, b) / d,
    rot = Math.atan2(b, a);
  const c = Math.cos(rot) * scale,
    s = Math.sin(rot) * scale;
  return { scale, rot, dx: mt[0] - (mf[0] * c - mf[1] * s), dy: mt[1] - (mf[0] * s + mf[1] * c) };
}
