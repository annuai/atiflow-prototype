import { z } from 'zod';
import type { ImportedCellStation, ImportedRoad, ImportedStagingArea, ImportedStation } from '../../core/types';

/**
 * The map files a Deployment Manager v5 export adds next to `webui_map.json`: `gmaj.json` (the real stations with their positions, and the roads as lines with a direction),
 * `grid_map_attributes.json` (the same plus the reverse line of every two-way road), `graph_object_v5.json` (the graph derived from those lines) and `staging_areas.json`.
 * `webui_map.json` alone only lists station ids with placeholder names and positions. Everything is read leniently: a missing or odd file leaves its part out, never fails the import.
 */
const num = z.coerce.number().finite();
const point = z.tuple([num, num]);

const lineSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    t1: point,
    t2: point,
    lane_name: z.string().optional(),
    bidirectional: z.boolean().default(false),
    bidirectional_line: z.union([z.string(), z.number()]).nullable().optional(),
    heading_direction: z.string().nullable().optional(),
  })
  .passthrough();
const stationSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    station_name: z.string().optional(),
    pose: z.array(num).min(2),
    orientation: z.string().optional(),
    station_tags: z.array(z.string()).default([]),
  })
  .passthrough();
const attributes = z.object({
  terminal_lines_info: z.record(z.string(), z.unknown()).default({}),
  stations_info: z.record(z.string(), z.unknown()).default({}),
});

export type DmAttributes = z.infer<typeof attributes>;
const json = (b: Uint8Array | undefined): unknown => {
  if (!b) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b));
  } catch {
    return null;
  }
};

/** The lines and stations of `gmaj.json` (preferred) or `grid_map_attributes.json`. Null when neither is there. */
export function readAttributes(gmaj: Uint8Array | undefined, grid: Uint8Array | undefined): DmAttributes | null {
  for (const b of [gmaj, grid]) {
    const p = attributes.safeParse(json(b));
    if (p.success && (Object.keys(p.data.terminal_lines_info).length || Object.keys(p.data.stations_info).length))
      return p.data;
  }
  return null;
}

const deg = (rad: number) => Math.round(((rad * 180) / Math.PI) * 1000) / 1000;
export const parkingName = /^park(ing)?([\s_-]*\d+)?$/i;

/** A station of the attribute files: its real name, position (metres), heading (the file uses radians) and everything else kept under `extra.gmaj`. */
export function attributeStations(a: DmAttributes): Map<string, ImportedStation> {
  const out = new Map<string, ImportedStation>();
  for (const [key, value] of Object.entries(a.stations_info)) {
    const p = stationSchema.safeParse(value);
    if (!p.success) continue;
    const { id, station_name, pose, orientation, station_tags, ...rest } = p.data;
    const name = station_name?.trim() || `Station ${id}`;
    out.set(String(id ?? key), {
      externalId: String(id ?? key),
      name,
      x: pose[0],
      y: pose[1],
      rotation: deg(pose[2] ?? 0),
      type: station_tags.includes('parking') || parkingName.test(name) ? 'park' : 'drop',
      placed: true,
      onLane: orientation === 'on_lane',
      extra: { gmaj: { ...rest, orientation, station_tags, theta: pose[2] ?? 0 } },
    });
  }
  return out;
}

const HEADINGS = ['both', 'forward', 'backward'] as const;

/** The roads: one per line. A two-way road is ONE line flagged `bidirectional`; the extra reverse lines of `grid_map_attributes.json` (they point back at it) are left out. */
export function attributeRoads(a: DmAttributes): ImportedRoad[] {
  const out: ImportedRoad[] = [];
  for (const value of Object.values(a.terminal_lines_info)) {
    const p = lineSchema.safeParse(value);
    if (!p.success) continue;
    const { id, t1, t2, lane_name, bidirectional, bidirectional_line, heading_direction, ...rest } = p.data;
    if (bidirectional_line !== null && bidirectional_line !== undefined) continue; // the reverse half of a two-way road
    if (Math.hypot(t1[0] - t2[0], t1[1] - t2[1]) < 0.05) continue;
    const heading = HEADINGS.find((h) => h === heading_direction) ?? 'both';
    out.push({
      externalId: String(id),
      name: lane_name?.trim() || `Road ${id}`,
      points: [t1, t2],
      oneWay: !bidirectional,
      heading,
      extra: { ...rest, bidirectional, heading_direction },
    });
  }
  return out;
}

const areaMeta = z
  .object({
    name: z.string().optional(),
    x: num,
    y: num,
    rotation: num.default(0),
    rows: num.int().positive(),
    cols: num.int().positive(),
    cell_width: num.positive(),
    cell_height: num.positive(),
    row_spacing: num.default(0),
    col_spacing: num.default(0),
    pickup_drop_logic: z.string().optional(),
    direction: num.default(0),
    station_offset: num.default(0),
    fill_by: z.string().optional(),
    fill_line_order: z.string().optional(),
    fill_cell_order: z.string().optional(),
    empty_by: z.string().optional(),
    arrival_order: z.string().optional(),
    empty_position_by: z.string().optional(),
    empty_line_order: z.string().optional(),
    empty_cell_order: z.string().optional(),
  })
  .passthrough();

const order = (v: string | undefined): 'asc' | 'desc' => (v?.toLowerCase() === 'desc' ? 'desc' : 'asc');
const by = (v: string | undefined): 'row' | 'column' => (v?.toLowerCase().includes('col') ? 'column' : 'row');

/**
 * The staging areas. In the file `x, y` is the CORNER the grid starts from; columns run along the area's direction (`cell_width` long, `col_spacing` apart), rows go to its right-hand side
 * (`cell_height` wide, `row_spacing` apart). Ours puts the point at the centre of the A1 cell, so it moves half a cell in from the corner. (Checked against the file's own station
 * poses for the cells: the A1 pose of ROTR1 lies exactly there.)
 */
export function readStagingAreas(bytes: Uint8Array | undefined): ImportedStagingArea[] {
  const raw = json(bytes);
  if (!raw || typeof raw !== 'object') return [];
  const out: ImportedStagingArea[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = value as {
      metadata?: unknown;
      cells?: unknown;
      row_level_params?: unknown;
      column_level_params?: unknown;
    };
    const m = areaMeta.safeParse(v?.metadata);
    if (!m.success) continue;
    const d = m.data;
    const t = (d.rotation * Math.PI) / 180;
    const dx = Math.cos(t),
      dy = Math.sin(t),
      rx = Math.sin(t),
      ry = -Math.cos(t);
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    out.push({
      externalId: key,
      name: (d.name ?? key).trim() || key,
      rotation: d.rotation,
      x: r3(d.x + (dx * d.cell_width) / 2 + (rx * d.cell_height) / 2),
      y: r3(d.y + (dy * d.cell_width) / 2 + (ry * d.cell_height) / 2),
      rows: d.rows,
      cols: d.cols,
      cellLength: d.cell_width,
      cellWidth: d.cell_height,
      rowGap: d.row_spacing,
      colGap: d.col_spacing,
      retrieval: (d.arrival_order ?? d.pickup_drop_logic)?.toLowerCase() === 'lifo' ? 'lifo' : 'fifo',
      cellAngle: d.direction,
      stationOffset: d.station_offset,
      fill: { by: by(d.fill_by), lines: order(d.fill_line_order), cells: order(d.fill_cell_order) },
      emptyBy: d.empty_by?.toLowerCase() === 'position' ? 'position' : 'arrival',
      emptyPosition: {
        by: by(d.empty_position_by),
        lines: order(d.empty_line_order),
        cells: order(d.empty_cell_order),
      },
      extra: {
        dm: {
          metadata: d,
          cells: v.cells,
          row_level_params: v.row_level_params,
          column_level_params: v.column_level_params,
        },
      },
    });
  }
  return out;
}

/** The graph of `graph_object_v5.json`: its nodes (the dots a route is made of) and, for every station by name, the nodes it is joined to. */
export interface DmGraph {
  nodes: { id: string; x: number; y: number }[];
  stationNodes: Map<string, string[]>;
}
export function readGraph(bytes: Uint8Array | undefined): DmGraph | null {
  const raw = json(bytes) as {
    nodes_info?: Record<string, { pos?: unknown }>;
    stations_info?: Record<string, { associated_nodes?: Record<string, unknown> }>;
  } | null;
  if (!raw || typeof raw !== 'object' || !raw.nodes_info) return null;
  const nodes: DmGraph['nodes'] = [];
  for (const [id, v] of Object.entries(raw.nodes_info)) {
    const p = point.safeParse(v?.pos);
    if (p.success) nodes.push({ id, x: p.data[0], y: p.data[1] });
  }
  const stationNodes = new Map<string, string[]>();
  for (const [name, v] of Object.entries(raw.stations_info ?? {}))
    stationNodes.set(name, Object.keys(v?.associated_nodes ?? {}));
  return nodes.length ? { nodes, stationNodes } : null;
}

/**
 * The station of every cell of the staging areas: `cells` of an area lists, row by row, the id and name of each cell's station; the attribute file holds the station itself (pose, lane,
 * nodes with their roles) and the graph the nodes it is joined to. Cells the files do not know are null.
 */
export function attachCellStations(
  areas: ImportedStagingArea[],
  attributes: Uint8Array | undefined,
  graph: { stationNodes: Map<string, string[]> } | null,
): void {
  const raw = json(attributes) as { stations_info?: Record<string, unknown> } | null;
  const info = raw?.stations_info;
  if (!info) return;
  for (const a of areas) {
    const rows = (a.extra.dm as { cells?: unknown } | undefined)?.cells;
    if (!Array.isArray(rows)) continue;
    a.cellStations = rows.map((row) =>
      (Array.isArray(row) ? row : []).map((c: { station_id?: unknown }): ImportedCellStation | null => {
        const e = info[String(c?.station_id)] as
          { station_name?: string; pose?: number[]; orientation?: string } | undefined;
        if (!e || !Array.isArray(e.pose) || e.pose.length < 2) return null;
        const name = String(e.station_name ?? '');
        return {
          name,
          pose: [Number(e.pose[0]), Number(e.pose[1]), Number(e.pose[2] ?? 0)],
          onLane: e.orientation === 'on_lane',
          entry: e,
          nodeIds: graph?.stationNodes.get(name),
        };
      }),
    );
  }
}
