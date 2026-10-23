import { degrees } from './shape';
import { cellCorners, cellOffsetAt, clampCellAngle, cellOverride, cellRef, stationPoint } from './staging';
import { pointInPolygon } from './zones';
import { resolveNodes } from './approach/nodes';
import type { CellSettings, MapData, MapStation, Selection, StagingAreaDef } from './types';

/**
 * Cells of a staging area as stations. A cell has a station of its own (in front of it), and a station has nodes, a placement (off the route or on it) and a way it faces, so a cell is edited by
 * putting a stand-in station for it into the map, running the ordinary station edit on it, and taking the result back into the cell's settings. The stand-in has this id, whichever cell it is for.
 */
export const CELL_STATION = '__cell';

/** "B7" -> { row: 7, col: 2 } (null when it is not a cell name). */
export function parseCell(ref: string): { row: number; col: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  const col = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  return { row: Number(m[2]), col };
}
export const hasCell = (a: StagingAreaDef, ref: string): boolean => {
  const c = parseCell(ref);
  return !!c && c.row >= 1 && c.row <= a.rows && c.col >= 1 && c.col <= a.cols;
};
/** Every cell of a row (1 = the first) or a column, in order. */
export const rowCells = (a: StagingAreaDef, row: number): string[] =>
  Array.from({ length: a.cols }, (_, i) => cellRef(row, i + 1));
export const columnCells = (a: StagingAreaDef, col: number): string[] =>
  Array.from({ length: a.rows }, (_, i) => cellRef(i + 1, col));
/** What a picked set of cells is called: a cell, a whole row, a whole column or "n cells". */
export type CellPick =
  | { kind: 'cell'; ref: string }
  | { kind: 'row'; row: number }
  | { kind: 'column'; col: number }
  | { kind: 'many'; n: number };
export function describePick(a: StagingAreaDef, refs: string[]): CellPick {
  if (refs.length === 1) return { kind: 'cell', ref: refs[0] };
  const cells = refs.map(parseCell).filter((c): c is { row: number; col: number } => !!c);
  const rows = new Set(cells.map((c) => c.row)),
    cols = new Set(cells.map((c) => c.col));
  if (rows.size === 1 && cells.length === a.cols) return { kind: 'row', row: [...rows][0] };
  if (cols.size === 1 && cells.length === a.rows) return { kind: 'column', col: [...cols][0] };
  return { kind: 'many', n: refs.length };
}

/** The map with a stand-in station for one cell (its place, its way, its settings), and that station. */
export function withCellStation(
  data: MapData,
  a: StagingAreaDef,
  ref: string,
): { data: MapData; station: MapStation } | null {
  const c = parseCell(ref);
  if (!c || !hasCell(a, ref)) return null;
  const p = stationPoint(a, c.row, c.col);
  const ov = cellOverride(a, c.row, c.col);
  const nodeId = `N-${CELL_STATION}`;
  const station: MapStation = {
    id: CELL_STATION,
    name: `${a.name}_${ref}`,
    nodeId,
    type: 'drop',
    zone: null,
    fleets: [data.lanes[0]?.fleets[0] ?? ''],
    angle: Math.round(degrees(p.heading) * 10) / 10,
    onLane: ov?.onLane ?? false, // a cell is off the route unless it says otherwise
    ...(ov?.nodes ? { nodes: ov.nodes } : {}),
  };
  const clean = data.stations.some((s) => s.id === CELL_STATION) ? withoutCellStation(data) : data;
  return {
    data: {
      ...clean,
      nodes: [...clean.nodes, { id: nodeId, x: p.x, y: p.y, kind: 'station' }],
      stations: [...clean.stations, station],
    },
    station,
  };
}
const withoutCellStation = (d: MapData): MapData => ({
  ...d,
  stations: d.stations.filter((s) => s.id !== CELL_STATION),
  nodes: d.nodes.filter((n) => n.id !== `N-${CELL_STATION}`),
});

const patchCell = (data: MapData, areaId: string, ref: string, patch: CellSettings): MapData => ({
  ...data,
  stagingAreas: data.stagingAreas.map((a) => {
    if (a.id !== areaId) return a;
    const next: CellSettings = { ...a.cellSettings?.[ref], ...patch };
    // a setting equal to the area's is not an override
    if (next.angle !== undefined && next.angle === (a.cellAngle ?? 0)) delete next.angle;
    if (next.offset !== undefined && next.offset === (a.stationOffset ?? 0)) delete next.offset;
    if (next.onLane === false) delete next.onLane;
    if (!next.nodes?.length) delete next.nodes;
    const rest = { ...a.cellSettings };
    if (Object.keys(next).length) rest[ref] = next;
    else delete rest[ref];
    return { ...a, cellSettings: Object.keys(rest).length ? rest : undefined };
  }),
});
/** Change what the cells set for themselves: their way, their station's distance, on / off the route. */
export function setCells(
  data: MapData,
  areaId: string,
  refs: string[],
  patch: Pick<CellSettings, 'angle' | 'offset' | 'onLane'>,
): MapData {
  return refs.reduce((d, ref) => patchCell(d, areaId, ref, patch), data);
}

/**
 * Run a station edit (`fn`, written for a station called `CELL_STATION`: a node added, a slot switched, a road cut) on each of the cells and keep what it did to the cell's station. An edit that
 * returns null leaves its cell as it was; null when it returned null for every cell. Roads and nodes the edit made stay in the map.
 */
export function editCells(
  data: MapData,
  areaId: string,
  refs: string[],
  fn: (m: MapData, station: string) => MapData | null,
): MapData | null {
  let work = data;
  let changed = false;
  for (const ref of refs) {
    const a = work.stagingAreas.find((s) => s.id === areaId);
    const stand = a && withCellStation(work, a, ref);
    if (!stand) continue;
    const res = fn(stand.data, CELL_STATION);
    if (!res) continue;
    const st = res.stations.find((s) => s.id === CELL_STATION);
    work = patchCell(withoutCellStation(res), areaId, ref, {
      nodes: st?.nodes,
      onLane: st?.onLane,
    });
    changed = true;
  }
  return changed ? work : null;
}

/** One value across several cells: the shared value, or `mixed` when they differ (the value is then the first cell's). */
export interface Shared<T> {
  value: T;
  mixed: boolean;
}
const share = <T>(values: T[]): Shared<T> => ({ value: values[0], mixed: values.some((v) => v !== values[0]) });
export function cellSummary(data: MapData, a: StagingAreaDef, refs: string[]) {
  const cells = refs.map(parseCell).filter((c): c is { row: number; col: number } => !!c);
  const nodes = refs.flatMap((ref) => {
    const stand = withCellStation(data, a, ref);
    return stand
      ? [JSON.stringify(resolveNodes(stand.data, stand.station).map((r) => [r.auto, r.node.at ?? null, r.node.roles]))]
      : [];
  });
  return {
    angle: share(cells.map((c) => cellOverride(a, c.row, c.col)?.angle ?? a.cellAngle ?? 0)),
    offset: share(cells.map((c) => cellOffsetAt(a, c.row, c.col))),
    onLane: share(cells.map((c) => !!cellOverride(a, c.row, c.col)?.onLane)),
    nodes: share(nodes),
  };
}
/** Give every cell the nodes of the first one (what "make them the same" does for cells whose nodes differ). */
export function copyNodesFromFirst(data: MapData, areaId: string, refs: string[]): MapData {
  const a = data.stagingAreas.find((s) => s.id === areaId);
  const first = a && refs[0] ? parseCell(refs[0]) : null;
  const from = a && first ? cellOverride(a, first.row, first.col)?.nodes : undefined;
  return refs
    .slice(1)
    .reduce((d, ref) => patchCell(d, areaId, ref, { nodes: from ? structuredClone(from) : undefined }), data);
}

/** What picking `refs` does to the cells already picked: they replace them, or with Shift are added (or taken out again when all of them are already picked). */
export function togglePick(current: string[], refs: string[], shift: boolean): string[] {
  if (!shift) return refs;
  return refs.every((r) => current.includes(r))
    ? current.filter((r) => !refs.includes(r))
    : [...new Set([...current, ...refs])];
}
/** The cell whose box holds the point (null: between the cells or outside the area). */
export function cellAt(a: StagingAreaDef, x: number, y: number): string | null {
  for (let row = 1; row <= a.rows; row++)
    for (let col = 1; col <= a.cols; col++)
      if (pointInPolygon(x, y, cellCorners(a, row, col))) return cellRef(row, col);
  return null;
}

/** `editCells` on the cells picked in a selection (the map unchanged when nothing is picked or the edit does nothing). */
export function editCellsPicked(
  data: MapData,
  sel: Selection,
  fn: (m: MapData, station: string) => MapData | null,
): MapData {
  return (sel?.kind === 'staging' && sel.cells?.length ? editCells(data, sel.id, sel.cells, fn) : null) ?? data;
}
/** The rotate handle of a cell's station gave this heading (degrees, 0 = east): the picked cells turn to it (at most 60 degrees either way from the area). */
export function turnCellsPicked(data: MapData, sel: Selection, heading: number): MapData {
  const a = sel?.kind === 'staging' ? data.stagingAreas.find((s) => s.id === sel.id) : undefined;
  if (!a || sel?.kind !== 'staging' || !sel.cells?.length) return data;
  const turn = ((((heading - a.rotation + 180) % 360) + 360) % 360) - 180;
  return setCells(data, a.id, sel.cells, { angle: clampCellAngle(Math.round(turn * 10) / 10) });
}

/** Put the picked cells back to the area's own settings. */
export function resetCells(data: MapData, areaId: string, refs: string[]): MapData {
  return {
    ...data,
    stagingAreas: data.stagingAreas.map((a) => {
      if (a.id !== areaId || !a.cellSettings) return a;
      const rest = { ...a.cellSettings };
      for (const r of refs) delete rest[r];
      return { ...a, cellSettings: Object.keys(rest).length ? rest : undefined };
    }),
  };
}
