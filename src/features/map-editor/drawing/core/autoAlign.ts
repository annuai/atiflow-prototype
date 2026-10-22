import type { Wall } from '@/core/types';
import { IDENTITY, type Similarity } from '@/core/similarity';
import { invert } from './align';
import type { P } from './types';

/**
 * Finds where a drawing lies on a map without being told. The drawing is usually bigger than the map (a plant drawing holds several buildings) and the map's walls are rough, so two things are
 * used that survive that: the directions the walls run in, and votes. Directions give the turn (the histograms of wall directions of both are slid over each other); then every wall point of the
 * drawing and every wall point of the map that runs the same way votes for the shift that would put one on the other, and the shifts many pairs agree on are the candidates. Each candidate is
 * polished and scored by how much of the MAP's walls the drawing explains.
 */
interface Sample {
  x: number;
  y: number;
  /** direction of the wall it sits on, 0 to pi */
  a: number;
}
const TAU = Math.PI;
const norm = (a: number) => ((a % TAU) + TAU) % TAU;

/** Points along walls about every `step` metres, with the wall's direction, at most `max` of them. */
export function sampleWalls(walls: Wall[], step: number, max: number): Sample[] {
  const out: Sample[] = [];
  for (const w of walls) {
    const dx = w.b[0] - w.a[0],
      dy = w.b[1] - w.a[1],
      len = Math.hypot(dx, dy);
    if (len < 0.2) continue;
    const a = norm(Math.atan2(dy, dx));
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      out.push({ x: w.a[0] + dx * t, y: w.a[1] + dy * t, a });
    }
  }
  if (out.length <= max) return out;
  const k = out.length / max;
  return Array.from({ length: max }, (_, i) => out[Math.floor(i * k)]);
}

const BINS = 180;
/** How much wall runs in each direction (1 degree bins, blurred by a degree each side). */
function histogram(walls: Wall[]): number[] {
  const h = new Array<number>(BINS).fill(0);
  for (const w of walls) {
    const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const k = Math.floor((norm(Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0])) / TAU) * BINS) % BINS;
    h[k] += len;
  }
  return h.map((_, i) => h[(i + BINS - 1) % BINS] * 0.5 + h[i] + h[(i + 1) % BINS] * 0.5);
}
/** The turns (radians, counter-clockwise, mod pi) that bring the drawing's directions onto the map's best, strongest first. */
export function turnCandidates(drawing: Wall[], map: Wall[], count = 4): number[] {
  const hd = histogram(drawing),
    hm = histogram(map);
  const score = Array.from({ length: BINS }, (_, s) => {
    let v = 0;
    for (let k = 0; k < BINS; k++) v += hd[k] * hm[(k + s) % BINS];
    return v;
  });
  const peaks: number[] = [];
  const order = score.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (peaks.every((p) => Math.min(Math.abs(p - i), BINS - Math.abs(p - i)) > 6)) peaks.push(i);
    if (peaks.length >= count) break;
  }
  return peaks.map((i) => (i / BINS) * TAU);
}

/** Wall segments in a grid, so "how far is this point from the nearest wall" is quick. */
class Near {
  private cell = new Map<number, number[]>();
  constructor(
    private segs: Wall[],
    private size = 2,
  ) {
    segs.forEach((s, i) => {
      const n = Math.max(1, Math.ceil(Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) / (size / 2)));
      const seen = new Set<number>();
      for (let k = 0; k <= n; k++) {
        const x = s.a[0] + ((s.b[0] - s.a[0]) * k) / n,
          y = s.a[1] + ((s.b[1] - s.a[1]) * k) / n;
        seen.add(this.key(Math.floor(x / size), Math.floor(y / size)));
      }
      for (const key of seen) {
        const l = this.cell.get(key);
        if (l) l.push(i);
        else this.cell.set(key, [i]);
      }
    });
  }
  private key = (cx: number, cy: number) => (cx + 50000) * 100003 + (cy + 50000);
  /** distance to the nearest wall within one cell around, or `cap` */
  dist(p: P, cap: number): number {
    const cx = Math.floor(p[0] / this.size),
      cy = Math.floor(p[1] / this.size);
    let best = cap;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const i of this.cell.get(this.key(cx + dx, cy + dy)) ?? []) {
          const s = this.segs[i];
          const vx = s.b[0] - s.a[0],
            vy = s.b[1] - s.a[1],
            l2 = vx * vx + vy * vy;
          const k = l2 ? Math.max(0, Math.min(1, ((p[0] - s.a[0]) * vx + (p[1] - s.a[1]) * vy) / l2)) : 0;
          const d = Math.hypot(p[0] - (s.a[0] + k * vx), p[1] - (s.a[1] + k * vy));
          if (d < best) best = d;
        }
    return best;
  }
}

/** The share of the map's walls the drawing explains under `t`: a bell curve (sigma 30 cm) of the distance from each map wall point to the nearest drawing wall. */
function coverage(points: P[], near: Near, t: Similarity, sigma = 0.3): number {
  let sum = 0;
  for (const p of points) {
    const d = near.dist(invert(t, p), 3) * t.scale;
    sum += Math.exp(-(d * d) / (2 * sigma * sigma));
  }
  return sum / points.length;
}

function climb(score: (t: Similarity) => number, start: Similarity): { t: Similarity; score: number } {
  let t = start,
    best = score(t),
    step = 0.5,
    rstep = 0.01,
    sstep = 0.004;
  for (let r = 0; r < 30; r++) {
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
      const s = score(c);
      if (s > best + 1e-6) {
        best = s;
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

/** The drawing's walls placed on the map: the best turn and shift found, and how much of the map's walls it explains (0 to 1). */
export function alignToMap(drawing: Wall[], map: Wall[]): { t: Similarity; score: number } {
  if (!drawing.length || !map.length) return { t: IDENTITY, score: 0 };
  const D = sampleWalls(drawing, 0.6, 2500),
    M = sampleWalls(map, 0.6, 2500);
  const mapPts = sampleWalls(map, 0.5, 900).map((s) => [s.x, s.y] as P);
  const near = new Near(drawing);
  const cell = 0.5;
  const found: { t: Similarity; score: number }[] = [];
  for (const base of turnCandidates(drawing, map)) {
    for (const rot of [base, base + Math.PI]) {
      const c = Math.cos(rot),
        s = Math.sin(rot);
      const votes = new Map<number, number>();
      for (const d of D) {
        const dx = d.x * c - d.y * s,
          dy = d.x * s + d.y * c,
          da = norm(d.a + rot);
        for (const m of M) {
          const diff = Math.abs(da - m.a);
          if (Math.min(diff, TAU - diff) > 0.07) continue; // about 4 degrees
          const ix = Math.round((m.x - dx) / cell),
            iy = Math.round((m.y - dy) / cell);
          const key = (ix + 40000) * 80021 + (iy + 40000);
          votes.set(key, (votes.get(key) ?? 0) + 1);
        }
      }
      // the shifts most pairs agree on (a cell and its eight neighbours count together), far enough apart to be different places
      const peaks: { ix: number; iy: number; v: number }[] = [];
      const at = (ix: number, iy: number) => votes.get((ix + 40000) * 80021 + (iy + 40000)) ?? 0;
      for (const [key, v0] of votes) {
        if (v0 < 3) continue;
        const ix = Math.floor(key / 80021) - 40000,
          iy = (key % 80021) - 40000;
        let v = 0;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) v += at(ix + a, iy + b);
        peaks.push({ ix, iy, v });
      }
      peaks.sort((a, b) => b.v - a.v);
      const top: typeof peaks = [];
      for (const p of peaks) {
        if (top.every((q) => Math.hypot(q.ix - p.ix, q.iy - p.iy) * cell > 3)) top.push(p);
        if (top.length >= 3) break;
      }
      for (const p of top) {
        const t0: Similarity = { scale: 1, rot, dx: p.ix * cell, dy: p.iy * cell };
        found.push({ t: t0, score: coverage(mapPts, near, t0) });
      }
    }
  }
  found.sort((a, b) => b.score - a.score);
  let best = found[0] ?? { t: IDENTITY, score: 0 };
  for (const f of found.slice(0, 3)) {
    const r = climb((t) => coverage(mapPts, near, t), f.t);
    if (r.score > best.score) best = r;
  }
  return best;
}
