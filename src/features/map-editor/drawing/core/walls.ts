import { fitRect } from '@/core/rect';
import type { BuiltLine, P, Shape } from './types';

/**
 * Turns the lines of a wall layer into walls. Drawings draw a wall as two parallel lines (its two faces), as a thin closed rectangle, or as a single line, and a long wall is often cut into
 * many pieces. So: thin rectangles become one wall, two parallel lines close together (and overlapping) become one wall as thick as their gap, and pieces that meet end to end are joined into one
 * line. What cannot be paired stays a wall of the usual thickness.
 */
export interface Seg {
  a: P;
  b: P;
  t: number;
}
const len = (s: Seg) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
const dirOf = (s: Seg): P => {
  const l = len(s) || 1;
  return [(s.b[0] - s.a[0]) / l, (s.b[1] - s.a[1]) / l];
};

export const MIN_SEG = 0.1;
/** Walls thicker than this are not "two faces of one wall" but two walls. */
const MAX_PAIR_GAP = 0.8;
const MIN_PAIR_GAP = 0.04;
const CELL = 2;

/** The segments of shapes: each side of a polyline or polygon; a thin closed rectangle becomes one segment along its length with its width as the thickness. */
export function segmentsOf(shapes: Shape[], defaultThickness: number, scale: number): Seg[] {
  const out: Seg[] = [];
  for (const s of shapes) {
    const pts = s.pts.map(([x, y]) => [x * scale, y * scale] as P);
    if (s.closed && pts.length >= 3 && pts.length <= 6) {
      const r = fitRect(pts, 0.01);
      const lo = Math.min(r.w, r.h),
        hi = Math.max(r.w, r.h);
      if (lo <= MAX_PAIR_GAP && hi >= 2 * lo && lo >= 0.03) {
        const along = r.w >= r.h ? r.rot : r.rot + Math.PI / 2;
        const c = Math.cos(along),
          sn = Math.sin(along);
        out.push({
          a: [r.cx - (c * hi) / 2, r.cy - (sn * hi) / 2],
          b: [r.cx + (c * hi) / 2, r.cy + (sn * hi) / 2],
          t: Math.max(lo, 0.05),
        });
        continue;
      }
    }
    const n = s.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= MIN_SEG) out.push({ a, b, t: defaultThickness });
    }
  }
  return out;
}

/** Cells (of CELL metres) a segment passes through. */
function cellsOf(s: Seg): string[] {
  const n = Math.max(1, Math.ceil(len(s) / (CELL / 2)));
  const seen = new Set<string>();
  for (let i = 0; i <= n; i++) {
    const x = s.a[0] + ((s.b[0] - s.a[0]) * i) / n,
      y = s.a[1] + ((s.b[1] - s.a[1]) * i) / n;
    seen.add(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`);
  }
  return [...seen];
}

interface Pair {
  center: Seg;
  rest: Seg[];
}
/** The wall two parallel segments make, over the stretch where both exist, and what is left of each outside it. */
function pairUp(i: Seg, j: Seg): Pair | null {
  const d = dirOf(i);
  const dj = dirOf(j);
  const cosA = Math.abs(d[0] * dj[0] + d[1] * dj[1]);
  if (cosA < 0.9995) return null; // not parallel enough (about 1.8 degrees)
  const n: P = [-d[1], d[0]];
  const off = (p: P) => (p[0] - i.a[0]) * n[0] + (p[1] - i.a[1]) * n[1];
  const along = (p: P) => (p[0] - i.a[0]) * d[0] + (p[1] - i.a[1]) * d[1];
  const gap = (off(j.a) + off(j.b)) / 2;
  const g = Math.abs(gap);
  if (g < MIN_PAIR_GAP || g > MAX_PAIR_GAP || Math.abs(off(j.a) - off(j.b)) > 0.05) return null;
  const li = len(i);
  const [j0, j1] = [along(j.a), along(j.b)].sort((a, b) => a - b);
  const lo = Math.max(0, j0),
    hi = Math.min(li, j1);
  const overlap = hi - lo;
  if (overlap < Math.min(li, j1 - j0) * 0.6 || overlap < 0.2) return null;
  const mid = gap / 2;
  const at = (s: number, o: number): P => [i.a[0] + d[0] * s + n[0] * o, i.a[1] + d[1] * s + n[1] * o];
  const rest: Seg[] = [];
  const piece = (from: number, to: number, o: number, t: number) => {
    if (to - from >= MIN_SEG) rest.push({ a: at(from, o), b: at(to, o), t });
  };
  piece(0, lo, 0, i.t);
  piece(hi, li, 0, i.t);
  piece(j0, lo, gap, j.t); // j's own ends beyond the shared stretch (when it is the longer one)
  piece(hi, j1, gap, j.t);
  return { center: { a: at(lo, mid), b: at(hi, mid), t: g }, rest };
}

/** Pairs the double lines of walls. Several rounds, because what is left of a long face after one pairing can pair with the next piece of the opposite face. */
export function pairFaces(input: Seg[]): Seg[] {
  let work = input;
  const done: Seg[] = [];
  for (let round = 0; round < 5 && work.length; round++) {
    const order = work.map((_, k) => k).sort((a, b) => len(work[b]) - len(work[a]));
    const grid = new Map<string, number[]>();
    work.forEach((s, k) => {
      for (const c of cellsOf(s)) {
        const l = grid.get(c);
        if (l) l.push(k);
        else grid.set(c, [k]);
      }
    });
    const used = new Uint8Array(work.length);
    const next: Seg[] = [];
    for (const k of order) {
      if (used[k]) continue;
      const s = work[k];
      if (len(s) < 0.3) continue;
      const cand = new Set<number>();
      for (const c of cellsOf(s)) {
        const [cx, cy] = c.split(',').map(Number);
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++) for (const q of grid.get(`${cx + dx},${cy + dy}`) ?? []) cand.add(q);
      }
      let best: { q: number; pair: Pair; score: number } | null = null;
      for (const q of cand) {
        if (q === k || used[q]) continue;
        const pair = pairUp(s, work[q]);
        if (!pair) continue;
        const score = len(pair.center);
        if (!best || score > best.score) best = { q, pair, score };
      }
      if (!best) continue;
      used[k] = used[best.q] = 1;
      done.push(best.pair.center);
      next.push(...best.pair.rest);
    }
    work.forEach((s, k) => {
      if (!used[k]) done.push(s);
    });
    work = next;
  }
  return [...done, ...work];
}

const key = (p: P) => `${Math.round(p[0] * 50)},${Math.round(p[1] * 50)}`; // 2 cm

/** Joins segments that meet end to end (and are about as thick) into polylines, and drops points that lie on a straight line. */
export function chain(segs: Seg[], kind: BuiltLine['kind'], height: number): BuiltLine[] {
  const ends = new Map<string, number[]>();
  segs.forEach((s, k) => {
    for (const p of [s.a, s.b]) {
      const id = key(p);
      const l = ends.get(id);
      if (l) l.push(k);
      else ends.set(id, [k]);
    }
  });
  const used = new Uint8Array(segs.length);
  const lines: BuiltLine[] = [];
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue;
    used[k] = 1;
    const s = segs[k];
    const pts: P[] = [s.a, s.b];
    for (const atEnd of [true, false]) {
      for (;;) {
        const tip = atEnd ? pts[pts.length - 1] : pts[0];
        const here = ends.get(key(tip)) ?? [];
        if (here.length !== 2) break; // a junction or a free end: the line stops here
        const n = here.find((c) => !used[c]);
        if (n === undefined || Math.abs(segs[n].t - s.t) > 0.03) break;
        used[n] = 1;
        const far = key(segs[n].a) === key(tip) ? segs[n].b : segs[n].a;
        if (atEnd) pts.push(far);
        else pts.unshift(far);
      }
    }
    lines.push({ kind, points: straighten(pts), thickness: Math.round(s.t * 100) / 100, height });
  }
  return lines;
}

/** Removes points that sit on a straight run (within a degree and a centimetre). */
export function straighten(pts: P[]): P[] {
  if (pts.length < 3) return pts;
  const out: P[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1],
      b = pts[i],
      c = pts[i + 1];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    const dot = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]);
    if (Math.abs(cr) / l > 0.01 || dot < 0) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
