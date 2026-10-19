import type { NavGraph, SiteLayout } from '@/core/types';
import { type FleetMap } from '@/features/maps';
import { roadsFromLanes } from './roads';
import { floorAreasAreWorkAreas, withoutSections } from './structure/legacy';
import { areasToWorkAreas, workAreaOf } from './workAreas';
import { fitRect, gateFromThin, polygonOf } from './shape';
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
      retrieval: 'fifo',
      stationId: 'STA-116',
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
      retrieval: 'lifo',
      stationId: 'STA-117',
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
      retrieval: 'fifo',
      stationId: 'STA-118',
    },
  ],
};
/** A zone from any outline: the smallest rotated rectangle around it (zones are rectangles). */
const rectZone = (polygon: [number, number][]) => {
  const shape = fitRect(polygon);
  return { shape, polygon: polygonOf(shape) };
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
        ...rectZone(z.polygon),
        props: { capacity: z.capacity },
      })),
    ...nav.forbiddenZones.map((z): MapZone => ({
      id: z.id,
      type: 'no-go',
      name: z.name,
      ...rectZone(z.polygon),
      props: { reason: z.reason },
    })),
  ];
  return {
    nodes,
    lanes,
    roads: roadsFromLanes(lanes),
    stations,
    stagingAreas: structuredClone(DEMO_AREAS[f] ?? []),
    zones,
    model3d: {
      elements: site.zones
        .filter((z) => z.active && (fleet?.areas ?? []).includes(z.id))
        .map((z) => workAreaOf(z, nav.fleets)),
      hiddenWalls: [],
      hiddenEquipment: [],
    },
  };
}

/** Data saved by an earlier version of the editor gets the parts it did not have (roads grouped from its lanes, no staging areas). */
type SavedZone = Omit<MapZone, 'shape'> & { shape?: MapZone['shape'] };
export function normaliseData(
  d: Partial<Omit<MapData, 'zones'>> & Pick<MapData, 'nodes' | 'lanes' | 'stations'> & { zones: SavedZone[] },
): MapData {
  return {
    ...d,
    roads: d.roads ?? roadsFromLanes(d.lanes),
    stagingAreas: (d.stagingAreas ?? []).map((a) => ({ ...a, retrieval: a.retrieval ?? 'fifo' })),
    ...areasToWorkAreas({
      zones: d.zones.map(normaliseZone),
      model3d: floorAreasAreWorkAreas(withoutSections(d.model3d)),
    }),
  } as MapData;
}

/** A zone saved before zones had a shape: a thin Line gate becomes a directional gate (3 m deep), everything else the rectangle around its outline. */
function normaliseZone(z: SavedZone): MapZone {
  if (z.shape) return { ...z, shape: z.shape, polygon: polygonOf(z.shape) };
  const { shape: legacy, ...props } = z.props;
  const shape = legacy === 'line' ? gateFromThin(z.polygon) : fitRect(z.polygon);
  return { ...z, props, shape, polygon: polygonOf(shape) };
}
