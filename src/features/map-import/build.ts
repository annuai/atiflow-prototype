import { fitRect } from '@/core/rect';
import {
  addRoad,
  addZone,
  defaultRoles,
  ensureNode,
  nodesFromFile,
  threePointTurnFrom,
  withoutSections,
  type StationNode,
} from '@/features/map-editor';
import type { MapBase, MapData, MapStation, StagingAreaDef } from '@/features/map-editor';
import type { PreparedImport } from './core/prepare';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'map';
export const newMapId = (name: string) => `imp-${slug(name)}-${Date.now().toString(36)}`;

/**
 * The editor's data for an imported map: every station gets its own point (a node, off any road for now) and our own `STA-` id; the file's id and every field we have no column for
 * stay on the station. Stations the file gave no position for are marked `unplaced` and wait at the origin until someone places them.
 * Roads of the file become roads with their paired lanes (made BEFORE the stations so a station never pulls a road end onto itself), staging areas keep their geometry and everything else
 * the file says about them. `assetIds` are the stored pictures, biggest first (same order as `prepared.levels`); `taken` = station ids already used by other maps, `takenAreas` = area ids
 * (Master Data keeps cell contents by area id, so an id must mean one area everywhere).
 */
export function buildMapData(
  prepared: PreparedImport,
  assetIds: string[],
  taken: string[] = [],
  source?: MapData['source'],
  takenAreas: string[] = [],
): MapData {
  const used = taken.map((t) => parseInt(t.replace(/\D/g, ''), 10) || 0);
  let next = Math.max(100, ...used);
  const p2p = prepared.map.layout === 'v2';
  const stations: MapStation[] = [];
  const stationNodes: MapData['nodes'] = [];
  for (const s of prepared.map.stations) {
    const id = `STA-${++next}`,
      nodeId = `N-${id}`;
    stationNodes.push({ id: nodeId, x: s.x, y: s.y, kind: 'station' });
    stations.push({
      id,
      name: s.name,
      nodeId,
      type: s.type,
      zone: null,
      fleets: [''], // no fleet runs an imported map yet: its roads and stations carry the empty fleet id until one is assigned
      angle: s.rotation,
      onLane: s.onLane ?? false,
      externalId: s.externalId,
      extra: s.extra,
      ...(s.placed ? {} : { unplaced: true }),
    });
  }
  // a point-to-point (v2) route starts and ends AT stations, so the stations' nodes exist first; v5 roads are made before them so a station never pulls a road end onto itself
  const stationNode = new Map(stations.map((s) => [s.externalId, s.nodeId]));
  let network: MapData = {
    nodes: p2p ? [...stationNodes] : [],
    lanes: [],
    roads: [],
    stations: [],
    stagingAreas: [],
    zones: [],
  };
  for (const r of prepared.map.roads)
    network = addRoad(network, r.points, {
      fleetLive: '', // no fleet runs an imported map yet
      oneWay: r.oneWay,
      snap: p2p ? 0 : 0.3, // junctions of the source share exact points
      allowShort: true,
      name: r.name,
      heading: r.heading,
      ...(Number(r.extra.custom_weight) > 0 ? { weight: Number(r.extra.custom_weight) } : {}),
      extra: { dm: { externalId: r.externalId, ...r.extra } },
      ...(p2p
        ? {
            nodeA: stationNode.get(r.fromStation),
            nodeB: stationNode.get(r.toStation),
            offset: 0, // a route is driven on its own line
            radius: Number(r.extra.radius) || 1,
            nodeRadii: ((r.extra.waypoints as { radius?: unknown }[] | undefined) ?? []).map((w) =>
              Number.isFinite(Number(w.radius)) ? Number(w.radius) : Number(r.extra.radius) || 1,
            ),
          }
        : {}),
    }).data;
  const nodes: MapData['nodes'] = p2p ? network.nodes : [...network.nodes, ...stationNodes];
  const structure =
    prepared.structure.walls.length || prepared.structure.equipment.length ? prepared.structure : undefined;
  const base: MapBase | undefined = prepared.levels.length
    ? {
        levels: prepared.levels.map((l, i) => ({
          assetId: assetIds[i],
          width: l.width,
          height: l.height,
          res: l.res,
          originCol: l.originCol,
          originRow: l.originRow,
        })),
      }
    : undefined;
  let area = Math.max(0, ...takenAreas.map((t) => parseInt(t.replace(/\D/g, ''), 10) || 0));
  const stagingAreas: StagingAreaDef[] = prepared.map.stagingAreas.map((a) => {
    const { externalId, ...rest } = a;
    return { ...rest, id: `SA-${String(++area).padStart(3, '0')}`, extra: { dm: { externalId, ...a.extra } } };
  });
  const fresh: MapData = {
    nodes,
    lanes: network.lanes,
    roads: network.roads,
    stations,
    stagingAreas,
    zones: gatesOf(prepared),
    ...(p2p ? { p2p: true } : {}),
    ...(structure ? { structure } : {}),
    ...(base ? { base } : {}),
    ...(source ? { source } : {}),
    ...(prepared.map.path.length ? { path: prepared.map.path } : {}),
  };
  return prepared.map.ati ? withEarlierExport(fresh, prepared.map.ati, next) : withAccess(fresh, prepared);
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
/**
 * A zip that this app exported before: what the file says about the stations (position, name, angle: the Deployment Manager may have moved them) is applied to our stations, matched by
 * the file's own ids; everything only we hold (roads, zones, staging areas, the DWG layer, stations only we have) comes back from `ati_flow/map.json`. Stations the file has and we do not
 * are added (with ids after `lastId`).
 */
function withEarlierExport(fresh: MapData, ati: Record<string, unknown>, lastId: number): MapData {
  const mine = arr<MapStation>(ati.stations);
  const nodes = new Map(arr<MapData['nodes'][number]>(ati.nodes).map((n) => [n.id, n]));
  const byExt = new Map(fresh.stations.filter((s) => s.externalId).map((s) => [s.externalId!, s]));
  const freshNode = new Map(fresh.nodes.map((n) => [n.id, n]));
  const stations: MapStation[] = [];
  const seen = new Set<string>();
  for (const s of mine) {
    const f = s.externalId ? byExt.get(s.externalId) : undefined;
    if (!f) {
      stations.push(s); // only we have it
      continue;
    }
    seen.add(f.externalId!);
    const fn = freshNode.get(f.nodeId);
    const n = nodes.get(s.nodeId);
    if (n && fn) nodes.set(n.id, { ...n, x: fn.x, y: fn.y });
    const { unplaced: _u, ...rest } = { ...s, name: f.name, angle: f.angle, extra: f.extra };
    stations.push(f.unplaced ? { ...rest, unplaced: true } : rest);
  }
  let id = Math.max(lastId, ...mine.map((m) => parseInt(m.id.replace(/\D/g, ''), 10) || 0));
  for (const f of fresh.stations) {
    if (f.externalId && seen.has(f.externalId)) continue;
    const sid = `STA-${++id}`,
      nid = `N-${sid}`;
    stations.push({ ...f, id: sid, nodeId: nid });
    const n = freshNode.get(f.nodeId);
    if (n) nodes.set(nid, { ...n, id: nid });
  }
  return {
    ...fresh,
    stations,
    nodes: [...nodes.values()],
    ...(ati.fileNodes ? { fileNodes: ati.fileNodes as Record<string, string> } : {}),
    ...(ati.p2p ? { p2p: true } : {}),
    lanes: arr(ati.lanes),
    roads: arr(ati.roads),
    zones: arr(ati.zones),
    stagingAreas: arr(ati.stagingAreas),
    ...(ati.dwg ? { dwg: ati.dwg as MapData['dwg'] } : {}),
    // the structure drawn in the editor (elements, doors, what was traced or erased) comes back with the scan it was traced from, so the hidden pieces still point at the same walls
    ...(ati.model3d ? { model3d: withoutSections(ati.model3d as MapData['model3d']) } : {}),
    ...(ati.model3d && ati.structure ? { structure: ati.structure as MapData['structure'] } : {}),
  };
}

/**
 * The dots of the source's routes become nodes of the roads (a road is cut where one lies on it), and each station remembers the nodes the source joins it to. Its way onto the route is made on the fly (`routable`), the way the
 * Deployment Manager does it: an off-route station is always connected to a route node, so a trip needs no connecting.
 */
function withAccess(data: MapData, prepared: PreparedImport): MapData {
  let work = data;
  const ids = new Map<string, string>();
  for (const g of prepared.map.graphNodes) {
    const r = ensureNode(work, `N-G${g.id.replace(/\D/g, '') || g.id}`, g.x, g.y);
    if (!r) continue;
    work = r.data;
    ids.set(g.id, r.node.id);
  }
  const at = new Map(prepared.map.graphNodes.map((g) => [g.id, g]));
  const line = new Map(prepared.map.roads.map((r) => [r.externalId, r.points]));
  const named = new Map(prepared.map.stations.map((s) => [s.externalId, orderLikeFile(s, at, line)]));
  return {
    ...work,
    fileNodes: Object.fromEntries([...ids].map(([file, ours]) => [ours, file])),
    stations: work.stations.map((s) => {
      const routeNodes = (named.get(s.externalId ?? '') ?? [])
        .map((id) => ids.get(id))
        .filter((id): id is string => !!id);
      const gm = s.extra?.gmaj;
      const inFile = nodesFromFile(gm);
      const count = Math.max(inFile.length, routeNodes.length);
      // each node of the file keeps its roles and its place in the file; the network node it sits on is the one the graph names for it (else it stays automatic)
      const nodes: StationNode[] = Array.from({ length: count }, (_, i) => ({
        ...(inFile[i] ?? { id: `n${i + 1}`, roles: defaultRoles() }),
        ...(routeNodes[i] ? { at: routeNodes[i] } : {}),
      }));
      const turn = threePointTurnFrom(gm);
      return {
        ...s,
        ...(routeNodes.length ? { routeNodes } : {}),
        ...(nodes.length ? { nodes } : {}),
        ...(turn ? { features: { threePointTurn: turn } } : {}),
      };
    }),
  };
}

const distToSegment = (p: { x: number; y: number }, a: [number, number], b: [number, number]) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a[0] + t * dx), p.y - (a[1] + t * dy));
};
/**
 * The graph lists a station's nodes in its own order, the station list (`gmaj.json`) in another: there a station has `nodes[0]`, `nodes[1]`... each on the lines named in `lane_ids`, and the
 * Deployment Manager labels them N1, N2... in THAT order. So each of the file's nodes takes the graph node that lies on its lines; any left over follows.
 */
function orderLikeFile(
  s: PreparedImport['map']['stations'][number],
  at: Map<string, { id: string; x: number; y: number }>,
  line: Map<string, [number, number][]>,
): string[] {
  const left = [...(s.nodeIds ?? [])];
  const mine = ((s.extra?.gmaj as { nodes?: { lane_ids?: unknown[] }[] } | undefined)?.nodes ?? []) as {
    lane_ids?: unknown[];
  }[];
  const out: string[] = [];
  for (const n of mine) {
    const lines = (n.lane_ids ?? []).map((id) => line.get(String(id))).filter((p): p is [number, number][] => !!p);
    const best = left
      .map((id) => ({
        id,
        d: Math.min(
          Infinity,
          ...lines.map((p) => distToSegment(at.get(id) ?? { x: 1e9, y: 1e9 }, p[0], p[p.length - 1])),
        ),
      }))
      .filter((c) => c.d <= 0.3)
      .sort((x, y) => x.d - y.d)[0];
    if (!best) continue;
    out.push(best.id);
    left.splice(left.indexOf(best.id), 1);
  }
  return [...out, ...left];
}

/** The traffic gates (exclusive zones) of the file as zones: the rectangle around each outline, the file's own fields kept on the zone. */
function gatesOf(prepared: PreparedImport): MapData['zones'] {
  let d: MapData = { nodes: [], lanes: [], roads: [], stations: [], stagingAreas: [], zones: [] };
  for (const g of prepared.map.gates) {
    const r = fitRect(g.polygon);
    d = addZone(d, 'exclusive', { kind: 'rect', ...r }, {}, g.name).data;
    const z = d.zones[d.zones.length - 1];
    d = {
      ...d,
      zones: d.zones.map((q) => (q === z ? { ...q, extra: { dm: { externalId: g.externalId, ...g.extra } } } : q)),
    };
  }
  return d.zones;
}
