import { z } from 'zod';
import type { StationType } from '@/core/types';
import { contentBox, crop, levelsToAlpha, removeSpecks } from '../../core/grid';
import { readNpy } from '../../core/npy';
import { detectOrientation } from '../../core/orient';
import { MAX_POOLED_CELLS, poolNpz, type PooledGrid } from '../../core/pool';
import { readZip, findEntry } from '../../core/zip';
import { readGates, readRoutes } from './v2';
import {
  attachCellStations,
  attributeRoads,
  attributeStations,
  readAttributes,
  readGraph,
  readStagingAreas,
} from './v5';
import {
  ImportError,
  type Entries,
  type GridImage,
  type ImportedStation,
  type ImportWarning,
  type MapImporter,
} from '../../core/types';

/** Names of the files of a Deployment Manager map folder. A better export may add files; unknown ones are listed, never an error. */
const FILES = {
  ui: 'webui_map.json',
  meta: 'yelli_meta.json',
  grid: 'yelli_map.npz',
  poses: 'yelli_poses.npy',
  gmaj: 'gmaj.json',
  attributes: 'grid_map_attributes.json',
  staging: 'staging_areas.json',
};
const KNOWN = [
  FILES.ui,
  FILES.meta,
  FILES.grid,
  FILES.poses,
  FILES.gmaj,
  FILES.attributes,
  FILES.staging,
  'waypoints.json', // point-to-point (v2) routes
  'graph_object_v5.json', // the graph derived from the lines of gmaj.json: the roads are read from those lines
  'ez.json',
  'map_features.json',
  'yelli_frames.npy',
  'yelli_map.png',
  'webui_map.png',
  'webui_map_preview.webp',
  'map.json',
];
/** The folder this app writes its own files into: the Deployment Manager ignores it. */
export const ATI_FOLDER = 'ati_flow';

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

function readStations(
  raw: Record<string, unknown>,
  attrs: Map<string, ImportedStation>,
  warnings: ImportWarning[],
): ImportedStation[] {
  const list: ImportedStation[] = [];
  const seen = new Set<string>();
  const positioned = new Set<ImportedStation>(); // stations whose position the attribute files gave
  for (const [key, value] of Object.entries(raw)) {
    const p = stationSchema.safeParse(value);
    if (!p.success) {
      warnings.push({ code: 'station.invalid', level: 'warn', args: { id: key } });
      continue;
    }
    const { id, name, x, y, rotation, charging, ...rest } = p.data;
    const externalId = String(id);
    seen.add(externalId);
    const real = attrs.get(externalId); // the attribute files know the real name, position and heading; webui_map.json may only hold a placeholder
    const station: ImportedStation = {
      externalId,
      name: real?.name ?? (name?.trim() || `Station ${id}`),
      x: real?.x ?? x,
      y: real?.y ?? y,
      rotation: real?.rotation ?? rotation,
      type: charging ? 'charge' : (real?.type ?? stationType({ charging, station_tags: p.data.station_tags })),
      placed: true,
      ...(real ? { onLane: real.onLane } : {}),
      extra: { ...rest, charging, ...(real?.extra ?? {}) },
    };
    if (real) positioned.add(station);
    list.push(station);
  }
  for (const [id, s] of attrs)
    if (!seen.has(id)) {
      list.push(s); // a station only the attribute files have
      positioned.add(s);
    }
  // several stations on the exact same point (the origin, in a fresh export) have no real position: one alone may really stand there
  const at = new Map<string, number>();
  for (const s of list) if (!positioned.has(s)) at.set(`${s.x},${s.y}`, (at.get(`${s.x},${s.y}`) ?? 0) + 1);
  for (const s of list) if (!positioned.has(s) && (at.get(`${s.x},${s.y}`) ?? 0) > 1) s.placed = false;
  return list;
}

/** The pooled picture of the grid: streamed when it is a plain table of bytes (any size), read the ordinary way otherwise. */
function pooledGrid(gridBytes: Uint8Array): PooledGrid {
  const streamed = poolNpz(gridBytes);
  if (streamed) return streamed;
  const inner = readZip(gridBytes, { entries: 8, entryBytes: 300 * 1024 * 1024, totalBytes: 300 * 1024 * 1024 }); // the .npz is a zip of .npy files
  const first = Object.keys(inner).find((k) => k.endsWith('.npy'));
  if (!first) throw new ImportError('grid.invalid', 'yelli_map.npz holds no array');
  const a = readNpy(inner[first]);
  if (a.shape.length !== 2) throw new ImportError('grid.invalid', 'The map grid is not two dimensional');
  const [rows, cols] = a.shape;
  if (rows * cols > MAX_POOLED_CELLS) throw new ImportError('npy.tooBig', 'The map grid is too large to open');
  const levels = new Uint8Array(rows * cols);
  let max = 0;
  for (let i = 0; i < levels.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(a.data[i])));
    levels[i] = v;
    if (v > max) max = v;
  }
  return { rows, cols, factor: 1, poolRows: rows, poolCols: cols, levels, max };
}

/** The picture of a pooled grid the right way up: x to the right, y up (row 0 at the top), the origin cell in `GridImage` terms. */
function upright(
  p: PooledGrid,
  o: 'rows-y' | 'x-rows',
  alpha: Uint8Array,
  res: number,
  origin: [number, number],
): GridImage {
  const [ox, oy] = origin;
  if (o === 'rows-y')
    return { res, width: p.poolCols, height: p.poolRows, originCol: ox / p.factor, originRow: oy / p.factor, alpha };
  // axis 0 is x and axis 1 is y pointing up: turn it so that rows run down
  const out = new Uint8Array(alpha.length);
  for (let a = 0; a < p.poolRows; a++)
    for (let b = 0; b < p.poolCols; b++) out[(p.poolCols - 1 - b) * p.poolRows + a] = alpha[a * p.poolCols + b];
  return {
    res,
    width: p.poolRows,
    height: p.poolCols,
    originCol: ox / p.factor,
    originRow: p.poolCols - 1 - oy / p.factor,
    alpha: out,
  };
}

function readGrid(
  entries: Entries,
  warnings: ImportWarning[],
  minLevel: number,
  minSpeck: number,
  probes: [number, number][],
) {
  const metaBytes = findEntry(entries, FILES.meta),
    gridBytes = findEntry(entries, FILES.grid);
  const none = { grid: null as GridImage | null, cells: 0, kept: 0, removed: 0, factor: 1 };
  if (!metaBytes || !gridBytes) return none;
  const meta = metaSchema.safeParse(json(metaBytes));
  if (!meta.success) throw new ImportError('meta.invalid', 'yelli_meta.json is missing its grid resolution or origin');
  const pooled = pooledGrid(gridBytes);
  const origin = meta.data.map_origins[0] as [number, number];
  const cells = pooled.rows * pooled.cols;
  const { orientation } = detectOrientation(pooled, meta.data.grid_res, origin, probes, minLevel);
  const [ox, oy] = origin;
  const [alongX, alongY] = orientation === 'rows-y' ? [pooled.cols, pooled.rows] : [pooled.rows, pooled.cols];
  if (ox < 0 || oy < 0 || ox >= alongX || oy >= alongY)
    warnings.push({ code: 'origin.outside', level: 'warn', args: { col: ox, row: oy } });
  const alpha = levelsToAlpha(pooled.levels, minLevel, Math.max(pooled.max, minLevel + 1));
  const res = meta.data.grid_res * pooled.factor;
  const full = upright(pooled, orientation, alpha, res, origin);
  const box = contentBox(full.alpha, full.width, full.height);
  if (!box) {
    warnings.push({ code: 'grid.empty', level: 'warn' });
    return { ...none, cells };
  }
  if (pooled.factor > 1)
    warnings.push({
      code: 'grid.coarse',
      level: 'info',
      args: { cm: Math.round(res * 100), from: Math.round(meta.data.grid_res * 100) },
    });
  // cut out what holds something first, clean it, then cut tight again so the stored picture is as small as it can be
  let g = crop(full, box, 8);
  // a speck of `minSpeck` cells at full resolution is `minSpeck / factor^2` cells once pooled (never fewer than 3: a single block is a smudge)
  const speck = pooled.factor > 1 ? Math.max(3, Math.round(minSpeck / (pooled.factor * pooled.factor))) : minSpeck;
  const removed = removeSpecks(g.alpha, g.width, g.height, speck);
  const tight = contentBox(g.alpha, g.width, g.height);
  if (tight) g = crop(g, tight, 25);
  let kept = 0;
  for (let i = 0; i < g.alpha.length; i++) if (g.alpha[i]) kept++;
  return { grid: g, cells, kept, removed, factor: pooled.factor };
}

/** What an earlier export of this app left in `ati_flow/map.json` (a damaged file is only a warning: the Deployment Manager's files are enough to open the map). */
function readAti(entries: Entries, warnings: ImportWarning[]): Record<string, unknown> | null {
  const key = Object.keys(entries).find((p) => p === `${ATI_FOLDER}/map.json` || p.endsWith(`/${ATI_FOLDER}/map.json`));
  if (!key) return null;
  try {
    const j = JSON.parse(new TextDecoder().decode(entries[key]));
    return j && typeof j === 'object' && j.schema === 1 ? (j as Record<string, unknown>) : null;
  } catch {
    warnings.push({ code: 'ati.invalid', level: 'info' });
    return null;
  }
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
    const waypoints = findEntry(entries, 'waypoints.json');
    const layout = waypoints ? 'v2' : findEntry(entries, FILES.gmaj) ? 'v5' : 'basic';
    // a v2 map's attribute file lists the pieces of its routes, not roads: only v5 reads it
    const attrs =
      layout === 'v2' ? null : readAttributes(findEntry(entries, FILES.gmaj), findEntry(entries, FILES.attributes));
    const stations = readStations(ui.data.stations, attrs ? attributeStations(attrs) : new Map(), warnings);
    if (layout === 'v2') for (const s of stations) s.onLane = true; // every station of a point-to-point map is on a route
    const path = readPath(entries, warnings);
    const at = new Map(stations.map((s) => [s.externalId, s]));
    const roads =
      layout === 'v2' ? readRoutes(json(waypoints!), (id) => at.get(id)).roads : attrs ? attributeRoads(attrs) : [];
    const gates = (() => {
      const b = findEntry(entries, 'ez.json');
      try {
        return b ? readGates(json(b)) : [];
      } catch {
        return [];
      }
    })();
    const graph = readGraph(findEntry(entries, 'graph_object_v5.json'));
    for (const st of stations) st.nodeIds = graph?.stationNodes.get(st.name);
    const stagingAreas = readStagingAreas(findEntry(entries, FILES.staging));
    if (layout === 'v5') attachCellStations(stagingAreas, findEntry(entries, FILES.attributes), graph);
    // what proves which way round the grid is stored: the path the robot drove, else where the stations and roads are
    const probes: [number, number][] = path.length
      ? path.filter(([x, y]) => x !== 0 || y !== 0)
      : [
          ...stations.filter((s) => s.placed).map((s): [number, number] => [s.x, s.y]),
          ...roads.flatMap((r) => r.points),
        ];
    const { grid, cells, kept, removed, factor } = readGrid(
      entries,
      warnings,
      options.minLevel ?? 4,
      options.minSpeck ?? 30,
      probes,
    );
    if (!grid) warnings.push({ code: 'grid.missing', level: 'warn' });
    const unplaced = stations.filter((s) => !s.placed).length;
    if (unplaced) warnings.push({ code: 'station.unplaced', level: 'warn', args: { n: unplaced } });
    const names = new Set<string>();
    for (const s of stations) {
      const k = s.name.toLowerCase();
      if (names.has(k)) warnings.push({ code: 'station.duplicateName', level: 'warn', args: { name: s.name } });
      names.add(k);
    }
    if (!roads.length) warnings.push({ code: 'content.noRoutes', level: 'info' });
    const ati = readAti(entries, warnings);
    const unread = Object.keys(entries).filter((p) => !KNOWN.includes(p.split('/').pop() ?? p));
    return {
      format: 'deployment-manager',
      name: ui.data.map_name.trim(),
      version: ui.data.map_version === undefined ? null : String(ui.data.map_version),
      stations,
      layout,
      gates,
      roads,
      graphNodes: graph?.nodes ?? [],
      stagingAreas,
      path,
      grid,
      ati,
      unread,
      stats: { gridCells: cells, keptCells: kept, removedSpecks: removed, pathPoints: path.length, gridFactor: factor },
      warnings,
    };
  },
};
