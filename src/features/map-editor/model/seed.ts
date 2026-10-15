import type { NavGraph, SiteLayout } from '@/core/types';
import type { FleetMap } from '@/features/maps/model/types';
import { roadsFromLanes } from './roads';
import type { MapData, MapZone, StagingAreaDef } from './types';

/**
 * Staging areas of the starting maps. PLACEHOLDER geometry: the ECC drawing has no staging areas, so the three areas Master Data always showed (SA 001 / 002 for Line Side, SA 003 for Assembly)
 * are placed on the floor until real maps define theirs.
 */
const DEMO_AREAS: Record<string, StagingAreaDef[]> = {
  'line-side': [
    {
      id: 'SA-001',
      name: 'SA 001',
      sherpaType: 'Sherpa XT Lite',
      rotation: 0,
      x: 10,
      y: 138,
      rows: 20,
      cols: 10,
      cellLength: 1.2,
      cellWidth: 1,
    },
    {
      id: 'SA-002',
      name: 'SA 002',
      sherpaType: 'Pallet Mover',
      rotation: 0,
      x: 30,
      y: 138,
      rows: 20,
      cols: 10,
      cellLength: 1.2,
      cellWidth: 1,
    },
  ],
  asrs: [
    {
      id: 'SA-003',
      name: 'SA 003',
      sherpaType: 'Pallet Mover',
      rotation: 0,
      x: 52,
      y: 138,
      rows: 8,
      cols: 10,
      cellLength: 1.2,
      cellWidth: 1,
    },
  ],
};
/**
 * The first version of a map, from the real site and lane map: ITS fleet's lanes, stations and zones (each map owns its full network). The nodes kept are the ones its lanes and
 * stations use. Traffic zones become traffic gates, no-go zones stay no-go, the fleet's active areas become work areas.
 */
export function seedMapData(map: Pick<FleetMap, 'fleetLive'>, site: SiteLayout, nav: NavGraph): MapData {
  const f = map.fleetLive;
  const lanes = nav.lanes.filter((l) => l.fleets.includes(f)).map((l) => structuredClone(l));
  const stations = nav.stations.filter((s) => s.fleets.includes(f)).map((s) => structuredClone(s));
  const used = new Set([...lanes.flatMap((l) => [l.from, l.to]), ...stations.map((s) => s.nodeId)]);
  const nodes = nav.nodes.filter((n) => used.has(n.id)).map((n) => ({ ...n }));
  const fleet = nav.fleets.find((q) => q.id === f);
  const zones: MapZone[] = [
    ...nav.trafficZones
      .filter((z) => z.fleets.includes(f))
      .map((z): MapZone => ({
        id: z.id,
        type: 'exclusive',
        name: z.name.replace(/^Traffic Zone/i, 'Traffic Gate'),
        polygon: z.polygon.map((p) => [...p] as [number, number]),
        props: { capacity: z.capacity },
      })),
    ...nav.forbiddenZones.map((z): MapZone => ({
      id: z.id,
      type: 'no-go',
      name: z.name,
      polygon: z.polygon.map((p) => [...p] as [number, number]),
      props: { reason: z.reason },
    })),
    ...site.zones
      .filter((z) => z.active && (fleet?.areas ?? []).includes(z.id))
      .map((z): MapZone => ({
        id: z.id,
        type: 'area',
        name: z.name,
        polygon: z.polygon.map((p) => [...p] as [number, number]),
        props: {},
      })),
  ];
  return {
    nodes,
    lanes,
    roads: roadsFromLanes(lanes),
    stations,
    stagingAreas: structuredClone(DEMO_AREAS[f] ?? []),
    zones,
  };
}

/** Data saved by an earlier version of the editor gets the parts it did not have (roads grouped from its lanes, no staging areas). */
export function normaliseData(d: Partial<MapData> & Pick<MapData, 'nodes' | 'lanes' | 'stations' | 'zones'>): MapData {
  return { ...d, roads: d.roads ?? roadsFromLanes(d.lanes), stagingAreas: d.stagingAreas ?? [] } as MapData;
}
