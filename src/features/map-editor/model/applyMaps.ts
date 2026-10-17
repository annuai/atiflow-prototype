import type { NavGraph } from '@/core/types';
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
  for (const { data } of maps) {
    for (const n of data.nodes) nodes.set(n.id, n);
    // a lane or station that two maps both hold (a shared area) is one: it serves the fleets of both
    const union = <T extends { id: string; fleets: string[] }>(list: T[], item: T) => {
      const old = list.find((q) => q.id === item.id);
      if (old) old.fleets = [...new Set([...old.fleets, ...item.fleets])];
    };
    for (const l of data.lanes)
      if (!seen.l.has(l.id)) {
        seen.l.add(l.id);
        lanes.push({ ...l, fleets: [...l.fleets] });
      } else union(lanes, l);
    for (const s of data.stations)
      if (!seen.s.has(s.id)) {
        seen.s.add(s.id);
        stations.push({ ...s, fleets: [...s.fleets] });
      } else union(stations, s);
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
  return { ...nav, nodes: [...nodes.values()], lanes, stations, trafficZones, forbiddenZones: [...forbidden.values()] };
}
