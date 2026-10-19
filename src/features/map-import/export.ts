import { unzipSync, zipSync, type Zippable } from 'fflate';
import type { MapData } from '@/features/map-editor';
import { ATI_FOLDER } from './formats/deploymentManager';
import { patchV2 } from './dm/v2Patch';
import { patchV5 } from './dm/v5Patch';
import { assignStationIds, patchWebui } from './dm/webui';

const UI_FILE = 'webui_map.json';
const enc = (s: string) => new TextEncoder().encode(s);

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
  // stations the file has never seen get their ids now, so every file of the export agrees on them
  const data = assignStationIds(files, dir, structuredClone(o.data)); // a copy: the export writes down the ids it hands out
  const v5 = !!files[dir + 'gmaj.json'] && !!files[dir + 'graph_object_v5.json'];
  patchWebui(files, uiKey ?? dir + UI_FILE, data, { v5, name: o.name, version: o.version });
  if (v5) patchV5(files, dir, data);
  else if (files[dir + 'waypoints.json']) patchV2(files, dir, data);

  const { base: _base, path: _path, source: _source, ...mine } = data; // pictures and the original zip are stored files, not part of the export
  files[`${dir}${ATI_FOLDER}/map.json`] = enc(
    JSON.stringify({
      schema: 1,
      name: o.name,
      version: o.version,
      exportedAt: o.now ?? Date.now(),
      ids: data.stations.map((s) => ({ id: s.id, externalId: s.externalId })),
      ...mine,
    }),
  );

  const z: Zippable = {};
  for (const [k, v] of Object.entries(files)) z[k] = /\.(npz|png|zip)$/i.test(k) ? [v, { level: 0 }] : v; // already compressed
  return zipSync(z, { level: 6 });
}
