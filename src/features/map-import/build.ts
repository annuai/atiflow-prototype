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
  return {
    nodes,
    lanes: [],
    roads: [],
    stations,
    stagingAreas: [],
    zones: [],
    ...(base ? { base } : {}),
    ...(source ? { source } : {}),
    ...(prepared.map.path.length ? { path: prepared.map.path } : {}),
  };
}
