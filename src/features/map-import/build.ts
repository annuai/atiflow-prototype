import type { MapBase, MapData, MapStation } from '@/features/map-editor';
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
 * `assetIds` are the stored pictures, biggest first (same order as `prepared.levels`); `taken` = station ids already used by other maps.
 */
export function buildMapData(
  prepared: PreparedImport,
  assetIds: string[],
  taken: string[] = [],
  source?: MapData['source'],
): MapData {
  const used = taken.map((t) => parseInt(t.replace(/\D/g, ''), 10) || 0);
  let next = Math.max(100, ...used);
  const nodes: MapData['nodes'] = [];
  const stations: MapStation[] = [];
  for (const s of prepared.map.stations) {
    const id = `STA-${++next}`,
      nodeId = `N-${id}`;
    nodes.push({ id: nodeId, x: s.x, y: s.y, kind: 'station' });
    stations.push({
      id,
      name: s.name,
      nodeId,
      type: s.type,
      zone: null,
      fleets: [''], // no fleet runs an imported map yet: its roads and stations carry the empty fleet id until one is assigned
      angle: s.rotation,
      onLane: false,
      externalId: s.externalId,
      extra: s.extra,
      ...(s.placed ? {} : { unplaced: true }),
    });
  }
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
  const fresh: MapData = {
    nodes,
    lanes: [],
    roads: [],
    stations,
    stagingAreas: [],
    zones: [],
    ...(structure ? { structure } : {}),
    ...(base ? { base } : {}),
    ...(source ? { source } : {}),
    ...(prepared.map.path.length ? { path: prepared.map.path } : {}),
  };
  return prepared.map.ati ? withEarlierExport(fresh, prepared.map.ati, next) : fresh;
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
    lanes: arr(ati.lanes),
    roads: arr(ati.roads),
    zones: arr(ati.zones),
    stagingAreas: arr(ati.stagingAreas),
    ...(ati.dwg ? { dwg: ati.dwg as MapData['dwg'] } : {}),
  };
}
