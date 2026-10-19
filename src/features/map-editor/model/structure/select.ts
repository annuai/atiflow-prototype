import type { MapData, Selection } from '../types';
import { modelOf } from './ops';
import type { BoxElement, P, StructureElement } from './types';

type Rect = { x0: number; y0: number; x1: number; y1: number };
const norm = (a: P, b: P): Rect => ({
  x0: Math.min(a[0], b[0]),
  y0: Math.min(a[1], b[1]),
  x1: Math.max(a[0], b[0]),
  y1: Math.max(a[1], b[1]),
});
const inside = (p: P, r: Rect) => p[0] >= r.x0 && p[0] <= r.x1 && p[1] >= r.y0 && p[1] <= r.y1;

/** Does the segment a-b touch the rectangle? (Liang-Barsky clipping.) */
function segmentHits(a: P, b: P, r: Rect): boolean {
  let t0 = 0,
    t1 = 1;
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  for (const [p, q] of [
    [-dx, a[0] - r.x0],
    [dx, r.x1 - a[0]],
    [-dy, a[1] - r.y0],
    [dy, r.y1 - a[1]],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}

const corners = (x: number, y: number, w: number, d: number, rot: number): P[] => {
  const c = Math.cos(rot),
    s = Math.sin(rot);
  return (
    [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ] as P[]
  ).map(([lx, ly]) => [x + lx * c - ly * s, y + lx * s + ly * c]);
};
const bbox = (pts: P[]): Rect => ({
  x0: Math.min(...pts.map((p) => p[0])),
  y0: Math.min(...pts.map((p) => p[1])),
  x1: Math.max(...pts.map((p) => p[0])),
  y1: Math.max(...pts.map((p) => p[1])),
});
const overlap = (a: Rect, b: Rect) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;

function touches(e: StructureElement, r: Rect): boolean {
  if (e.kind === 'wall' || e.kind === 'partition') {
    if (e.points.some((p) => inside(p, r))) return true;
    return e.points.some((p, i) => i > 0 && segmentHits(e.points[i - 1], p, r));
  }
  if (e.kind === 'area') {
    const b = bbox(e.points);
    // a Work area is a big floor patch under everything: it only counts when the box encloses all of it
    return e.work ? b.x0 >= r.x0 && b.x1 <= r.x1 && b.y0 >= r.y0 && b.y1 <= r.y1 : overlap(b, r);
  }
  if (e.kind === 'door') return overlap(bbox(corners(e.x, e.y, e.w, 0.2, e.rot)), r);
  const b = e as BoxElement;
  return overlap(bbox(corners(b.x, b.y, b.w, b.d, b.rot)), r);
}

/** The elements a box dragged on the map touches (a Work area only when the box holds all of it). */
export const elementsInRect = (data: MapData, a: P, b: P): string[] => {
  const r = norm(a, b);
  return modelOf(data)
    .elements.filter((e) => touches(e, r))
    .map((e) => e.id);
};

const idsOf = (cur: Selection): string[] => (cur?.kind === 'element' ? (cur.ids ?? [cur.id]) : []);
const asSelection = (ids: string[]): Selection =>
  ids.length ? { kind: 'element', id: ids[ids.length - 1], ids } : null;

/** A click on an element: it becomes the selection; with `additive` (Select multiple, or Shift) it is added to the selection, or taken out of it when it is in it already. */
export function pickElement(cur: Selection, id: string, additive: boolean): Selection {
  if (!additive) return { kind: 'element', id, ids: [id] };
  const had = idsOf(cur);
  return asSelection(had.includes(id) ? had.filter((x) => x !== id) : [...had, id]);
}

/** These elements become the selection (or are added to it). */
export function selectIds(cur: Selection, ids: string[], additive: boolean): Selection {
  if (!additive) return asSelection(ids);
  const had = idsOf(cur);
  return asSelection([...had, ...ids.filter((id) => !had.includes(id))]);
}

/** A box dragged on the map: the elements in it become the selection (or are added to it). */
export const boxElements = (data: MapData, cur: Selection, a: P, b: P, additive: boolean): Selection =>
  selectIds(cur, elementsInRect(data, a, b), additive);
