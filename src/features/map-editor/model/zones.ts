import { text } from '../text';
import { zoneType } from './zoneTypes';
import { polygonOf } from './shape';
import type { MapData, MapZone, ZoneProp, ZoneShape, ZoneTypeId } from './types';

/** Pure edits of zones. A zone is a rectangle (or a Line gate) of a type from the registry (`zoneTypes.ts`); its outline is derived from the shape. */
type P = [number, number];
const nextId = (d: MapData) => `Z${Math.max(0, ...d.zones.map((z) => parseInt(z.id.replace(/\D/g, ''), 10) || 0)) + 1}`;
function defaultProps(type: ZoneTypeId, extra: Record<string, ZoneProp> = {}): Record<string, ZoneProp> {
  return { ...Object.fromEntries(zoneType(type).fields.map((f) => [f.key, f.default])), ...extra };
}
export function addZone(
  data: MapData,
  type: ZoneTypeId,
  shape: ZoneShape,
  extra: Record<string, ZoneProp> = {},
  name?: string,
): { data: MapData; id: string } {
  const id = nextId(data);
  const t = zoneType(type);
  const n = data.zones.filter((z) => z.type === type).length + 1;
  const zone: MapZone = {
    id,
    type,
    name: name?.trim() || `${t.label} ${n}`,
    shape,
    polygon: polygonOf(shape),
    props: defaultProps(type, extra),
  };
  return { id, data: { ...data, zones: [...data.zones, zone] } };
}
export const updateZone = (
  data: MapData,
  id: string,
  patch: Partial<Pick<MapZone, 'name' | 'type'>> & { props?: Record<string, ZoneProp> },
): MapData => ({
  ...data,
  zones: data.zones.map((z) =>
    z.id === id ? { ...z, ...patch, props: patch.props ? { ...z.props, ...patch.props } : z.props } : z,
  ),
});
/** Change a zone's shape (move, resize, rotate, a gate's line, depth or side): the outline follows. */
export const setZoneShape = (data: MapData, id: string, shape: ZoneShape): MapData => ({
  ...data,
  zones: data.zones.map((z) => (z.id === id ? { ...z, shape, polygon: polygonOf(shape) } : z)),
});
export const deleteZone = (data: MapData, id: string): MapData => ({
  ...data,
  zones: data.zones.filter((z) => z.id !== id),
});
export function zoneNameProblem(data: MapData, id: string, name: string): string {
  const t = name.trim();
  if (!t) return text.nameProblems.zone.empty;
  return data.zones.some((z) => z.id !== id && z.name.trim().toLowerCase() === t.toLowerCase())
    ? text.nameProblems.zone.taken
    : '';
}
export const pointInPolygon = (x: number, y: number, poly: P[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
