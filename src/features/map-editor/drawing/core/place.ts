import { applyPoint, type Similarity } from '@/core/similarity';
import type { Built, P } from './types';

/** A rectangle on the map, metres. */
export interface Area {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
const inside = (a: Area, [x, y]: P) => x >= a.minX && x <= a.maxX && y >= a.minY && y <= a.maxY;

/**
 * Puts what the rules made onto the map: the drawing (already in metres) is scaled, turned and moved by `t`. With `only`, what lies outside that area is left out: a plant drawing often holds
 * several buildings, and a map covers one of them.
 */
export function placeBuilt(b: Built, t: Similarity, only?: Area | null): Built {
  const notes = { ...b.notes };
  const pt = (p: P) => applyPoint(t, p);
  const keep = (ps: P[]) => !only || ps.some((p) => inside(only, p));
  const lines = b.lines
    .map((l) => ({ ...l, points: l.points.map(pt), thickness: Math.round(l.thickness * t.scale * 100) / 100 }))
    .filter((l) => keep(l.points));
  const boxes = b.boxes
    .map((x) => {
      const [px, py] = pt([x.x, x.y]);
      return { ...x, x: px, y: py, w: x.w * t.scale, d: x.d * t.scale, rot: x.rot + t.rot };
    })
    .filter((x) => keep([[x.x, x.y]]));
  const doors = b.doors
    .map((x) => {
      const [px, py] = pt([x.x, x.y]);
      return { ...x, x: px, y: py, w: x.w * t.scale, rot: x.rot + t.rot };
    })
    .filter((x) => keep([[x.x, x.y]]));
  const areas = b.areas.map((a) => ({ ...a, points: a.points.map(pt) })).filter((a) => keep(a.points));
  const dropped =
    b.lines.length +
    b.boxes.length +
    b.doors.length +
    b.areas.length -
    (lines.length + boxes.length + doors.length + areas.length);
  if (dropped > 0) notes.outside = dropped;
  const g = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const grow = ([x, y]: P) => {
    g.minX = Math.min(g.minX, x);
    g.maxX = Math.max(g.maxX, x);
    g.minY = Math.min(g.minY, y);
    g.maxY = Math.max(g.maxY, y);
  };
  lines.forEach((l) => l.points.forEach(grow));
  boxes.forEach((x) => grow([x.x, x.y]));
  areas.forEach((a) => a.points.forEach(grow));
  return { lines, boxes, doors, areas, bounds: g.minX <= g.maxX ? g : null, notes };
}
