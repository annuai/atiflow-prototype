import type { SiteLayout } from '@/core/types';
import { cellCenter, outline } from '../model/staging';
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

/** Every staging area as the path of its cells and the points of its outline. */
export function stagingGeometry(areas: MapData['stagingAreas'], vp: Pick<Vp, 'X' | 'Y' | 'P'>) {
  return areas.map((a) => {
    const cells: string[] = [];
    const hl = a.cellLength / 2,
      hw = a.cellWidth / 2,
      t = (a.rotation * Math.PI) / 180,
      dx = Math.cos(t),
      dy = Math.sin(t),
      rx = Math.sin(t),
      ry = -Math.cos(t);
    for (let r = 1; r <= a.rows; r++)
      for (let c = 1; c <= a.cols; c++) {
        const m = cellCenter(a, r, c);
        const k = (sx: number, sy: number) =>
          vp.P(m.x + sx * hl * dx + sy * hw * rx, m.y + sx * hl * dy + sy * hw * ry);
        cells.push(`M${k(-1, -1)}L${k(1, -1)}L${k(1, 1)}L${k(-1, 1)}Z`);
      }
    return {
      a,
      cells: cells.join(''),
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
  return null;
}
