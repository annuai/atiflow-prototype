import type { MapData, StagingAreaDef } from '@/features/map-editor';
import { pyFloat, type PyObj, type PyValue } from './pyjson';
import { co, list, num, obj, put, r3, str, type Doc } from './tree';

/** Staging areas written back into `staging_areas.json` (and the station of every cell in `grid_map_attributes.json` / `graph_object_v5.json`). */
type P = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const letter = (c: number): string => {
  let s = '',
    n = c;
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
const num3 = (v: number) => pyFloat(r3(v));

/** The file's corner point of an area (ours is the centre of the A1 cell, half a cell in). */
function corner(a: StagingAreaDef): P {
  const t = rad(a.rotation);
  return [
    a.x - (Math.cos(t) * a.cellLength) / 2 - (Math.sin(t) * a.cellWidth) / 2,
    a.y - (Math.sin(t) * a.cellLength) / 2 + (Math.cos(t) * a.cellWidth) / 2,
  ];
}
/** Where the robot stands at a cell: the centre of the cell, facing along the area. */
function cellPose(a: StagingAreaDef, row: number, col: number): [number, number, number] {
  const t = rad(a.rotation);
  const along = (col - 1) * (a.cellLength + (a.colGap ?? 0)),
    across = (row - 1) * (a.cellWidth + (a.rowGap ?? 0));
  const [cx, cy] = [a.x + Math.cos(t) * along + Math.sin(t) * across, a.y + Math.sin(t) * along - Math.cos(t) * across];
  let th = t;
  if (th > Math.PI) th -= 2 * Math.PI;
  return [cx, cy, th];
}
const SEQ = ({ by, lines, cells }: NonNullable<MapData['stagingAreas'][number]['fill']>) => ({
  by: by === 'column' ? 'by_column' : 'by_row',
  lines,
  cells,
});

const DEFAULT_SEQ = { by: 'row', lines: 'asc', cells: 'asc' } as const;
const OPTIONAL_DEFAULT: Record<string, string | undefined> = {
  arrival_order: 'fifo',
  direction: '0',
  station_offset: '0',
  fill_by: 'by_row',
  fill_line_order: 'asc',
  fill_cell_order: 'asc',
  empty_by: 'arrival',
  empty_position_by: 'by_row',
  empty_line_order: 'asc',
  empty_cell_order: 'asc',
};

/** The settings of an area as the Deployment Manager's file writes them. */
function metaFields(a: StagingAreaDef, cx: number, cy: number): [string, PyValue][] {
  return [
    ['name', a.name],
    ['x', num3(cx)],
    ['y', num3(cy)],
    ['rotation', pyFloat(Math.round(a.rotation * 1000) / 1000)],
    ['rows', a.rows],
    ['cols', a.cols],
    ['cell_width', pyFloat(a.cellLength)],
    ['cell_height', pyFloat(a.cellWidth)],
    ['row_spacing', pyFloat(a.rowGap ?? 0)],
    ['col_spacing', pyFloat(a.colGap ?? 0)],
    ['total_width', num3(a.cols * a.cellLength + (a.cols - 1) * (a.colGap ?? 0))],
    ['total_height', num3(a.rows * a.cellWidth + (a.rows - 1) * (a.rowGap ?? 0))],
    ['pickup_drop_logic', (a.retrieval ?? 'fifo').toUpperCase()],
    ['arrival_order', (a.retrieval ?? 'fifo').toLowerCase()],
    ['direction', pyFloat(a.cellAngle ?? 0)],
    ['station_offset', pyFloat(a.stationOffset ?? 0)],
    ['fill_by', SEQ(a.fill ?? DEFAULT_SEQ).by],
    ['fill_line_order', (a.fill ?? DEFAULT_SEQ).lines],
    ['fill_cell_order', (a.fill ?? DEFAULT_SEQ).cells],
    ['empty_by', a.emptyBy ?? 'arrival'],
    ['empty_position_by', SEQ(a.emptyPosition ?? DEFAULT_SEQ).by],
    ['empty_line_order', (a.emptyPosition ?? DEFAULT_SEQ).lines],
    ['empty_cell_order', (a.emptyPosition ?? DEFAULT_SEQ).cells],
  ];
}

/** True when writing this setting would change nothing that matters: the file lacks it and ours is the default, it already says the same, or it is a total that only follows a size change. */
function keepAsIs(meta: PyObj, k: string, v: PyValue, a: StagingAreaDef, gridChanged: boolean): boolean {
  const text = typeof v === 'object' ? String((v as { value?: unknown }).value ?? v) : String(v);
  if (!meta.has(k) && OPTIONAL_DEFAULT[k] !== undefined && OPTIONAL_DEFAULT[k] === text) return true;
  if (k === 'arrival_order' && !meta.has(k) && str(meta.get('pickup_drop_logic')).toLowerCase() === v) return true;
  if (k === 'pickup_drop_logic' && str(meta.get(k)).toLowerCase() === (a.retrieval ?? 'fifo')) return true;
  // the totals also count aisles between rows, so they are only worked out again when the size of the grid itself changed
  return ['total_width', 'total_height'].includes(k) && !gridChanged;
}

export function patchStaging(
  staging: Doc | null,
  data: MapData,
  docs: { gmaj: Doc; attrs: Doc | null; graph: Doc },
): void {
  if (!staging) return;
  const { attrs, graph } = docs;
  const areas = staging.tree;
  const attrStations = attrs ? obj(attrs.tree.get('stations_info')) : new Map<string, PyValue>();
  const graphStations = obj(graph.tree.get('stations_info'));
  const ours = new Map(
    data.stagingAreas.flatMap((a) => {
      const ext = (a.extra?.dm as { externalId?: unknown } | undefined)?.externalId;
      return ext === undefined ? [] : [[String(ext), a] as const];
    }),
  );
  const cellNames = (key: string) =>
    [...attrStations].filter(
      ([, v]) => obj(v).get('type') === 'staging_area' && str(obj(v).get('station_name')).startsWith(key + '_'),
    );
  for (const [key, area] of [...areas]) {
    const a = ours.get(key);
    if (!a) {
      // the area was deleted: its cells go with it
      areas.delete(key);
      staging.dirty = true;
      for (const [id, v] of cellNames(key)) {
        attrStations.delete(id);
        graphStations.delete(str(obj(v).get('station_name')));
      }
      if (attrs) attrs.dirty = true;
      graph.dirty = true;
      continue;
    }
    const meta = obj(obj(area).get('metadata'));
    const [cx, cy] = corner(a);
    const old = {
      x: num(meta.get('x')),
      y: num(meta.get('y')),
      r: num(meta.get('rotation')),
      rows: num(meta.get('rows')),
      cols: num(meta.get('cols')),
    };
    const next = metaFields(a, cx, cy);
    const moved =
      Math.abs(old.x - r3(cx)) > 0.0006 || Math.abs(old.y - r3(cy)) > 0.0006 || Math.abs(old.r - a.rotation) > 0.0006;
    const resized = old.rows !== a.rows || old.cols !== a.cols;
    const gridChanged =
      resized ||
      ['cell_width', 'cell_height', 'row_spacing', 'col_spacing'].some(
        (k, i) => Math.abs(num(meta.get(k)) - [a.cellLength, a.cellWidth, a.rowGap ?? 0, a.colGap ?? 0][i]) > 0.0006,
      );
    for (const [k, v] of next) if (!keepAsIs(meta, k, v, a, gridChanged)) put(staging, meta, k, v);
    // the stations of the cells follow the area when it is moved or turned (rigidly: the same poses relative to it)
    if (moved && !resized) {
      const dt = rad(a.rotation - old.r);
      const rot = (p: P): P => {
        const dx = p[0] - old.x,
          dy = p[1] - old.y;
        return [cx + dx * Math.cos(dt) - dy * Math.sin(dt), cy + dx * Math.sin(dt) + dy * Math.cos(dt)];
      };
      const move = (doc: Doc | null, entry: PyObj) => {
        if (!doc) return;
        const p = list(entry.get('pose'));
        const q = rot([num(p[0]), num(p[1])]);
        let th = num(p[2]) + dt;
        if (th > Math.PI) th -= 2 * Math.PI;
        if (th < -Math.PI) th += 2 * Math.PI;
        put(doc, entry, 'pose', [co(q[0]), co(q[1]), num3(th)]);
      };
      for (const [, v] of cellNames(key)) {
        move(attrs, obj(v));
        const g = graphStations.get(str(obj(v).get('station_name')));
        if (g) move(graph, obj(g));
      }
    }
    if (resized) resizeCells(staging, docs, key, a, obj(area), attrStations, graphStations, old);
  }
}

/** The number of rows or columns changed: cells that are gone lose their stations, new cells get a station at their centre. */
function resizeCells(
  staging: Doc,
  docs: { attrs: Doc | null; graph: Doc },
  key: string,
  a: StagingAreaDef,
  area: PyObj,
  attrStations: PyObj,
  graphStations: PyObj,
  old: { rows: number; cols: number },
) {
  const { attrs, graph } = docs;
  const id = num(obj(area.get('metadata')).get('staging_id'));
  const rows = list(area.get('cells'));
  const fresh: PyValue[] = [];
  const wanted = new Set<string>();
  for (let r = 1; r <= a.rows; r++) {
    const row = list(rows[r - 1] ?? []);
    const out: PyValue[] = [];
    for (let c = 1; c <= a.cols; c++) {
      const had = r <= old.rows && c <= old.cols ? row[c - 1] : undefined;
      const name = `${key}_${letter(c)}${r}`;
      wanted.add(name);
      if (had) {
        out.push(had);
        continue;
      }
      const station = id * 100000 + (r - 1) * a.cols + c;
      out.push(
        new Map<string, PyValue>([
          ['station_id', station],
          ['station_name', name],
          ['tags', []],
        ]),
      );
      const pose = cellPose(a, r, c);
      const poseV: PyValue = [co(pose[0]), co(pose[1]), num3(pose[2])];
      attrStations.set(
        String(station),
        new Map<string, PyValue>([
          ['id', station],
          ['graph_node_coords', null],
          ['is_transit_allowed', true],
          ['orientation', 'off_lane'],
          ['pose', poseV],
          ['station_lane', null],
          ['station_lane_unpark', null],
          ['station_name', name],
          ['station_tags', []],
          ['type', 'staging_area'],
          ['unpark_merge', true],
          ['extra_args', new Map()],
          ['nodes', []],
        ]),
      );
      graphStations.set(
        name,
        new Map<string, PyValue>([
          ['pose', poseV],
          ['tags', []],
          ['properties', new Map()],
          ['orientation', 'off_lane'],
          ['name', name],
          ['graph_node_coords', null],
          ['associated_nodes', new Map()],
        ]),
      );
    }
    fresh.push(out);
  }
  for (const [sid, v] of [...attrStations])
    if (
      obj(v).get('type') === 'staging_area' &&
      str(obj(v).get('station_name')).startsWith(key + '_') &&
      !wanted.has(str(obj(v).get('station_name')))
    ) {
      attrStations.delete(sid);
      graphStations.delete(str(obj(v).get('station_name')));
    }
  area.set('cells', fresh);
  staging.dirty = true;
  if (attrs) attrs.dirty = true;
  graph.dirty = true;
}
