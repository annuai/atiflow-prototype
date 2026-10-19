import { modelOf, structureSite, type MapData } from '@/features/map-editor';
import { transformLayout, type Layout } from './core/dwg';

export type WallSource = 'lidar' | 'dwg';

/**
 * The walls, machines, floor patches and labels of a map for the 3D scene: the base (the DWG laid over the map when there is one and it is chosen, else the walls and machines estimated from the
 * lidar grid that nobody has removed or replaced) and the elements a person drew or traced on top of it.
 */
export function layoutOf(data: MapData, source: WallSource): Layout | null {
  const mine = structureSite({ ...data, structure: undefined }); // the elements alone
  let base: Layout | null = null;
  if (source === 'dwg' && data.dwg) base = transformLayout(data.dwg.layout, data.dwg.transform);
  else if (data.structure) {
    const m = modelOf(data);
    const hw = new Set(m.hiddenWalls),
      he = new Set(m.hiddenEquipment);
    base = {
      walls: data.structure.walls.filter((_, i) => !hw.has(i)),
      equipment: data.structure.equipment.filter((_, i) => !he.has(i)),
      floorPolygons: [],
    };
  }
  const any =
    mine.walls.length || mine.equipment.length || mine.shapes.length || mine.labels.length || mine.zones.length;
  if (!base && !any) return null;
  return {
    walls: [...(base?.walls ?? []), ...mine.walls],
    equipment: [...(base?.equipment ?? []), ...mine.equipment],
    floorPolygons: base?.floorPolygons ?? [],
    shapes: mine.shapes,
    labels: mine.labels,
    zones: mine.zones,
  };
}
