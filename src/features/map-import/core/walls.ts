import type { Equipment, Wall } from '@/core/types';
import type { GridImage } from './types';

export interface WallOptions {
  /** Cells darker than this (0-255) count as wall (default 120). */
  threshold?: number;
  /** Work on cells of this size in metres (default 0.06: three 2 cm cells). */
  cell?: number;
  /** Pieces whose longest side is at most this many metres are machines / pillars, not walls (default 1.8). */
  maxObject?: number;
  /** Pieces smaller than this area (m2) are noise (default 0.01). */
  minArea?: number;
  /** Wall lines shorter than this (m) are dropped (default 0.5). */
  minWall?: number;
  /** How far (m) a simplified line may stray from the traced one (default 0.08). */
  tolerance?: number;
  wallHeight?: number;
  wallThickness?: number;
  objectHeight?: number;
}
export interface Structure {
  walls: Wall[];
  equipment: Equipment[];
}

const N8: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/** Zhang-Suen thinning: peels a thick line down to a one cell wide centre line. Changes `b` (1 = on) in place; `w` x `h` must have an empty border. */
function thin(b: Uint8Array, w: number, h: number) {
  const del: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!b[i]) continue;
          // neighbours clockwise from north: p2..p9
          const p = [b[i - w], b[i - w + 1], b[i + 1], b[i + w + 1], b[i + w], b[i + w - 1], b[i - 1], b[i - w - 1]];
          const n = p[0] + p[1] + p[2] + p[3] + p[4] + p[5] + p[6] + p[7];
          if (n < 2 || n > 6) continue;
          let s = 0;
          for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) s++;
          if (s !== 1) continue;
          if (pass === 0 ? p[0] * p[2] * p[4] || p[2] * p[4] * p[6] : p[0] * p[2] * p[6] || p[0] * p[4] * p[6])
            continue;
          del.push(i);
        }
      for (const i of del) b[i] = 0;
      if (del.length) changed = true;
    }
  }
}

/** Douglas-Peucker: the fewest points that keep the line within `eps` of the original. */
export function simplify(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, z] = stack.pop()!;
    const [ax, ay] = pts[a],
      [zx, zy] = pts[z];
    const dx = zx - ax,
      dy = zy - ay,
      len = Math.hypot(dx, dy) || 1;
    let far = -1,
      best = eps;
    for (let i = a + 1; i < z; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > best) {
        best = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, z]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const round = (v: number) => Math.round(v * 100) / 100;
/** Cells (1-based grid with an empty border) <-> metres. */
interface Frame {
  W: number;
  H: number;
  cs: number;
  x(c: number): number;
  y(r: number): number;
}
const frameOf = (g: GridImage, f: number): Frame => ({
  W: Math.ceil(g.width / f) + 2,
  H: Math.ceil(g.height / f) + 2, // one empty cell all round, for the thinning
  cs: f * g.res,
  x: (c) => ((c - 1 + 0.5) * f - g.originCol) * g.res,
  y: (r) => (g.originRow - (r - 1 + 0.5) * f) * g.res,
});

/** The picture as on / off cells of the coarser size. */
function binarise(g: GridImage, fr: Frame, f: number, T: number): Uint8Array {
  const b = new Uint8Array(fr.W * fr.H);
  for (let y = 0; y < g.height; y++)
    for (let x = 0, r = y * g.width; x < g.width; x++)
      if (g.alpha[r + x] >= T) b[(((y / f) | 0) + 1) * fr.W + ((x / f) | 0) + 1] = 1;
  return b;
}

/** Splits the picture into connected pieces: small compact ones become boxes (pillars, machines), tiny ones are noise, the rest are the building (their cells are returned). */
function pieces(b: Uint8Array, fr: Frame, o: { maxObject: number; minArea: number; objectHeight: number }) {
  const { W, H, cs } = fr;
  const label = new Int32Array(W * H),
    stack = new Int32Array(W * H),
    wallCells = new Uint8Array(W * H),
    equipment: Equipment[] = [];
  let id = 0;
  for (let s = 0; s < b.length; s++) {
    if (!b[s] || label[s]) continue;
    id++;
    let sp = 0,
      x0 = W,
      x1 = 0,
      y0 = H,
      y1 = 0;
    const cells: number[] = [];
    stack[sp++] = s;
    label[s] = id;
    while (sp) {
      const i = stack[--sp];
      cells.push(i);
      const x = i % W,
        y = (i - x) / W;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const [dx, dy] of N8) {
        const j = (y + dy) * W + x + dx;
        if (b[j] && !label[j]) {
          label[j] = id;
          stack[sp++] = j;
        }
      }
    }
    const wm = (x1 - x0 + 1) * cs,
      hm = (y1 - y0 + 1) * cs;
    if (cells.length * cs * cs < o.minArea) continue;
    if (Math.max(wm, hm) <= o.maxObject)
      equipment.push({
        kind: 'obstacle',
        x: round((fr.x(x0) + fr.x(x1)) / 2),
        y: round((fr.y(y0) + fr.y(y1)) / 2),
        w: round(Math.max(wm, 0.1)),
        d: round(Math.max(hm, 0.1)),
        h: o.objectHeight,
        layer: 'grid',
      });
    else for (const i of cells) wallCells[i] = 1;
  }
  return { wallCells, equipment };
}

/** Follows a thinned picture's centre lines: from every end and junction cell along its chains, then whatever loops are left. Returns lines in metres. */
function traceLines(c: Uint8Array, fr: Frame): [number, number][][] {
  const { W } = fr;
  const deg = (i: number) => N8.reduce((n, [dx, dy]) => n + c[i + dy * W + dx], 0);
  const used = new Uint8Array(c.length);
  const lines: [number, number][][] = [];
  const walk = (start: number, first: number) => {
    const path = [start];
    let prev = start,
      cur = first;
    for (;;) {
      path.push(cur);
      used[cur] = 1;
      if (deg(cur) !== 2) break;
      const next = N8.map(([dx, dy]) => cur + dy * W + dx).find((j) => c[j] && j !== prev && !used[j]);
      if (next === undefined) break;
      prev = cur;
      cur = next;
    }
    lines.push(path.map((i) => [fr.x(i % W), fr.y((i / W) | 0)]));
  };
  const from = (i: number, once: boolean) => {
    used[i] = 1;
    for (const [dx, dy] of N8) {
      const j = i + dy * W + dx;
      if (c[j] && !used[j]) {
        walk(i, j);
        if (once) break;
      }
    }
  };
  for (let i = 0; i < c.length; i++) if (c[i] && deg(i) !== 2) from(i, false);
  for (let i = 0; i < c.length; i++) if (c[i] && !used[i]) from(i, true);
  return lines;
}

const lengthOf = (l: [number, number][]) =>
  l.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0);

/**
 * Walls and machines from a cleaned floor picture. Cells are merged to ~6 cm; each connected piece is either a small compact object (pillar, machine: one box) or part of the building
 * (thinned to a centre line, traced, simplified into straight wall segments). Everything is in metres from the map origin, ready for the 3D scene (`SiteLayout` walls / equipment).
 * The result is an estimate from lidar, not a survey: laying a DWG over it (see `dwg.ts`) gives the accurate walls.
 */
export function extractStructure(g: GridImage, o: WallOptions = {}): Structure {
  const f = Math.max(1, Math.round((o.cell ?? 0.06) / g.res)),
    fr = frameOf(g, f);
  const { wallCells, equipment } = pieces(binarise(g, fr, f, o.threshold ?? 120), fr, {
    maxObject: o.maxObject ?? 1.8,
    minArea: o.minArea ?? 0.01,
    objectHeight: o.objectHeight ?? 1.2,
  });
  thin(wallCells, fr.W, fr.H);
  const walls: Wall[] = [];
  for (const line of traceLines(wallCells, fr)) {
    if (lengthOf(line) < (o.minWall ?? 0.5)) continue; // a smudge, not a wall
    const pts = simplify(line, o.tolerance ?? 0.08);
    for (let k = 1; k < pts.length; k++)
      walls.push({
        a: [round(pts[k - 1][0]), round(pts[k - 1][1])],
        b: [round(pts[k][0]), round(pts[k][1])],
        t: o.wallThickness ?? 0.15,
        h: o.wallHeight ?? 3,
        layer: 'grid',
      });
  }
  return { walls, equipment };
}
