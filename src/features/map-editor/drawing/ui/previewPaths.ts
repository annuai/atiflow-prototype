import type { Built, P } from '../core/types';

/** What the drawing will make, as SVG paths in the drawing's own frame (metres, y up: the canvas turns them onto the map with one matrix, so dragging never redraws them). */
export interface PreviewPaths {
  walls: string;
  partitions: string;
  machines: string;
  pillars: string;
  doors: string;
  areas: string;
  /** points a click can snap to (line ends, box corners and centres) */
  keys: P[];
}
const f = (v: number) => (Math.round(v * 100) / 100).toString();
const corners = (b: { x: number; y: number; w: number; d: number; rot: number }): P[] => {
  const c = Math.cos(b.rot),
    s = Math.sin(b.rot);
  return (
    [
      [-b.w / 2, -b.d / 2],
      [b.w / 2, -b.d / 2],
      [b.w / 2, b.d / 2],
      [-b.w / 2, b.d / 2],
    ] as P[]
  ).map(([x, y]) => [b.x + x * c - y * s, b.y + x * s + y * c] as P);
};
const poly = (pts: P[], close: boolean) => `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}${close ? 'Z' : ''}`;

export function previewPaths(b: Built): PreviewPaths {
  const keys: P[] = [];
  const line = (kind: 'wall' | 'partition') =>
    b.lines
      .filter((l) => l.kind === kind)
      .map((l) => {
        keys.push(l.points[0], l.points[l.points.length - 1]);
        return poly(l.points, false);
      })
      .join('');
  const box = (kind: 'machine' | 'pillar') =>
    b.boxes
      .filter((x) => x.kind === kind)
      .map((x) => {
        const c = corners(x);
        keys.push(...c, [x.x, x.y]);
        return poly(c, true);
      })
      .join('');
  return {
    walls: line('wall'),
    partitions: line('partition'),
    machines: box('machine'),
    pillars: box('pillar'),
    doors: b.doors
      .map((d) => {
        const c = Math.cos(d.rot),
          s = Math.sin(d.rot);
        return poly(
          [
            [d.x - (c * d.w) / 2, d.y - (s * d.w) / 2],
            [d.x + (c * d.w) / 2, d.y + (s * d.w) / 2],
          ],
          false,
        );
      })
      .join(''),
    areas: b.areas.map((a) => poly(a.points, true)).join(''),
    keys: keys.length > 30000 ? keys.filter((_, i) => i % Math.ceil(keys.length / 30000) === 0) : keys,
  };
}
