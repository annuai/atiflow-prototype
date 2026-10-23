import type { SiteLayout } from '@/core/types';
import { cellCenter, cellCorners, cellHeading, cellRef, colLetter, outline, stationPoint } from '../model/staging';
import type { MapData } from '../model/types';
import { newGate, polygonOf, rectFromCorners } from '../model/shape';
import { zoneType } from '../model/zoneTypes';
import { drawMode, type Tool } from './tools';
import type { useViewport } from './useViewport';

export type P = [number, number];
type Vp = Pick<ReturnType<typeof useViewport>, 'P' | 'X' | 'Y'>;

/** The paths of the real floor (walls, machines, floor, a 10 m grid) as SVG path text in the map's coordinates. */
export function floorPaths(site: SiteLayout, P: Vp['P']) {
  const { minX, maxX, minY, maxY } = site.bounds;
  const grid: string[] = [];
  for (let x = Math.ceil(minX / 10) * 10; x <= maxX; x += 10) grid.push(`M${P(x, minY)}L${P(x, maxY)}`);
  for (let y = Math.ceil(minY / 10) * 10; y <= maxY; y += 10) grid.push(`M${P(minX, y)}L${P(maxX, y)}`);
  return {
    walls: site.walls.map((w) => `M${P(w.a[0], w.a[1])}L${P(w.b[0], w.b[1])}`).join(''),
    machines: site.equipment
      .map((e) => {
        const x = e.x - e.w / 2,
          y = e.y - e.d / 2;
        return `M${P(x, y)}L${P(x + e.w, y)}L${P(x + e.w, y + e.d)}L${P(x, y + e.d)}Z`;
      })
      .join(''),
    floor: site.floorPolygons.map((p) => 'M' + p.map(([x, y]) => P(x, y)).join('L') + 'Z').join(''),
    grid: grid.join(''),
  };
}

/** Every staging area as the path of its cells, its stations (a ring and a chevron each), its labels and direction arrow. */
export function stagingGeometry(areas: MapData['stagingAreas'], vp: Pick<Vp, 'X' | 'Y' | 'P'>, u = 1) {
  return areas.map((a) => {
    const cells: string[] = [];
    const stations: string[] = [];
    const letters: { x: number; y: number; text: string; col: number }[] = [];
    const numbers: { x: number; y: number; text: string; row: number }[] = [];
    const cellPaths: Record<string, string> = {};
    const px = Math.abs(vp.X(1) - vp.X(0)); // pixels per metre
    const ring = Math.min(Math.max(12 * u, Math.min(0.3, a.cellWidth / 4) * px), a.cellWidth * px * 0.45);
    const t = (a.rotation * Math.PI) / 180,
      dx = Math.cos(t),
      dy = Math.sin(t),
      rx = Math.sin(t),
      ry = -Math.cos(t);
    for (let r = 1; r <= a.rows; r++)
      for (let c = 1; c <= a.cols; c++) {
        const path =
          'M' +
          cellCorners(a, r, c)
            .map(([x, y]) => vp.P(x, y))
            .join('L') +
          'Z';
        cells.push(path);
        cellPaths[cellRef(r, c)] = path;
        const s = stationPoint(a, r, c),
          X = vp.X(s.x),
          Y = vp.Y(s.y),
          h = -s.heading, // the screen's y points down
          fx = Math.cos(h) * ring * 0.55,
          fy = Math.sin(h) * ring * 0.55,
          gx = -fy,
          gy = fx;
        stations.push(
          `M${X - ring},${Y}a${ring},${ring} 0 1 0 ${2 * ring},0a${ring},${ring} 0 1 0 ${-2 * ring},0`,
          `M${X - fx + gx},${Y - fy + gy}L${X + fx},${Y + fy}L${X - fx - gx},${Y - fy - gy}`,
        );
      }
    for (let c = 1; c <= a.cols; c++) {
      const m = cellCenter(a, 1, c);
      letters.push({
        x: vp.X(m.x + (a.cellWidth / 2 + Math.max(0.3, 18 * u)) * -rx),
        y: vp.Y(m.y + (a.cellWidth / 2 + Math.max(0.3, 18 * u)) * -ry),
        text: colLetter(c),
        col: c,
      });
    }
    for (let r = 1; r <= a.rows; r++) {
      const m = cellCenter(a, r, 1);
      numbers.push({
        x: vp.X(m.x - (a.cellLength / 2 + Math.max(0.3, 18 * u)) * dx),
        y: vp.Y(m.y - (a.cellLength / 2 + Math.max(0.3, 18 * u)) * dy),
        text: String(r),
        row: r,
      });
    }
    const mid = cellCenter(a, (a.rows + 1) / 2, (a.cols + 1) / 2);
    const hd = cellHeading(a);
    const len = Math.max(0.6, Math.min(a.cellLength, a.cellWidth) * 0.9);
    const tail = { x: mid.x - (Math.cos(hd) * len) / 2, y: mid.y - (Math.sin(hd) * len) / 2 };
    const tip = { x: mid.x + (Math.cos(hd) * len) / 2, y: mid.y + (Math.sin(hd) * len) / 2 };
    return {
      a,
      u,
      cells: cells.join(''),
      cellPaths,
      stations: stations.join(''),
      letters,
      numbers,
      arrow: { tail: [vp.X(tail.x), vp.Y(tail.y)] as P, tip: [vp.X(tip.x), vp.Y(tip.y)] as P },
      outline: outline(a)
        .map(([x, y]) => pt(vp, x, y))
        .join(' '),
    };
  });
}
/** "x,y" in the map's coordinates, as SVG polylines want it. */
export const pt = (vp: Pick<Vp, 'X' | 'Y'>, x: number, y: number) => `${vp.X(x).toFixed(2)},${vp.Y(y).toFixed(2)}`;
export const polyPoints = (vp: Pick<Vp, 'X' | 'Y'>, pts: P[]) => pts.map(([x, y]) => pt(vp, x, y)).join(' ');

/** The shape being drawn: what the points so far and the cursor make (null when nothing is being drawn). */
export function drawingPreview(
  tool: Tool,
  drawing: P[],
  cursor: P | null,
): { kind: 'line' | 'polygon'; pts: P[]; color: string } | null {
  const mode = drawMode(tool);
  if (mode === 'none' || mode === 'one' || !drawing.length) return null;
  const live = cursor ? [...drawing, cursor] : drawing;
  if (tool.kind === 'road') return { kind: 'line', pts: live, color: '#0d9488' };
  if (tool.kind === 'gate' || tool.kind === 'zone') {
    if (!cursor) return null;
    const line = tool.kind === 'gate' && tool.shape === 'line';
    return {
      kind: 'polygon',
      pts: polygonOf(line ? newGate(drawing[0], cursor) : rectFromCorners(drawing[0], cursor)),
      color: zoneType(tool.kind === 'gate' ? 'exclusive' : tool.type).color,
    };
  }
  if (tool.kind === 'structure') {
    const w = tool.what;
    if (w === 'wall' || w === 'partition') return { kind: 'line', pts: live, color: '#0d9488' };
    if (w === 'work') return { kind: 'polygon', pts: live, color: '#0d9488' };
    if (cursor && (w === 'machine' || w === 'pillar' || w === 'room' || w === 'erase')) {
      const [a, b] = [drawing[0], cursor];
      return {
        kind: 'polygon',
        pts: [a, [b[0], a[1]], b, [a[0], b[1]]],
        color: w === 'erase' ? '#dc2626' : '#0d9488',
      };
    }
  }
  return null;
}
