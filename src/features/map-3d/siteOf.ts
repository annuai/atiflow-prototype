import type { NavGraph, SiteLayout } from '@/core/types';
import type { MapData } from '@/features/map-editor';
import { layoutOf } from '@/features/map-import';

/**
 * The scene's site: the layout plus a floor (the DWG's floor polygons, or the rectangle around everything). `base` is the real site a built-in map stands on (its walls, machines and pillars come from the
 * drawing, not from a scan, so the map's own data does not hold them): it is the base under whatever was drawn on the map.
 */
export function siteOf(name: string, data: MapData, base?: SiteLayout): SiteLayout | null {
  const own = layoutOf(data, data.dwg ? 'dwg' : 'lidar'); // a map that already holds a DWG layer keeps drawing its walls
  if (!own && !base) return null;
  const l = {
    walls: [...(base?.walls ?? []), ...(own?.walls ?? [])],
    equipment: [...(base?.equipment ?? []), ...(own?.equipment ?? [])],
    floorPolygons: own?.floorPolygons.length ? own.floorPolygons : (base?.floorPolygons ?? []),
    shapes: own?.shapes,
    labels: own?.labels,
    zones: own?.zones,
  };
  const xs: number[] = [0],
    ys: number[] = [0];
  for (const w of l.walls) {
    xs.push(w.a[0], w.b[0]);
    ys.push(w.a[1], w.b[1]);
  }
  for (const e of l.equipment) {
    xs.push(e.x);
    ys.push(e.y);
  }
  for (const n of data.nodes) {
    xs.push(n.x);
    ys.push(n.y);
  }
  const m = 2;
  const bounds = {
    minX: Math.min(...xs) - m,
    maxX: Math.max(...xs) + m,
    minY: Math.min(...ys) - m,
    maxY: Math.max(...ys) + m,
  };
  const floor: [number, number][][] = l.floorPolygons.length
    ? l.floorPolygons
    : [
        [
          [bounds.minX, bounds.minY],
          [bounds.maxX, bounds.minY],
          [bounds.maxX, bounds.maxY],
          [bounds.minX, bounds.maxY],
        ],
      ];
  return {
    schema: 1,
    siteId: 'map-3d',
    name,
    units: 'm',
    bounds,
    floorPolygons: floor,
    walls: l.walls,
    pillars: base?.pillars ?? [],
    zones: l.zones ?? [], // Work areas: floor tints under everything (not picked in 3D)
    equipment: l.equipment,
    doors: [],
    labels: l.labels ?? [],
    shapes: l.shapes ?? [],
  };
}

/** The lane map of a map (what the Live Floor would drive on); stations that have no position yet are left out. */
export function navOf(data: MapData): NavGraph {
  const placed = new Set(data.stations.filter((s) => !s.unplaced).map((s) => s.nodeId));
  return {
    schema: 2,
    siteId: 'map-3d',
    nodes: data.nodes.filter((n) => n.kind !== 'station' || placed.has(n.id)),
    lanes: data.lanes,
    stations: data.stations.filter((s) => !s.unplaced),
    fleets: [{ id: '', name: '', color: '#14b8a6', areas: [] }],
    trafficZones: [],
    forbiddenZones: [],
  };
}
