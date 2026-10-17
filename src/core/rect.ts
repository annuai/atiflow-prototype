type P = [number, number];
const round = (v: number) => Math.round(v * 100) / 100;
export const MIN_SIZE = 0.5;
/** A rotated rectangle: centre, size along its own x (`w`) and y (`h`), `rot` in radians (0 = +x, counter-clockwise). Metres, site frame. */
export interface Rect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rot: number;
}
const turn = (x: number, y: number, a: number): P => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
/** The four corners of a rectangle, counter-clockwise from its (-w/2, -h/2) corner. */
export function rectCorners(r: Rect): P[] {
  return (
    [
      [-r.w / 2, -r.h / 2],
      [r.w / 2, -r.h / 2],
      [r.w / 2, r.h / 2],
      [-r.w / 2, r.h / 2],
    ] as P[]
  ).map(([x, y]) => {
    const [px, py] = turn(x, y, r.rot);
    return [round(r.cx + px), round(r.cy + py)] as P;
  });
}
const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function hull(pts: P[]): P[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lo: P[] = [],
    up: P[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (const q of [...p].reverse()) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
/** The smallest rotated rectangle that covers a polygon (never smaller than it): an edge of the convex hull always lies along one side of it. */
export function fitRect(poly: P[]): Rect {
  const h = hull(poly);
  if (h.length < 3) {
    const [x, y] = h[0] ?? [0, 0];
    return { cx: x, cy: y, w: MIN_SIZE, h: MIN_SIZE, rot: 0 };
  }
  let best: { area: number; a: number; minX: number; maxX: number; minY: number; maxY: number } | null = null;
  for (let i = 0; i < h.length; i++) {
    const p = h[i],
      q = h[(i + 1) % h.length];
    const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const [x, y] of h) {
      const [lx, ly] = turn(x, y, -a);
      minX = Math.min(minX, lx);
      maxX = Math.max(maxX, lx);
      minY = Math.min(minY, ly);
      maxY = Math.max(maxY, ly);
    }
    const area = (maxX - minX) * (maxY - minY);
    if (!best || area < best.area - 1e-9) best = { area, a, minX, maxX, minY, maxY };
  }
  const b = best!;
  const [cx, cy] = turn((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, b.a);
  return {
    cx: round(cx),
    cy: round(cy),
    w: Math.max(MIN_SIZE, round(b.maxX - b.minX)),
    h: Math.max(MIN_SIZE, round(b.maxY - b.minY)),
    rot: b.a,
  };
}
