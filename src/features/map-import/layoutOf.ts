import type { MapData } from '@/features/map-editor';
import { transformLayout, type Layout } from './core/dwg';

export type WallSource = 'lidar' | 'dwg';

/** The walls, machines and floor of a map for the 3D scene: the DWG laid over it when there is one (and it is chosen), else what was estimated from the lidar grid. */
export function layoutOf(data: MapData, source: WallSource): Layout | null {
  if (source === 'dwg' && data.dwg) return transformLayout(data.dwg.layout, data.dwg.transform);
  return data.structure ? { ...data.structure, floorPolygons: [] } : null;
}
