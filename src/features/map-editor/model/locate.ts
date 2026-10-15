import { outline } from './staging';
import { nodeOf } from './stations';
import type { MapData, Selection } from './types';

/** Where a thing is on the map: its centre and how wide it is (metres), so the view can zoom to fit it. Null when it is not in this version. */
export function locateTarget(data: MapData, sel: NonNullable<Selection>): { x: number; y: number; span: number } | null {
  const box = (pts: [number, number][]) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, span: Math.max(x1 - x0, y1 - y0) }; };
  if (sel.kind === 'station') { const s = data.stations.find((q) => q.id === sel.id); const n = s && nodeOf(data, s); return n ? { x: n.x, y: n.y, span: 0 } : null; }
  if (sel.kind === 'staging') { const a = data.stagingAreas.find((q) => q.id === sel.id); return a ? box(outline(a)) : null; }
  if (sel.kind === 'road') { const r = data.roads.find((q) => q.id === sel.id); return r && r.points.length ? box(r.points) : null; }
  const z = data.zones.find((q) => q.id === sel.id); return z && z.polygon.length ? box(z.polygon) : null;
}
