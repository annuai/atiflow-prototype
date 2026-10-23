import {
  CELL_STATION,
  cellCenterOf,
  cellOffsetOf,
  parseCell,
  resolveNodes,
  stationPointOf,
  withCellStation,
  type MapStation,
  type StagingAreaDef,
} from '@/features/map-editor';
import { pyFloat, type PyObj, type PyValue } from '../pyjson';
import { co, list, num, obj, put, r3, str, type Doc } from '../tree';
import type { V5 } from './context';
import { syncAssociated, syncFileNodes, type Look } from './stations';

const TOL_M = 0.01,
  TOL_RAD = 0.02;
const angleDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/**
 * The stations of the cells of staging areas, in `grid_map_attributes.json` and `graph_object_v5.json`: for every cell that has settings of its own, its pose (when its way or distance moved it),
 * whether it is off or on a lane, and its nodes with their roles, patched the way a station's are (only what differs is written, so an untouched map still exports byte for byte).
 */
export function patchCells(c: V5, staging: Doc | null) {
  if (!staging || !c.attrs) return;
  const attrs = c.attrs;
  const attrStations = obj(attrs.tree.get('stations_info'));
  for (const a of c.data.stagingAreas) {
    const ext = (a.extra?.dm as { externalId?: unknown } | undefined)?.externalId;
    const fileArea = ext === undefined ? undefined : staging.tree.get(String(ext));
    if (!a.cellSettings || !fileArea) continue;
    const rows = list(obj(fileArea).get('cells'));
    // the file's table also has a row for every aisle: a real row sits after the aisles before it
    const aisleSlots = [...obj(obj(fileArea).get('row_level_params'))]
      .filter(([, v]) => obj(v).get('aisle') === true)
      .map(([k]) => Number(k))
      .sort((x, y) => x - y);
    const slotOf = (row: number) => {
      let slot = row - 1;
      for (const x of aisleSlots) if (x <= slot) slot++;
      return slot;
    };
    for (const [ref, ov] of Object.entries(a.cellSettings)) {
      const cell = parseCell(ref);
      const slot = cell ? obj(list(rows[slotOf(cell.row)])[cell.col - 1]) : null;
      const entry = slot && attrStations.get(String(num(slot.get('station_id'))));
      if (!cell || !entry) continue;
      patchCell(c, a, ref, cell, obj(entry), ov);
    }
  }
}

function patchCell(
  c: V5,
  a: StagingAreaDef,
  ref: string,
  cell: { row: number; col: number },
  entry: PyObj,
  ov: NonNullable<StagingAreaDef['cellSettings']>[string],
) {
  const attrs = c.attrs!;
  const name = str(entry.get('station_name'));
  const graphEntry = c.graphStations.get(name);
  put(attrs, entry, 'orientation', ov.onLane ? 'on_lane' : 'off_lane');
  if (graphEntry) put(c.graph, obj(graphEntry), 'orientation', ov.onLane ? 'on_lane' : 'off_lane');
  // where it stands and the way it faces: only when the cell sets its own way or distance, and then relative to the file's own pose (the file may have aisle rows between rows that the grid
  // here does not model, so absolute positions would differ; the distance along the area's direction is what the cell setting changes)
  if (ov.angle !== undefined || ov.offset !== undefined) {
    const p = stationPointOf(a, cell.row, cell.col);
    const was = list(entry.get('pose'));
    const t = (a.rotation * Math.PI) / 180;
    const centre = cellCenterOf(a, cell.row, cell.col);
    const now = (num(was[0]) - centre.x) * Math.cos(t) + (num(was[1]) - centre.y) * Math.sin(t);
    const want = cellOffsetOf(a, cell.row, cell.col);
    const d = want - now;
    const [x, y] = [num(was[0]) + d * Math.cos(t), num(was[1]) + d * Math.sin(t)];
    if (Math.abs(d) > TOL_M || angleDiff(num(was[2]), p.heading) > TOL_RAD) {
      const pose: PyValue = [co(x), co(y), pyFloat(r3(Math.atan2(Math.sin(p.heading), Math.cos(p.heading))))];
      put(attrs, entry, 'pose', pose);
      if (graphEntry) put(c.graph, obj(graphEntry), 'pose', pose);
    }
  }
  // the nodes: the same patch a station gets (a cell that never had nodes of its own keeps the file's as they are)
  if (!ov.nodes) return;
  const stand = withCellStation(c.data, a, ref);
  if (!stand) return;
  const station: MapStation = { ...stand.station, id: CELL_STATION, nodes: ov.nodes, onLane: !!ov.onLane };
  const res = resolveNodes(stand.data, station);
  const look = {
    s: station,
    res,
    gids: res.flatMap((r) => (r.at ? [c.gid(r.at.id)] : [])),
    edited: new Set<number>(),
  } as unknown as Look;
  syncFileNodes(c, attrs, entry, look, true);
  if (graphEntry) syncAssociated(c, obj(graphEntry), look);
}
