import type { MapData, MapStation } from '@/features/map-editor';
import { pyFloat, type PyObj, type PyValue } from './pyjson';
import { parkingName } from '../formats/deploymentManager/v5';
import { commit, drop, num, obj, openDoc, put, r3, same, str } from './tree';

/** The station fields a new station gets in the Deployment Manager (what its own "add station" writes). */
const blank = (): [string, PyValue][] => [
  ['rotation', pyFloat(0)],
  ['charging', false],
  ['inplace', true],
  ['clockwise', 0],
  [
    'three_point_turn',
    new Map<string, PyValue>([
      ['enable', false],
      ['start_direction', 'left'],
      ['start_action', 'forward'],
      ['aisle_width', pyFloat(0)],
      ['aisle_length', pyFloat(0)],
    ]),
  ],
  ['common_dispatch_station', false],
  ['post_process', false],
  ['station_tags', ['dispatch_not_reqd']],
  ['hidden', false],
  ['orientation', 'null'],
];

/**
 * The tags a station has after our edits. `parking` follows the station type, but only when the person changed it: a station the file never tagged but whose name says parking was read as
 * a parking station, and writing the tag back for that alone would change the file.
 */
export const tagsOf = (s: MapStation, old: PyValue | undefined, oldName: string = s.name): PyValue[] => {
  const tags = Array.isArray(old) ? old : ['dispatch_not_reqd'];
  const had = tags.includes('parking') || parkingName.test(oldName);
  const wants = s.type === 'park';
  if (had === wants) return tags;
  return wants ? [...tags, 'parking'] : tags.filter((t) => t !== 'parking');
};

/** Ids for the stations that have none in the file yet: one above every id the station lists of the map use. */
export function assignStationIds(files: Record<string, Uint8Array>, dir: string, data: MapData): MapData {
  const taken = new Set<number>();
  for (const f of ['webui_map.json', 'gmaj.json', 'grid_map_attributes.json', 'waypoints.json']) {
    const d = openDoc(files, dir + f);
    if (!d) continue;
    const st =
      f === 'waypoints.json'
        ? obj(obj(d.tree.get('map_editor')).get('stations'))
        : obj(d.tree.get('stations') ?? d.tree.get('stations_info'));
    // (the station of every staging cell is in the attribute file too, with ids in the hundred thousands: they are not stations of the map)
    for (const [k, v] of st) if (obj(v).get('type') !== 'staging_area') taken.add(Number(k) || 0);
  }
  for (const s of data.stations) if (s.externalId !== undefined) taken.add(Number(s.externalId) || 0);
  let next = Math.max(0, ...taken);
  return {
    ...data,
    stations: data.stations.map((s) => (s.externalId === undefined ? { ...s, externalId: String(++next) } : s)),
  };
}

/**
 * `webui_map.json`: the station list the Deployment Manager's web page uses. In a v5 export it only holds placeholders ("Station 3" at the origin, the real data is in gmaj.json), so
 * stations there are only added and removed; in older files it IS the station data and is patched field by field.
 */
export function patchWebui(
  files: Record<string, Uint8Array>,
  key: string,
  data: MapData,
  o: { v5: boolean; name: string; version: string },
): void {
  const doc = openDoc(files, key) ?? {
    key,
    indent: 4,
    dirty: true,
    tree: new Map<string, PyValue>([
      ['map_name', o.name],
      ['trip_type', 'multiple'],
      ['maps', new Map()],
      ['map_version', o.version],
      ['stations', new Map()],
    ]),
  };
  const stations = obj(doc.tree.get('stations'));
  if (!doc.tree.has('stations')) doc.tree.set('stations', stations);
  const nodes = new Map(data.nodes.map((n) => [n.id, n]));
  const keep = new Set(data.stations.map((s) => s.externalId!));
  for (const k of [...stations.keys()]) if (!keep.has(k)) drop(doc, stations, k);
  for (const s of data.stations) {
    const ext = s.externalId!;
    const n = nodes.get(s.nodeId);
    const fresh = !stations.has(ext);
    if (!fresh && o.v5) continue;
    const entry: PyObj = fresh ? new Map(blank()) : obj(stations.get(ext));
    if (fresh) {
      entry.set('id', Number.isInteger(Number(ext)) ? Number(ext) : ext);
      entry.set('name', s.name);
      entry.set('x', pyFloat(0));
      entry.set('y', pyFloat(0));
      stations.set(ext, entry);
      doc.dirty = true;
    }
    put(doc, entry, 'name', s.name);
    if (!s.unplaced && n) {
      if (Math.abs(num(entry.get('x')) - n.x) > 0.0006) put(doc, entry, 'x', pyFloat(r3(n.x)));
      if (Math.abs(num(entry.get('y')) - n.y) > 0.0006) put(doc, entry, 'y', pyFloat(r3(n.y)));
    }
    if (Math.abs(num(entry.get('rotation')) - (s.angle ?? 0)) > 0.0006)
      put(doc, entry, 'rotation', pyFloat(s.angle ?? 0));
    put(doc, entry, 'charging', s.type === 'charge');
    const tags = tagsOf(s, entry.get('station_tags'), str(entry.get('name')));
    if (!same(entry.get('station_tags'), tags)) put(doc, entry, 'station_tags', tags);
  }
  if (!doc.tree.has('map_version')) put(doc, doc.tree, 'map_version', o.version);
  commit(files, doc);
}
