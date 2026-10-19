import type { MapData } from '../types';
import { modelOf } from './ops';
import { structureSite } from './derive';
import type { P } from './types';

/**
 * Routes and stations against the solid elements of the structure: a robot cannot drive through a wall, a partition, a machine or a block. Only things a robot would hit count (they start
 * below `ROBOT_HEIGHT`: an overhead pipe is fine), openings of doors are already cut out of the walls. Elements traced from the lidar estimate are rough, so those are warnings.
 */
export const ROBOT_HEIGHT = 1.8;
export const ROBOT_HALF_WIDTH = 0.45;

export interface Hit {
  elementId: string;
  /** what hits it */
  by: { kind: 'road'; id: string } | { kind: 'station'; id: string };
  traced: boolean;
}

const segSegDist = (a: P, b: P, c: P, d: P): number => {
  const inter = (p: P, q: P, r: P, s: P) => {
    const o = (x: P, y: P, z: P) => (y[0] - x[0]) * (z[1] - x[1]) - (y[1] - x[1]) * (z[0] - x[0]);
    return o(p, q, r) * o(p, q, s) < 0 && o(r, s, p) * o(r, s, q) < 0;
  };
  if (inter(a, b, c, d)) return 0;
  const pt = (p: P, s: P, e: P) => {
    const dx = e[0] - s[0],
      dy = e[1] - s[1],
      l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - (s[0] + t * dx), p[1] - (s[1] + t * dy));
  };
  return Math.min(pt(a, c, d), pt(b, c, d), pt(c, a, b), pt(d, a, b));
};
/** Is the point inside the rotated rectangle grown by `m`? */
const inBox = (p: P, b: { x: number; y: number; w: number; d: number; rot: number }, m: number) => {
  const c = Math.cos(-b.rot),
    s = Math.sin(-b.rot);
  const lx = (p[0] - b.x) * c - (p[1] - b.y) * s,
    ly = (p[0] - b.x) * s + (p[1] - b.y) * c;
  return Math.abs(lx) <= b.w / 2 + m && Math.abs(ly) <= b.d / 2 + m;
};
const boxEdges = (b: { x: number; y: number; w: number; d: number; rot: number }): [P, P][] => {
  const c = Math.cos(b.rot),
    s = Math.sin(b.rot);
  const k = ([x, y]: P): P => [b.x + x * c - y * s, b.y + x * s + y * c];
  const q: P[] = [k([-b.w / 2, -b.d / 2]), k([b.w / 2, -b.d / 2]), k([b.w / 2, b.d / 2]), k([-b.w / 2, b.d / 2])];
  return q.map((p, i) => [p, q[(i + 1) % 4]]);
};

/** Every place a route or a station runs into a solid element. */
export function structureHits(data: MapData): Hit[] {
  const m = modelOf(data);
  if (!m.elements.length) return [];
  const traced = new Map(m.elements.map((e) => [e.id, !!e.traced]));
  // (only the elements: the estimate is not checked)
  const site = structureSite({ ...data, structure: undefined });
  const walls = site.walls.filter((w) => (w.base ?? 0) < ROBOT_HEIGHT && w.id);
  const boxes = site.equipment.filter((q) => (q.base ?? 0) < ROBOT_HEIGHT && q.id);
  const out: Hit[] = [];
  const seen = new Set<string>();
  const add = (elementId: string, by: Hit['by']) => {
    const k = `${elementId}|${by.kind}|${by.id}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ elementId, by, traced: traced.get(elementId) ?? false });
  };
  const roadOfLane = new Map(data.roads.flatMap((r) => r.laneIds.map((l) => [l, r.id] as const)));
  for (const lane of data.lanes) {
    const road = roadOfLane.get(lane.id) ?? lane.id;
    for (let i = 1; i < lane.geom.length; i++) {
      const a = lane.geom[i - 1],
        b = lane.geom[i];
      for (const w of walls)
        if (segSegDist(a, b, w.a, w.b) < ROBOT_HALF_WIDTH + w.t / 2) add(w.id!, { kind: 'road', id: road });
      for (const q of boxes) {
        const box = { x: q.x, y: q.y, w: q.w, d: q.d, rot: q.rot ?? 0 };
        if (
          inBox(a, box, ROBOT_HALF_WIDTH) ||
          inBox(b, box, ROBOT_HALF_WIDTH) ||
          boxEdges(box).some(([c, d]) => segSegDist(a, b, c, d) < ROBOT_HALF_WIDTH)
        )
          add(q.id!, { kind: 'road', id: road });
      }
    }
  }
  for (const s of data.stations) {
    const n = data.nodes.find((x) => x.id === s.nodeId);
    if (!n || s.unplaced) continue;
    const p: P = [n.x, n.y];
    for (const w of walls)
      if (segSegDist(p, p, w.a, w.b) < ROBOT_HALF_WIDTH + w.t / 2) add(w.id!, { kind: 'station', id: s.id });
    for (const q of boxes)
      if (inBox(p, { x: q.x, y: q.y, w: q.w, d: q.d, rot: q.rot ?? 0 }, ROBOT_HALF_WIDTH))
        add(q.id!, { kind: 'station', id: s.id });
  }
  return out;
}
