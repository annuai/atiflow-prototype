import { cellCenterOf, type MapData, type StagingAreaDef } from '@/features/map-editor';
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

/** The height of the rows of an area with its aisles, as the file's `total_height` counts it. */
const rowsSpanOf = (a: StagingAreaDef) =>
  a.rows * a.cellWidth +
  (a.rows - 1) * (a.rowGap ?? 0) +
  (a.aisles ?? []).reduce((n, x) => n + x.length + (a.rowGap ?? 0), 0);

/** The file's corner point of an area (ours is the centre of the A1 cell, half a cell in). */
function corner(a: StagingAreaDef): P {
  const t = rad(a.rotation);
  const half =
    a.cellWidth / 2 + (a.aisles ?? []).filter((x) => x.after < 1).reduce((n, x) => n + x.length + (a.rowGap ?? 0), 0);
  return [
    a.x - (Math.cos(t) * a.cellLength) / 2 - Math.sin(t) * half,
    a.y - (Math.sin(t) * a.cellLength) / 2 + Math.cos(t) * half,
  ];
}
/** Where the robot stands at a cell: the centre of the cell, facing along the area. */
function cellPose(a: StagingAreaDef, row: number, col: number): [number, number, number] {
  const t = rad(a.rotation);
  const { x: cx, y: cy } = cellCenterOf(a, row, col);
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
    ['rows', a.rows + (a.aisles?.length ?? 0)],
    ['cols', a.cols],
    ['cell_width', pyFloat(a.cellLength)],
    ['cell_height', pyFloat(a.cellWidth)],
    ['row_spacing', pyFloat(a.rowGap ?? 0)],
    ['col_spacing', pyFloat(a.colGap ?? 0)],
    ['total_width', num3(a.cols * a.cellLength + (a.cols - 1) * (a.colGap ?? 0))],
    ['total_height', num3(rowsSpanOf(a))],
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
  /** The stations of the cells of a file's area, from its `cells` table (the names do not start with the area's key, so they are found by id). */
  const cellsOf = (area: PyValue): [string, PyValue][] =>
    list(obj(area).get('cells')).flatMap((row) =>
      list(row).flatMap((c) => {
        const id = obj(c).get('station_id');
        const entry = id === undefined || id === null ? undefined : attrStations.get(String(num(id)));
        return entry ? [[String(num(id)), entry] as [string, PyValue]] : [];
      }),
    );
  for (const [key, area] of [...areas]) {
    const a = ours.get(key);
    if (!a) {
      // the area was deleted: its cells go with it
      areas.delete(key);
      staging.dirty = true;
      for (const [id, v] of cellsOf(area)) {
        attrStations.delete(id);
        graphStations.delete(str(obj(v).get('station_name')));
      }
      if (attrs) attrs.dirty = true;
      graph.dirty = true;
      continue;
    }
    const meta = obj(obj(area).get('metadata'));
    const rowParams = obj(obj(area).get('row_level_params'));
    const oldAisles = fileAisles(rowParams, num(meta.get('rows')));
    const old = {
      x: num(meta.get('x')),
      y: num(meta.get('y')),
      r: num(meta.get('rotation')),
      rows: num(meta.get('rows')) - oldAisles.length,
      cols: num(meta.get('cols')),
    };
    const next = metaFields(a, ...corner(a));
    // a move or a turn is judged with the aisles the file has, so that a change of the leading aisle is not read as a move
    const [cx, cy] = corner({ ...a, aisles: oldAisles.map(({ after, length }) => ({ after, length })) });
    const moved =
      Math.abs(old.x - r3(cx)) > 0.0006 || Math.abs(old.y - r3(cy)) > 0.0006 || Math.abs(old.r - a.rotation) > 0.0006;
    const resized = old.rows !== a.rows || old.cols !== a.cols;
    const mine = a.aisles ?? [];
    const aislesChanged =
      oldAisles.length !== mine.length ||
      oldAisles.some((x, i) => x.after !== mine[i].after || Math.abs(x.length - mine[i].length) > 0.0006);
    const gridChanged =
      resized ||
      aislesChanged ||
      ['cell_width', 'cell_height', 'row_spacing', 'col_spacing'].some(
        (k, i) => Math.abs(num(meta.get(k)) - [a.cellLength, a.cellWidth, a.rowGap ?? 0, a.colGap ?? 0][i]) > 0.0006,
      );
    for (const [k, v] of next) if (!keepAsIs(meta, k, v, a, gridChanged)) put(staging, meta, k, v);
    // the stations of the cells follow the area when it is moved or turned (rigidly: the same poses relative to it)
    if (moved && !resized) {
      const dt = rad(a.rotation - old.r);
      const [nx, ny] = corner({ ...a, aisles: oldAisles.map(({ after, length }) => ({ after, length })) });
      const rot = (p: P): P => {
        const dx = p[0] - old.x,
          dy = p[1] - old.y;
        return [nx + dx * Math.cos(dt) - dy * Math.sin(dt), ny + dx * Math.sin(dt) + dy * Math.cos(dt)];
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
      for (const [, v] of cellsOf(area)) {
        move(attrs, obj(v));
        const g = graphStations.get(str(obj(v).get('station_name')));
        if (g) move(graph, obj(g));
      }
    }
    if (resized || aislesChanged)
      resizeCells(staging, docs, a, obj(area), attrStations, graphStations, { ...old, aisles: oldAisles });
  }
}

interface FileAisle {
  slot: number;
  after: number;
  length: number;
  params: PyObj;
}
/** The aisle rows of a file's area: the entries of `row_level_params` marked `aisle`, with the number of real rows before each. */
function fileAisles(rowParams: PyObj, slots: number): FileAisle[] {
  return [...rowParams]
    .filter(([k, v]) => obj(v).get('aisle') === true && Number(k) >= 0 && Number(k) < slots)
    .map(([k, v]) => ({ slot: Number(k), length: num(obj(v).get('length')) || 0, params: obj(v) }))
    .sort((x, y) => x.slot - y.slot)
    .map((x, i) => ({ ...x, after: x.slot - i }));
}

/** The grid of an area changed (rows, columns or aisles): cells that are gone lose their stations, new cells get one at their centre, and the cells that stay follow a change of the aisles. */
function resizeCells(
  staging: Doc,
  docs: { attrs: Doc | null; graph: Doc },
  a: StagingAreaDef,
  area: PyObj,
  attrStations: PyObj,
  graphStations: PyObj,
  old: { rows: number; cols: number; aisles: FileAisle[] },
) {
  const { attrs, graph } = docs;
  const id = num(obj(area.get('metadata')).get('staging_id'));
  const table = list(area.get('cells'));
  const rowParams = obj(area.get('row_level_params'));
  const oldAisleSlots = new Set(old.aisles.map((x) => x.slot));
  // the file's rows of cells, by real row number (aisle rows are not rows)
  const realRows = table.filter((_, slot) => !oldAisleSlots.has(slot));
  const oldSlotOf = (r: number) => r - 1 + old.aisles.filter((x) => x.after <= r - 1).length;
  const mine = a.aisles ?? [];
  const before = { ...a, aisles: old.aisles.map(({ after, length }) => ({ after, length })) };
  const fresh: PyValue[] = [];
  const params = new Map<string, PyValue>();
  const kept = new Set<string>();
  const aisleRow = (i: number) => {
    const slot = fresh.length;
    fresh.push(Array.from({ length: a.cols }, () => new Map<string, PyValue>()));
    const had = old.aisles[i];
    if (had) {
      if (Math.abs(had.length - mine[i].length) > 0.0006) put(staging, had.params, 'length', pyFloat(mine[i].length));
      params.set(String(slot), had.params);
    } else
      params.set(
        String(slot),
        new Map<string, PyValue>([
          ['aisle', true],
          ['length', pyFloat(mine[i].length)],
        ]),
      );
  };
  const place = (doc: Doc | null, entry: PyObj, dx: number, dy: number) => {
    if (!doc || (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005)) return;
    const p = list(entry.get('pose'));
    put(doc, entry, 'pose', [co(num(p[0]) + dx), co(num(p[1]) + dy), p[2]]);
  };
  let nextAisle = 0;
  const aislesBefore = (r: number) => {
    while (nextAisle < mine.length && mine[nextAisle].after <= r - 1) aisleRow(nextAisle++);
  };
  for (let r = 1; r <= a.rows; r++) {
    aislesBefore(r);
    const had = r <= old.rows ? list(realRows[r - 1]) : [];
    const slot = fresh.length;
    const keptParams = r <= old.rows ? rowParams.get(String(oldSlotOf(r))) : undefined;
    if (keptParams !== undefined) params.set(String(slot), keptParams);
    const out: PyValue[] = [];
    for (let c = 1; c <= a.cols; c++) {
      const cell = c <= old.cols ? had[c - 1] : undefined;
      if (cell) {
        out.push(cell);
        const sid = String(num(obj(cell).get('station_id')));
        kept.add(sid);
        const from = cellCenterOf(before, r, c),
          to = cellCenterOf(a, r, c);
        const entry = obj(attrStations.get(sid));
        place(attrs, entry, to.x - from.x, to.y - from.y);
        const g = graphStations.get(str(entry.get('station_name')));
        if (g) place(graph, obj(g), to.x - from.x, to.y - from.y);
        continue;
      }
      const name = `${a.name}_${letter(c)}${r}`;
      const station = id * 100000 + (r - 1) * a.cols + c;
      kept.add(String(station));
      out.push(
        new Map<string, PyValue>([
          ['station_id', station],
          ['station_name', name],
          ['tags', []],
        ]),
      );
      const pose = cellPose(a, r, c);
      const poseV = (): PyValue => [co(pose[0]), co(pose[1]), num3(pose[2])];
      attrStations.set(
        String(station),
        new Map<string, PyValue>([
          ['id', station],
          ['graph_node_coords', null],
          ['is_transit_allowed', true],
          ['orientation', 'off_lane'],
          ['pose', poseV()],
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
          ['pose', poseV()],
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
  aislesBefore(a.rows + 1);
  // cells that are gone lose their stations
  for (const row of realRows)
    for (const cell of list(row)) {
      const sid = String(num(obj(cell).get('station_id')));
      if (kept.has(sid) || !attrStations.has(sid)) continue;
      graphStations.delete(str(obj(attrStations.get(sid)).get('station_name')));
      attrStations.delete(sid);
    }
  area.set('cells', fresh);
  area.set('row_level_params', params);
  staging.dirty = true;
  if (attrs) attrs.dirty = true;
  graph.dirty = true;
}
