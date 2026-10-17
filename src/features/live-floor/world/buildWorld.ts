import type { FleetDef, NavGraph, SiteLayout } from '@/core/types';
import type { FleetRecord } from '@/data/fleets';
import { applyPublishedMaps, seedMapData, type MapData } from '@/features/map-editor';
import type { FleetMap } from '@/features/maps';

/**
 * THE WORLD of the Live Floor: what the simulator drives on, what the 3D scene shows and what every page reads, built from FLEETS and their MAPS, never from a fixed list.
 *
 *  - a fleet runs on the map its profile points to (`profiles[fleet name].mapId`); several fleets may run on one map (they share its lanes: that is how a shared area works);
 *  - a map the Deployment Manager / Map Editor made (not one of the two ECC maps) is laid out beside the others, with its own ids, so two maps never clash;
 *  - the two ECC base fleets always run (the base lane map of `nav.json` serves them), as before;
 *  - a fleet whose map is not published yet, or has no roads / stations to drive between, is NOT in the world: the Live Floor says why instead of showing nothing.
 * Pure: the inputs say everything, so it is tested without a browser. See `liveFeed.ts` for when it is rebuilt.
 */
export interface WorldInput {
  baseSite: SiteLayout;
  baseNav: NavGraph;
  /** every fleet of the shared dataset */
  fleets: FleetRecord[];
  /** fleet name -> its map */
  profiles: Record<string, { mapId: string | null }>;
  maps: FleetMap[];
  /** the latest PUBLISHED version of a map that somebody has edited (null: none, or only the first copy of the base lane map) */
  published(mapId: string): MapData | null;
  /** the walls and machines of a map for the 3D scene (the DWG when there is one, else the lidar estimate) */
  structure(data: MapData): Structure | null;
}
export interface Structure {
  walls: SiteLayout['walls'];
  equipment: SiteLayout['equipment'];
  floorPolygons: SiteLayout['floorPolygons'];
}
export type NotRunning = 'no-map' | 'not-published' | 'no-network';
export interface World {
  site: SiteLayout;
  nav: NavGraph;
  /** fleet (its id in `nav`) -> the map it runs on */
  runs: Record<string, string>;
  /** fleets that are NOT on the floor, and why (shown to the person looking at that fleet) */
  idle: { fleetId: string; name: string; why: NotRunning }[];
  /** changes whenever the world would look different: the feed rebuilds and restarts when it does */
  signature: string;
}

const GAP = 20; // metres between two buildings
const navId = (f: FleetRecord) => f.liveId ?? f.id;
const uniq = <T>(a: T[]) => [...new Set(a)];

/** A map is something robots can drive on when it has roads and at least two stations that have a position. */
export const hasNetwork = (d: MapData) => d.lanes.length > 0 && d.stations.filter((s) => !s.unplaced).length >= 2;

const retag = (fleets: string[], from: string, to: string[]) => uniq(fleets.flatMap((f) => (f === from ? to : [f])));

/** The same map for other fleets: everything that belonged to the fleet the map was made for now belongs to all the fleets that run it. */
function forFleets(d: MapData, from: string, to: string[]): MapData {
  return {
    ...d,
    lanes: d.lanes.map((l) => ({ ...l, fleets: retag(l.fleets, from, to) })),
    stations: d.stations.map((s) => ({ ...s, fleets: retag(s.fleets, from, to) })),
  };
}
const shift = (p: [number, number], dx: number, dy: number): [number, number] => [p[0] + dx, p[1] + dy];
/** A map placed in the site: its ids get the map's name in front (two maps both have lane L1) and everything moves by (dx, dy). Station ids stay: they are unique across maps by design. */
function placed(d: MapData, prefix: string, dx: number, dy: number): MapData {
  const nid = (id: string) => `${prefix}/${id}`;
  return {
    ...d,
    nodes: d.nodes.map((n) => ({ ...n, id: nid(n.id), x: n.x + dx, y: n.y + dy })),
    lanes: d.lanes.map((l) => ({
      ...l,
      id: nid(l.id),
      from: nid(l.from),
      to: nid(l.to),
      geom: l.geom.map((p) => shift(p, dx, dy)),
    })),
    stations: d.stations.map((s) => ({ ...s, nodeId: nid(s.nodeId) })),
    zones: d.zones.map((z) => ({
      ...z,
      id: nid(z.id),
      polygon: z.polygon.map((p) => shift(p, dx, dy)),
      shape:
        z.shape.kind === 'rect'
          ? { ...z.shape, cx: z.shape.cx + dx, cy: z.shape.cy + dy }
          : { ...z.shape, a: shift(z.shape.a, dx, dy), b: shift(z.shape.b, dx, dy) },
    })),
  };
}
const extent = (d: MapData, s: Structure | null) => {
  const xs: number[] = [0],
    ys: number[] = [0];
  for (const w of s?.walls ?? []) (xs.push(w.a[0], w.b[0]), ys.push(w.a[1], w.b[1]));
  for (const n of d.nodes) (xs.push(n.x), ys.push(n.y));
  return { minX: Math.min(...xs) - 2, maxX: Math.max(...xs) + 2, minY: Math.min(...ys) - 2, maxY: Math.max(...ys) + 2 };
};

export function buildWorld(i: WorldInput): World {
  const baseIds = new Set(i.baseNav.fleets.map((f) => f.id));
  const mapOf = (f: FleetRecord) => {
    const id = i.profiles[f.name]?.mapId;
    return id ? i.maps.find((m) => m.id === id) : undefined;
  };
  const isBaseMap = (m: FleetMap) => baseIds.has(m.fleetLive);

  // who runs which map
  const runners = new Map<string, FleetRecord[]>();
  for (const f of i.fleets) {
    const m = mapOf(f) ?? i.maps.find((q) => isBaseMap(q) && q.fleetLive === navId(f)); // a base fleet without a profile still has its own map
    if (m) runners.set(m.id, [...(runners.get(m.id) ?? []), f]);
  }

  const idle: World['idle'] = [];
  const nets: { fleetLive: string; data: MapData }[] = [];
  const parts: { map: FleetMap; data: MapData; dx: number; dy: number; s: Structure | null }[] = [];
  const runs: Record<string, string> = {};
  let nextX = i.baseSite.bounds.maxX + GAP;

  for (const f of i.fleets) {
    const m = mapOf(f);
    if (!m && !baseIds.has(navId(f))) idle.push({ fleetId: navId(f), name: f.name, why: 'no-map' });
  }
  for (const m of i.maps) {
    const rs = runners.get(m.id);
    if (!rs?.length) continue;
    const ids = rs.map(navId);
    const pub = i.published(m.id);
    let data: MapData | null = pub;
    if (isBaseMap(m)) {
      // a base map nobody edited is the base lane map's slice for its fleet (the editor seeds its first version from the same)
      data = pub ?? seedMapData(m, i.baseSite, i.baseNav);
      data = forFleets(data, m.fleetLive, uniq([m.fleetLive, ...ids]));
      for (const id of uniq([m.fleetLive, ...ids])) nets.push({ fleetLive: id, data });
    } else {
      const why: NotRunning | null = !data ? 'not-published' : !hasNetwork(data) ? 'no-network' : null;
      if (why || !data) {
        for (const f of rs) idle.push({ fleetId: navId(f), name: f.name, why: why ?? 'not-published' });
        continue;
      }
      const s = i.structure(data);
      const box = extent(data, s);
      const dx = nextX - box.minX,
        dy = i.baseSite.bounds.minY - box.minY;
      nextX += box.maxX - box.minX + GAP;
      const mine = placed(forFleets(data, '', ids), m.id, dx, dy);
      for (const id of ids) nets.push({ fleetLive: id, data: mine });
      parts.push({ map: m, data, dx, dy, s });
    }
    for (const id of ids) runs[id] = m.id;
  }

  const nav = applyPublishedMaps(i.baseNav, nets);
  const dsById = new Map(i.fleets.map((f) => [navId(f), f]));
  const running = new Set([...baseIds, ...Object.keys(runs)]);
  const fleets: FleetDef[] = [...running]
    .filter((id) => baseIds.has(id) || dsById.has(id))
    .map((id) => {
      const base = i.baseNav.fleets.find((f) => f.id === id);
      const r = dsById.get(id);
      return {
        id,
        name: r?.name ?? base?.name ?? id,
        color: r?.color ?? base?.color ?? '#14b8a6',
        areas: base?.areas ?? [],
      };
    });
  const world: NavGraph = { ...nav, fleets };

  // the 3D scene: the base site, plus the walls and machines of every placed map
  const site: SiteLayout = {
    ...i.baseSite,
    walls: [...i.baseSite.walls],
    equipment: [...i.baseSite.equipment],
    floorPolygons: [...i.baseSite.floorPolygons],
  };
  let b = { ...i.baseSite.bounds };
  for (const { data, dx, dy, s } of parts) {
    const box = extent(data, s);
    const t = (p: [number, number]) => shift(p, dx, dy);
    for (const w of s?.walls ?? []) site.walls.push({ ...w, a: t(w.a), b: t(w.b) });
    for (const e of s?.equipment ?? []) site.equipment.push({ ...e, x: e.x + dx, y: e.y + dy });
    const floors = s?.floorPolygons.length
      ? s.floorPolygons.map((p) => p.map(t))
      : [[t([box.minX, box.minY]), t([box.maxX, box.minY]), t([box.maxX, box.maxY]), t([box.minX, box.maxY])]];
    site.floorPolygons.push(...floors);
    b = {
      minX: Math.min(b.minX, box.minX + dx),
      maxX: Math.max(b.maxX, box.maxX + dx),
      minY: Math.min(b.minY, box.minY + dy),
      maxY: Math.max(b.maxY, box.maxY + dy),
    };
  }
  site.bounds = b;

  const signature = JSON.stringify([
    fleets.map((f) => [f.id, f.name]),
    runs,
    world.lanes.length,
    world.stations.map((s) => [s.id, s.nodeId, s.type, s.fleets]),
    idle.map((x) => [x.fleetId, x.why]),
    site.walls.length,
  ]);
  return { site, nav: world, runs, idle, signature };
}
