import { z } from 'zod';
import type { StationType } from '@/core/types';
import { contentBox, crop, levelsToAlpha, removeSpecks } from '../../core/grid';
import { readNpy } from '../../core/npy';
import { readZip, findEntry } from '../../core/zip';
import {
  ImportError,
  type Entries,
  type GridImage,
  type ImportedStation,
  type ImportWarning,
  type MapImporter,
} from '../../core/types';

/** Names of the files of a Deployment Manager map folder. A better export may add files; unknown ones are listed, never an error. */
const FILES = { ui: 'webui_map.json', meta: 'yelli_meta.json', grid: 'yelli_map.npz', poses: 'yelli_poses.npy' };
const KNOWN = [FILES.ui, FILES.meta, FILES.grid, FILES.poses, 'yelli_frames.npy', 'yelli_map.png', 'webui_map.png'];

const num = z.coerce.number().finite();
const stationSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    name: z.string().optional(),
    x: num.default(0),
    y: num.default(0),
    rotation: num.default(0),
    charging: z.boolean().default(false),
    station_tags: z.array(z.string()).default([]),
  })
  .passthrough();
const uiSchema = z
  .object({
    map_name: z.string().default(''),
    map_version: z.union([z.string(), z.number()]).optional(),
    stations: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough();
const metaSchema = z
  .object({
    grid_res: num.positive(),
    num_lookup_levels: num.positive().optional(),
    map_origins: z.array(z.tuple([num, num])).min(1),
  })
  .passthrough();

const json = (b: Uint8Array) => {
  try {
    return JSON.parse(new TextDecoder().decode(b));
  } catch {
    throw new ImportError('json.invalid', 'A map file is not valid JSON');
  }
};

/** The type a station gets: a charger, a parking spot (tag `parking`) or an ordinary work station. */
export const stationType = (s: { charging: boolean; station_tags: string[] }): StationType =>
  s.charging ? 'charge' : s.station_tags.includes('parking') ? 'park' : 'drop';

function readStations(raw: Record<string, unknown>, warnings: ImportWarning[]): ImportedStation[] {
  const list: ImportedStation[] = [];
  for (const [key, value] of Object.entries(raw)) {
    const p = stationSchema.safeParse(value);
    if (!p.success) {
      warnings.push({ code: 'station.invalid', level: 'warn', args: { id: key } });
      continue;
    }
    const { id, name, x, y, rotation, charging, ...rest } = p.data;
    list.push({
      externalId: String(id),
      name: name?.trim() || `Station ${id}`,
      x,
      y,
      rotation,
      type: stationType({ charging, station_tags: p.data.station_tags }),
      placed: true,
      extra: { ...rest, charging },
    });
  }
  // several stations on the exact same point (the origin, in a fresh export) have no real position: one alone may really stand there
  const at = new Map<string, number>();
  for (const s of list) at.set(`${s.x},${s.y}`, (at.get(`${s.x},${s.y}`) ?? 0) + 1);
  for (const s of list) if ((at.get(`${s.x},${s.y}`) ?? 0) > 1) s.placed = false;
  return list;
}

function readGrid(entries: Entries, warnings: ImportWarning[], minLevel: number, minSpeck: number) {
  const metaBytes = findEntry(entries, FILES.meta),
    gridBytes = findEntry(entries, FILES.grid);
  if (!metaBytes || !gridBytes) return { grid: null as GridImage | null, cells: 0, kept: 0, removed: 0 };
  const meta = metaSchema.safeParse(json(metaBytes));
  if (!meta.success) throw new ImportError('meta.invalid', 'yelli_meta.json is missing its grid resolution or origin');
  const inner = readZip(gridBytes, { entries: 8, entryBytes: 300 * 1024 * 1024, totalBytes: 300 * 1024 * 1024 }); // the .npz is a zip of .npy files
  const first = Object.keys(inner).find((k) => k.endsWith('.npy'));
  if (!first) throw new ImportError('grid.invalid', 'yelli_map.npz holds no array');
  const a = readNpy(inner[first]);
  if (a.shape.length !== 2) throw new ImportError('grid.invalid', 'The map grid is not two dimensional');
  const [height, width] = a.shape;
  const [ox, oy] = meta.data.map_origins[0];
  if (ox < 0 || oy < 0 || ox >= width || oy >= height)
    warnings.push({ code: 'origin.outside', level: 'warn', args: { col: ox, row: oy } });
  let max = 0;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] > max) max = a.data[i];
  const alpha = levelsToAlpha(a.data, minLevel, Math.max(max, minLevel + 1));
  const full: GridImage = { res: meta.data.grid_res, width, height, originCol: ox, originRow: oy, alpha };
  const box = contentBox(alpha, width, height);
  if (!box) {
    warnings.push({ code: 'grid.empty', level: 'warn' });
    return { grid: null, cells: width * height, kept: 0, removed: 0 };
  }
  // cut out what holds something first (the sample is 82% empty), clean it, then cut tight again so the stored picture is as small as it can be
  let g = crop(full, box, 8);
  const removed = removeSpecks(g.alpha, g.width, g.height, minSpeck);
  const tight = contentBox(g.alpha, g.width, g.height);
  if (tight) g = crop(g, tight, 25);
  let kept = 0;
  for (let i = 0; i < g.alpha.length; i++) if (g.alpha[i]) kept++;
  return { grid: g, cells: width * height, kept, removed };
}

function readPath(entries: Entries, warnings: ImportWarning[]): [number, number][] {
  const b = findEntry(entries, FILES.poses);
  if (!b) return [];
  try {
    const a = readNpy(b);
    if (a.shape.length !== 2 || a.shape[1] < 2) throw new ImportError('poses.invalid', 'bad poses');
    const out: [number, number][] = [];
    for (let i = 0; i < a.shape[0]; i++) out.push([a.data[i * a.shape[1]], a.data[i * a.shape[1] + 1]]);
    return out;
  } catch {
    warnings.push({ code: 'poses.invalid', level: 'info' });
    return [];
  }
}

/** The Deployment Manager's map folder: `webui_map.json` (name, version, stations) + `yelli_*` (the lidar grid, its origin and the path the robot drove while mapping). */
export const deploymentManager: MapImporter = {
  id: 'deployment-manager',
  detect(entries) {
    const ui = !!findEntry(entries, FILES.ui),
      grid = !!findEntry(entries, FILES.grid);
    return ui && grid ? 1 : ui || grid ? 0.5 : 0;
  },
  parse(entries, options) {
    const warnings: ImportWarning[] = [];
    const uiBytes = findEntry(entries, FILES.ui);
    if (!uiBytes) throw new ImportError('ui.missing', 'webui_map.json is missing');
    const ui = uiSchema.safeParse(json(uiBytes));
    if (!ui.success) throw new ImportError('ui.invalid', 'webui_map.json is not a map description');
    const stations = readStations(ui.data.stations, warnings);
    const { grid, cells, kept, removed } = readGrid(entries, warnings, options.minLevel ?? 4, options.minSpeck ?? 30);
    if (!grid) warnings.push({ code: 'grid.missing', level: 'warn' });
    const path = readPath(entries, warnings);
    const unplaced = stations.filter((s) => !s.placed).length;
    if (unplaced) warnings.push({ code: 'station.unplaced', level: 'warn', args: { n: unplaced } });
    const names = new Set<string>();
    for (const s of stations) {
      const k = s.name.toLowerCase();
      if (names.has(k)) warnings.push({ code: 'station.duplicateName', level: 'warn', args: { name: s.name } });
      names.add(k);
    }
    warnings.push({ code: 'content.noRoutes', level: 'info' });
    const unread = Object.keys(entries).filter((p) => !KNOWN.includes(p.split('/').pop() ?? p));
    return {
      format: 'deployment-manager',
      name: ui.data.map_name.trim(),
      version: ui.data.map_version === undefined ? null : String(ui.data.map_version),
      stations,
      path,
      grid,
      unread,
      stats: { gridCells: cells, keptCells: kept, removedSpecks: removed, pathPoints: path.length },
      warnings,
    };
  },
};
