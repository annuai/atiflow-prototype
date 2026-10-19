import type { SiteLayout } from '@/core/types';
import { structureSite } from './structure/derive';
import type { AreaElement, StructureElement } from './structure/types';
import type { MapData, MapZone } from './types';

/** The indigo the Live Floor tints a part of the floor that two fleets share (such as the East Logistics Strip). */
const SHARED = '#6366f1';
const FALLBACK = '#14b8a6';

type Owner = { color: string; areas: string[] };
/** The tint a base-map area has always had on the Live Floor: its fleet's colour, indigo when two fleets share it. */
export function tintOf(zone: { id: string; color: string }, fleets: Owner[]): string {
  const owners = fleets.filter((f) => f.areas.includes(zone.id));
  return owners.length > 1 ? SHARED : (owners[0]?.color ?? zone.color);
}

/** A part of the floor that the lane map calls an area, as a Work area (its outline exactly as the drawing has it). Shared ones say so, as they always did. */
export function workAreaOf(zone: SiteLayout['zones'][number], fleets: Owner[]): AreaElement {
  const shared = fleets.filter((f) => f.areas.includes(zone.id)).length > 1;
  return {
    id: `wa:${zone.id}`,
    kind: 'area',
    work: true,
    fromZone: zone.id,
    exact: true,
    points: zone.polygon.map((p) => [p[0], p[1]]),
    height: 0,
    color: tintOf(zone, fleets),
    name: zone.name,
    label: shared ? `${zone.name} · shared` : zone.name,
  };
}

/** Zones of type `area` saved by an earlier version become Work areas of the structure (a saved zone is only the rectangle fitted round the real outline: see `restoreWorkAreas`). */
export function areasToWorkAreas(d: {
  zones: MapZone[];
  model3d?: MapData['model3d'];
}): Pick<MapData, 'zones' | 'model3d'> {
  const old = d.zones.filter((z) => z.type === 'area');
  const model = d.model3d ?? { elements: [], hiddenWalls: [], hiddenEquipment: [] };
  if (!old.length) return { zones: d.zones, ...(d.model3d ? { model3d: d.model3d } : {}) };
  const have = new Set(model.elements.map((e) => (e.kind === 'area' ? e.fromZone : undefined)));
  const added: StructureElement[] = old
    .filter((z) => !have.has(z.id))
    .map((z) => ({
      id: `wa:${z.id}`,
      kind: 'area',
      work: true,
      fromZone: z.id,
      points: z.polygon.map((p) => [p[0], p[1]] as [number, number]),
      height: 0,
      color: FALLBACK,
      name: z.name,
      label: z.name,
    }));
  return {
    zones: d.zones.filter((z) => z.type !== 'area'),
    model3d: { ...model, elements: [...model.elements, ...added] },
  };
}

/** Puts the real outline and tint back on Work areas that were made from a saved rectangle (their `fromZone` is a zone of the lane map). Nothing else is touched. */
export function restoreWorkAreas(data: MapData, site: SiteLayout, fleets: Owner[]): MapData {
  const m = data.model3d;
  if (!m?.elements.some((e) => e.kind === 'area' && e.fromZone && !e.exact)) return data;
  const byId = new Map(site.zones.map((z) => [z.id, z]));
  return {
    ...data,
    model3d: {
      ...m,
      elements: m.elements.map((e) => {
        if (e.kind !== 'area' || !e.fromZone || e.exact) return e;
        const z = byId.get(e.fromZone);
        if (!z) return { ...e, exact: true }; // no drawing to restore from (an imported map's area): what is saved stays
        return {
          ...e,
          ...workAreaOf(z, fleets),
          id: e.id,
          name: e.name,
          label: e.label === e.name ? workAreaOf(z, fleets).label : e.label,
        };
      }),
    },
  };
}

/** The Work areas of a map as the zones the Live Floor draws. */
export const workAreaZones = (data: MapData): SiteLayout['zones'] =>
  structureSite({ ...data, structure: undefined }).zones;
