import { z } from 'zod';
import type { Equipment, Shape3d, SiteLayout, Wall } from '@/core/types';

/** A move of the drawing onto the map: scale, then rotate (radians, counter-clockwise) about the origin, then shift (metres). */
export interface Similarity {
  scale: number;
  rot: number;
  dx: number;
  dy: number;
}
export const IDENTITY: Similarity = { scale: 1, rot: 0, dx: 0, dy: 0 };
type P = [number, number];

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

export interface Layout {
  walls: Wall[];
  equipment: Equipment[];
  floorPolygons: P[][];
  /** floor patches and extrusions of the edited structure, and the labels over it */
  shapes?: Shape3d[];
  labels?: SiteLayout['labels'];
  /** the Work areas */
  zones?: SiteLayout['zones'];
}
const pt = z.tuple([z.number().finite(), z.number().finite()]);
const layoutSchema = z.object({
  walls: z.array(
    z.object({ a: pt, b: pt, t: z.number().default(0.15), h: z.number().default(3), layer: z.string().default('dwg') }),
  ),
  equipment: z
    .array(
      z.object({
        kind: z.string().default('machine'),
        x: z.number(),
        y: z.number(),
        w: z.number(),
        d: z.number(),
        h: z.number().default(1.5),
        layer: z.string().default('dwg'),
      }),
    )
    .default([]),
  floorPolygons: z.array(z.array(pt)).default([]),
});
/** The layout the DWG import (`tools/dwg-import`) writes as `site.json`; anything else is refused with `null`. */
export function parseLayout(json: unknown): Layout | null {
  const r = layoutSchema.safeParse(json);
  return r.success && r.data.walls.length ? (r.data as Layout) : null;
}

/** The layout moved by `t` (a machine box stays upright: it becomes the box around its turned self). */
export function transformLayout(l: Layout, t: Similarity): Layout {
  const c = Math.abs(Math.cos(t.rot)),
    s = Math.abs(Math.sin(t.rot));
  return {
    walls: l.walls.map((w) => ({ ...w, a: applyPoint(t, w.a), b: applyPoint(t, w.b), t: w.t * t.scale })),
    equipment: l.equipment.map((e) => {
      const [x, y] = applyPoint(t, [e.x, e.y]);
      return { ...e, x, y, w: (e.w * c + e.d * s) * t.scale, d: (e.w * s + e.d * c) * t.scale };
    }),
    floorPolygons: l.floorPolygons.map((p) => p.map((q) => applyPoint(t, q))),
  };
}

const distToSeg = (p: P, a: P, b: P) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l2 = dx * dx + dy * dy;
  const k = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + k * dx), p[1] - (a[1] + k * dy));
};
/** Points along the walls, about every `step` metres, at most `max` of them. */
export function samplePoints(walls: Wall[], step = 0.25, max = 1500): P[] {
  const out: P[] = [];
  for (const w of walls) {
    const n = Math.max(1, Math.round(Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) / step));
    for (let i = 0; i <= n; i++) out.push([w.a[0] + ((w.b[0] - w.a[0]) * i) / n, w.a[1] + ((w.b[1] - w.a[1]) * i) / n]);
  }
  if (out.length <= max) return out;
  const k = out.length / max;
  return Array.from({ length: max }, (_, i) => out[Math.floor(i * k)]);
}
/**
 * How well the drawing's walls lie on the lidar walls, 0 to 1: the average over points of the drawing of a bell curve of their distance to the nearest lidar wall (sigma 25 cm).
 * Lidar has gaps, so this rewards the drawing's walls that ARE seen and is not hurt much by the ones that are not.
 */
export function alignmentScore(points: P[], lidar: Wall[], t: Similarity, sigma = 0.25): number {
  if (!points.length || !lidar.length) return 0;
  let sum = 0;
  for (const p of points) {
    const q = applyPoint(t, p);
    let best = Infinity;
    for (const w of lidar) {
      const d = distToSeg(q, w.a, w.b);
      if (d < best) best = d;
    }
    sum += Math.exp(-(best * best) / (2 * sigma * sigma));
  }
  return sum / points.length;
}
/**
 * Polishes a rough alignment: tries small changes of offset, rotation and scale and keeps what raises the score, with smaller and smaller steps. Needs the drawing to be roughly in place
 * already (within a metre or two): it improves a match, it does not find one.
 */
export function refineAlignment(
  drawing: Wall[],
  lidar: Wall[],
  start: Similarity,
  rounds = 24,
): { t: Similarity; score: number } {
  const pts = samplePoints(drawing, 0.4, 600);
  let t = start,
    best = alignmentScore(pts, lidar, t),
    step = 0.4,
    rstep = 0.01,
    sstep = 0.004;
  for (let r = 0; r < rounds; r++) {
    let moved = false;
    const tries: Similarity[] = [
      { ...t, dx: t.dx + step },
      { ...t, dx: t.dx - step },
      { ...t, dy: t.dy + step },
      { ...t, dy: t.dy - step },
      { ...t, rot: t.rot + rstep },
      { ...t, rot: t.rot - rstep },
      { ...t, scale: t.scale * (1 + sstep) },
      { ...t, scale: t.scale * (1 - sstep) },
    ];
    for (const c of tries) {
      const sc = alignmentScore(pts, lidar, c);
      if (sc > best + 1e-6) {
        best = sc;
        t = c;
        moved = true;
      }
    }
    if (!moved) {
      step /= 2;
      rstep /= 2;
      sstep /= 2;
    }
  }
  return { t, score: best };
}

const bbox = (ws: Wall[]) => {
  const xs = ws.flatMap((w) => [w.a[0], w.b[0]]),
    ys = ws.flatMap((w) => [w.a[1], w.b[1]]);
  return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
};
/**
 * A first alignment with no help: a drawing's own coordinates are arbitrary (often its south-west corner is 0, 0), so for each quarter turn its middle is put on the middle of the lidar
 * walls, the best of the four by score is kept, and then polished with `refineAlignment`. Works when the drawing and the lidar show the same building; the person can still adjust by hand.
 */
export function autoAlign(drawing: Wall[], lidar: Wall[]): { t: Similarity; score: number } {
  const d = bbox(drawing),
    l = bbox(lidar);
  const pts = samplePoints(drawing, 0.4, 600);
  let best: Similarity = IDENTITY,
    bestScore = -1;
  for (let k = 0; k < 4; k++) {
    const rot = (k * Math.PI) / 2;
    const c = Math.cos(rot),
      s = Math.sin(rot);
    const t: Similarity = { scale: 1, rot, dx: l.cx - (d.cx * c - d.cy * s), dy: l.cy - (d.cx * s + d.cy * c) };
    const sc = alignmentScore(pts, lidar, t, 1.5); // wide bell: only roughly in place yet
    if (sc > bestScore) {
      bestScore = sc;
      best = t;
    }
  }
  return refineAlignment(drawing, lidar, best, 40);
}
