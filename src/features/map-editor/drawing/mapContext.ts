import type { Equipment, Wall } from '@/core/types';
import { structureSite } from '../model/structure/derive';
import { modelOf } from '../model/structure/ops';
import type { MapData } from '../model/types';
import type { Area } from './core/place';

type P = [number, number];
/** What the map already holds, for laying a drawing over it: its walls and machines (the elements and the scan), its roads and stations, and the box round all of it. */
export interface MapContext {
  walls: Wall[];
  equipment: Equipment[];
  lanes: P[][];
  stations: P[];
  extent: Area | null;
}

export function mapContext(data: MapData, ignoreTag?: string): MapContext {
  const base: MapData = ignoreTag
    ? {
        ...data,
        model3d: { ...modelOf(data), elements: modelOf(data).elements.filter((e) => e.fromDrawing !== ignoreTag) },
      }
    : data;
  // what a person sees on the map: the scan that has not been replaced, and the elements
  const m = modelOf(base);
  const hw = new Set(m.hiddenWalls),
    he = new Set(m.hiddenEquipment);
  const mine = structureSite({ ...base, structure: undefined });
  const walls: Wall[] = [...(base.structure?.walls ?? []).filter((_, i) => !hw.has(i)), ...mine.walls];
  const equipment: Equipment[] = [...(base.structure?.equipment ?? []).filter((_, i) => !he.has(i)), ...mine.equipment];
  const lanes = base.lanes.map((l) => l.geom as P[]);
  const byNode = new Map(base.nodes.map((n) => [n.id, n]));
  const stations = base.stations
    .filter((s) => !s.unplaced)
    .map((s) => byNode.get(s.nodeId))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((n) => [n.x, n.y] as P);
  const g = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const grow = ([x, y]: P) => {
    g.minX = Math.min(g.minX, x);
    g.maxX = Math.max(g.maxX, x);
    g.minY = Math.min(g.minY, y);
    g.maxY = Math.max(g.maxY, y);
  };
  for (const w of walls) {
    grow(w.a);
    grow(w.b);
  }
  for (const e of equipment) grow([e.x, e.y]);
  for (const l of lanes) l.forEach(grow);
  stations.forEach(grow);
  for (const a of base.stagingAreas) grow([a.x, a.y]);
  return { walls, equipment, lanes, stations, extent: g.minX <= g.maxX ? g : null };
}

/** An area grown by `m` metres on every side. */
export const grown = (a: Area, m: number): Area => ({
  minX: a.minX - m,
  minY: a.minY - m,
  maxX: a.maxX + m,
  maxY: a.maxY + m,
});
