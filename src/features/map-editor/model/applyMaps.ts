import type { NavGraph } from '@/core/types';
import { routable } from './connect';
import { isCellStationId, withCellStations } from './stagingCells';
import type { MapData } from './types';

/**
 * The Live Floor's network = the published maps. For every fleet that has a published map, the lanes, stations, nodes and traffic / no-go zones of the base lane map are replaced by what
 * the map holds (so what is edited and published in the Map Editor is what robots drive). Entries that still serve a fleet without a map are kept; ids already present are not repeated.
 */
export function applyPublishedMaps(nav: NavGraph, maps: { fleetLive: string; data: MapData }[]): NavGraph {
  if (!maps.length) return nav;
  const mapped = new Set(maps.map((m) => m.fleetLive));
  const unmapped = (fleets: string[]) => !fleets.length || fleets.some((f) => !mapped.has(f));
  const lanes = nav.lanes.filter((l) => unmapped(l.fleets));
  const stations = nav.stations.filter((s) => unmapped(s.fleets));
  const trafficZones = nav.trafficZones.filter((z) => unmapped(z.fleets));
  const nodes = new Map(nav.nodes.map((n) => [n.id, n]));
  const seen = {
    l: new Set(lanes.map((l) => l.id)),
    s: new Set(stations.map((s) => s.id)),
    z: new Set(trafficZones.map((z) => z.id)),
  };
  const cellStations: NavGraph['stations'] = [];
  for (const { data: saved, fleetLive } of maps) {
    const data = routable(withCellStations(saved, fleetLive)); // off-route stations (and staging cells) are joined to the route for the robots
    for (const n of data.nodes) nodes.set(n.id, n);
    // a lane or station that two maps both hold (a shared area) is one: it serves the fleets of both
    const union = <T extends { id: string; fleets: string[] }>(list: T[], item: T) => {
      const old = list.find((q) => q.id === item.id);
      if (old) old.fleets = [...new Set([...old.fleets, ...item.fleets])];
    };
    // the staging cells' stations serve every fleet that drives this map; the lanes that join them to the route are marked (AC-) so what is drawn leaves them out
    const mapFleets = [...new Set(saved.lanes.flatMap((l) => l.fleets))];
    const cellNodes = new Set(data.stations.filter((q) => isCellStationId(q.id)).map((q) => q.nodeId));
    for (const l of data.lanes) {
      const cell = cellNodes.has(l.from) || cellNodes.has(l.to);
      const lane = cell ? { ...l, id: l.id.replace(/^A-/, 'AC-'), fleets: mapFleets } : l;
      if (!seen.l.has(lane.id)) {
        seen.l.add(lane.id);
        lanes.push({ ...lane, fleets: [...lane.fleets] });
      } else union(lanes, lane);
    }
    for (const s of data.stations) {
      if (isCellStationId(s.id)) {
        if (!cellStations.some((q) => q.id === s.id)) cellStations.push({ ...s, fleets: [...mapFleets] });
        continue;
      }
      if (!seen.s.has(s.id)) {
        seen.s.add(s.id);
        stations.push({ ...s, fleets: [...s.fleets] });
      } else union(stations, s);
    }
    for (const z of data.zones)
      if (z.type === 'exclusive' && !seen.z.has(z.id)) {
        seen.z.add(z.id);
        const fl = maps.filter((m) => m.data.zones.some((q) => q.id === z.id)).map((m) => m.fleetLive);
        trafficZones.push({
          id: z.id,
          name: z.name,
          capacity: Number(z.props.capacity ?? 1) || 1,
          fleets: fl,
          polygon: z.polygon,
          ...(z.shape.kind === 'gate'
            ? { gate: { a: z.shape.a, b: z.shape.b, depth: z.shape.depth, side: z.shape.side } }
            : {}),
        });
      }
  }
  // no-go zones: the maps' own (each map holds all of them, so they are taken once)
  const forbidden = new Map<string, NavGraph['forbiddenZones'][number]>();
  for (const { data } of maps)
    for (const z of data.zones)
      if (z.type === 'no-go' && !forbidden.has(z.id))
        forbidden.set(z.id, { id: z.id, name: z.name, reason: String(z.props.reason ?? ''), polygon: z.polygon });
  return {
    ...nav,
    nodes: [...nodes.values()],
    lanes,
    stations,
    ...(cellStations.length ? { cellStations } : {}),
    trafficZones,
    forbiddenZones: [...forbidden.values()],
  };
}
