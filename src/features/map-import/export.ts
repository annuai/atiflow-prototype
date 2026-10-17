import { unzipSync, zipSync, type Zippable } from 'fflate';
import type { MapData, MapStation } from '@/features/map-editor';
import { ATI_FOLDER } from './formats/deploymentManager';

const UI_FILE = 'webui_map.json';
const dec = (b: Uint8Array) => new TextDecoder().decode(b);
const enc = (s: string) => new TextEncoder().encode(s);
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The station fields a new station gets in the Deployment Manager (what its own "add station" writes). */
const BLANK_STATION = {
  rotation: 0,
  charging: false,
  inplace: true,
  clockwise: 0,
  three_point_turn: {
    enable: false,
    start_direction: 'left',
    start_action: 'forward',
    aisle_width: 0,
    aisle_length: 0,
  },
  common_dispatch_station: false,
  post_process: false,
  station_tags: ['dispatch_not_reqd'],
  hidden: false,
  orientation: 'null',
};

/** The tags a station has after our edits: its own tags, with `parking` following the station type. */
function tagsOf(s: MapStation, old: unknown): string[] {
  const tags = (
    Array.isArray(old) ? old.filter((t): t is string => typeof t === 'string') : BLANK_STATION.station_tags
  ).filter((t) => t !== 'parking');
  return s.type === 'park' ? [...tags, 'parking'] : tags;
}

/**
 * Writes a map as a zip the Deployment Manager can open: the zip it was imported from, with the stations of `webui_map.json` brought up to date (position, name, angle, charger / parking),
 * every other file byte for byte as it was, and OUR data (roads, zones, staging areas, structure, DWG layer) in its own `ati_flow/` folder, which the Deployment Manager ignores and our
 * importer reads back. Without the original zip a minimal folder is made. Stations without a position stay where they were (the origin).
 */
export function exportMapZip(o: {
  original: Uint8Array | null;
  data: MapData;
  name: string;
  version: string;
  now?: number;
}): Uint8Array {
  const files: Record<string, Uint8Array> = o.original
    ? unzipSync(o.original, { filter: (f) => !/(^|\/)(__MACOSX|\.)/.test(f.name) && !f.name.endsWith('/') })
    : {};
  const uiKey = Object.keys(files).find((p) => p === UI_FILE || p.endsWith('/' + UI_FILE));
  const dir = uiKey ? uiKey.slice(0, uiKey.length - UI_FILE.length) : 'map/';
  const ui: Record<string, unknown> = uiKey
    ? JSON.parse(dec(files[uiKey]))
    : { map_name: o.name, trip_type: 'multiple', maps: {}, map_version: o.version };
  const old = (ui.stations ?? {}) as Record<string, Record<string, unknown>>;

  let next = Math.max(0, ...Object.keys(old).map((k) => Number(k) || 0));
  const nodes = new Map(o.data.nodes.map((n) => [n.id, n]));
  const stations: Record<string, unknown> = {};
  const ours: { id: string; externalId: string }[] = [];
  for (const s of o.data.stations) {
    const ext = s.externalId ?? String(++next);
    const was = old[ext] ?? {};
    const n = nodes.get(s.nodeId);
    const numeric = typeof was.id === 'number' || !(ext in old);
    stations[ext] = {
      ...BLANK_STATION,
      ...was,
      ...(s.extra ?? {}),
      id: numeric ? Number(ext) : ext,
      name: s.name,
      x: s.unplaced ? (was.x ?? 0) : r3(n?.x ?? 0),
      y: s.unplaced ? (was.y ?? 0) : r3(n?.y ?? 0),
      rotation: s.angle ?? 0,
      charging: s.type === 'charge',
      station_tags: tagsOf(s, (s.extra ?? was).station_tags),
    };
    ours.push({ id: s.id, externalId: ext });
  }
  ui.stations = stations;
  if (uiKey) ui.map_version = ui.map_version ?? o.version;
  files[uiKey ?? dir + UI_FILE] = enc(JSON.stringify(ui, null, 4));

  const { base: _base, path: _path, source: _source, ...mine } = o.data; // pictures and the original zip are stored files, not part of the export
  files[`${dir}${ATI_FOLDER}/map.json`] = enc(
    JSON.stringify({
      schema: 1,
      name: o.name,
      version: o.version,
      exportedAt: o.now ?? Date.now(),
      ids: ours,
      ...mine,
    }),
  );

  const z: Zippable = {};
  for (const [k, v] of Object.entries(files)) z[k] = /\.(npz|png|zip)$/i.test(k) ? [v, { level: 0 }] : v; // already compressed
  return zipSync(z, { level: 6 });
}
