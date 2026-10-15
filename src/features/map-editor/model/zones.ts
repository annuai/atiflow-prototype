import { zoneType } from './zoneTypes';
import type { MapData, MapZone, ZoneProp, ZoneTypeId } from './types';

/** Pure edits of zones. Zones are polygons (metres, site frame) of a type from the registry (`zoneTypes.ts`). */
type P = [number, number];
const round = (v: number) => Math.round(v * 100) / 100;
export const GATE_WIDTH = 1.6;
/** The rectangle with the two points as opposite corners (Box gate). */
export const boxPolygon = (a: P, b: P): P[] => [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]].map(([x, y]) => [round(x), round(y)] as P);
/** A thin rectangle along the line from a to b (Line gate): the line you draw across a road, `width` metres thick. */
export function gatePolygon(a: P, b: P, width = GATE_WIDTH): P[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; const nx = (-dy / l) * (width / 2), ny = (dx / l) * (width / 2);
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]].map(([x, y]) => [round(x), round(y)] as P);
}
const nextId = (d: MapData) => `Z${Math.max(0, ...d.zones.map((z) => parseInt(z.id.replace(/\D/g, ''), 10) || 0)) + 1}`;
export function defaultProps(type: ZoneTypeId, extra: Record<string, ZoneProp> = {}): Record<string, ZoneProp> { return { ...Object.fromEntries(zoneType(type).fields.map((f) => [f.key, f.default])), ...extra }; }
export function addZone(data: MapData, type: ZoneTypeId, polygon: P[], extra: Record<string, ZoneProp> = {}, name?: string): { data: MapData; id: string } {
  const id = nextId(data); const t = zoneType(type); const n = data.zones.filter((z) => z.type === type).length + 1;
  const zone: MapZone = { id, type, name: name?.trim() || `${t.label} ${n}`, polygon, props: defaultProps(type, extra) }; return { id, data: { ...data, zones: [...data.zones, zone] } };
}
export const updateZone = (data: MapData, id: string, patch: Partial<Pick<MapZone, 'name' | 'type'>> & { props?: Record<string, ZoneProp> }): MapData => ({ ...data, zones: data.zones.map((z) => (z.id === id ? { ...z, ...patch, props: patch.props ? { ...z.props, ...patch.props } : z.props } : z)) });
export const deleteZone = (data: MapData, id: string): MapData => ({ ...data, zones: data.zones.filter((z) => z.id !== id) });
export function zoneNameProblem(data: MapData, id: string, name: string): string {
  const t = name.trim(); if (!t) return 'Give the zone a name'; return data.zones.some((z) => z.id !== id && z.name.trim().toLowerCase() === t.toLowerCase()) ? 'Another zone already has this name' : '';
}
export const pointInPolygon = (x: number, y: number, poly: P[]): boolean => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
