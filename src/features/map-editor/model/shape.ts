import { fitRect as fit, MIN_SIZE } from '@/core/rect';
import type { ZoneShape } from './types';

type P = [number, number];
const round = (v: number) => Math.round(v * 100) / 100;
export { MIN_SIZE };
export const DEFAULT_DEPTH = 3;
export const DEFAULT_GATE_LENGTH = 4;

/** Where a handle sits on a rectangle: -1 / 0 / +1 along its own x and y (so `[1, 1]` is the corner at +x +y, `[1, 0]` the middle of the +x edge). */
export type Handle = [-1 | 0 | 1, -1 | 0 | 1];
export const HANDLES: Handle[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];
type Rect = Extract<ZoneShape, { kind: 'rect' }>;
type Gate = Extract<ZoneShape, { kind: 'gate' }>;

const rot = (x: number, y: number, a: number): P => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
/** A point in the rectangle's own frame -> the site frame. */
export const toWorld = (r: Rect, lx: number, ly: number): P => {
  const [x, y] = rot(lx, ly, r.rot);
  return [r.cx + x, r.cy + y];
};
/** A site point in the rectangle's own frame. */
export const toLocal = (r: Rect, x: number, y: number): P => rot(x - r.cx, y - r.cy, -r.rot);

/** The unit normal of a gate towards the side it applies to (the side robots come from). */
export const gateNormal = (g: Gate): P => {
  const dx = g.b[0] - g.a[0],
    dy = g.b[1] - g.a[1],
    l = Math.hypot(dx, dy) || 1;
  return [(-dy / l) * g.side, (dx / l) * g.side];
};
export const gateLength = (g: Gate) => Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
/** The rectangle a gate controls: the line grown `depth` metres to its controlled side. */
export function gateRect(g: Gate): Rect {
  const n = gateNormal(g),
    len = gateLength(g);
  const mx = (g.a[0] + g.b[0]) / 2 + (n[0] * g.depth) / 2,
    my = (g.a[1] + g.b[1]) / 2 + (n[1] * g.depth) / 2;
  const r = Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0]);
  // local x runs along a -> b; local y is the left normal, so a negative side flips the extent
  return { kind: 'rect', cx: mx, cy: my, w: len, h: g.depth, rot: g.side > 0 ? r : r + Math.PI };
}

/** The outline (metres, site frame) of a shape: what the simulator, the floor, thumbnails and the audit read. */
export function polygonOf(s: ZoneShape): P[] {
  const r = s.kind === 'rect' ? s : gateRect(s);
  return (
    [
      [-r.w / 2, -r.h / 2],
      [r.w / 2, -r.h / 2],
      [r.w / 2, r.h / 2],
      [-r.w / 2, r.h / 2],
    ] as P[]
  ).map(([x, y]) => {
    const [px, py] = toWorld(r, x, y);
    return [round(px), round(py)] as P;
  });
}

/** An old thin line gate (a long, narrow polygon) as a directional gate: the line is its centre line, the area goes DEFAULT_DEPTH metres to one side. */
/** The smallest rotated rectangle covering a polygon (never smaller than it). */
export const fitRect = (poly: P[]): Rect => ({ kind: 'rect', ...fit(poly) });
export function gateFromThin(poly: P[]): Gate {
  const r = fitRect(poly);
  const long = r.w >= r.h;
  const a = long ? r.rot : r.rot + Math.PI / 2,
    len = long ? r.w : r.h;
  const [dx, dy] = [Math.cos(a) * (len / 2), Math.sin(a) * (len / 2)];
  return {
    kind: 'gate',
    a: [round(r.cx - dx), round(r.cy - dy)],
    b: [round(r.cx + dx), round(r.cy + dy)],
    depth: DEFAULT_DEPTH,
    side: 1,
  };
}
/** The rectangle with the two points as opposite corners (axis aligned). */
export function rectFromCorners(a: P, b: P): Rect {
  return {
    kind: 'rect',
    cx: round((a[0] + b[0]) / 2),
    cy: round((a[1] + b[1]) / 2),
    w: Math.max(MIN_SIZE, round(Math.abs(b[0] - a[0]))),
    h: Math.max(MIN_SIZE, round(Math.abs(b[1] - a[1]))),
    rot: 0,
  };
}
/** A gate drawn from a to b: the controlled side starts on the left of the line. */
export const newGate = (a: P, b: P): Gate => ({
  kind: 'gate',
  a: [round(a[0]), round(a[1])],
  b: [round(b[0]), round(b[1])],
  depth: DEFAULT_DEPTH,
  side: 1,
});

/**
 * Drag a handle of a rectangle to a site point: the opposite corner (or edge) stays where it is, the rest follows the pointer. `keepAspect` (corners) keeps width : height.
 */
export function resizeRect(r: Rect, handle: Handle, to: P, keepAspect = false): Rect {
  const [sx, sy] = handle;
  const [px, py] = toLocal(r, to[0], to[1]);
  let w = r.w,
    h = r.h,
    ox = 0,
    oy = 0; // offset of the new centre in the old local frame
  if (sx) {
    const fixed = (-sx * r.w) / 2;
    w = Math.max(MIN_SIZE, (px - fixed) * sx);
    ox = fixed + (sx * w) / 2;
  }
  if (sy) {
    const fixed = (-sy * r.h) / 2;
    h = Math.max(MIN_SIZE, (py - fixed) * sy);
    oy = fixed + (sy * h) / 2;
  }
  if (keepAspect && sx && sy) {
    const k = Math.max(w / r.w, h / r.h);
    w = Math.max(MIN_SIZE, r.w * k);
    h = Math.max(MIN_SIZE, r.h * k);
    ox = (-sx * r.w) / 2 + (sx * w) / 2;
    oy = (-sy * r.h) / 2 + (sy * h) / 2;
  }
  const [cx, cy] = toWorld(r, ox, oy);
  return { ...r, cx: round(cx), cy: round(cy), w: round(w), h: round(h) };
}
/** Turn a rectangle so its +y axis points at a site point (the rotate handle sits above the top edge); `snap` rounds to 15 degrees. */
export function rotateRectTo(r: Rect, to: P, snap = false): Rect {
  let a = Math.atan2(to[1] - r.cy, to[0] - r.cx) - Math.PI / 2;
  if (snap) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
  return { ...r, rot: a };
}
export const moveShape = (s: ZoneShape, dx: number, dy: number): ZoneShape =>
  s.kind === 'rect'
    ? { ...s, cx: round(s.cx + dx), cy: round(s.cy + dy) }
    : { ...s, a: [round(s.a[0] + dx), round(s.a[1] + dy)], b: [round(s.b[0] + dx), round(s.b[1] + dy)] };
export const flipGate = (g: Gate): Gate => ({ ...g, side: g.side === 1 ? -1 : 1 });
export const centreOf = (s: ZoneShape): P =>
  s.kind === 'rect' ? [s.cx, s.cy] : [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
export const degrees = (rad: number) => round(((((rad * 180) / Math.PI) % 360) + 360) % 360);
export const radians = (deg: number) => (deg * Math.PI) / 180;
/** Where the rotate handle is: `stick` metres beyond the middle of the top (+y) edge. */
export const rotateHandleAt = (r: Rect, stick: number): P => toWorld(r, 0, r.h / 2 + stick);
