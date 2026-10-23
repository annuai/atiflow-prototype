import { describe, expect, it } from 'vitest';
import { resolveNodes, addNodeAt, setSlotOn, slotOf, stationNodes } from '@/features/map-editor/model/approach/nodes';
import { addRoad } from '@/features/map-editor/model/roads';
import { cellCorners, stationPoint } from '@/features/map-editor/model/staging';
import {
  CELL_STATION,
  cellSummary,
  copyNodesFromFirst,
  describePick,
  editCells,
  parseCell,
  rowCells,
  columnCells,
  setCells,
  withCellStation,
} from '@/features/map-editor/model/stagingCells';
import type { MapData, StagingAreaDef } from '@/features/map-editor/model/types';

const area = (): StagingAreaDef => ({
  id: 'SA-001',
  name: 'Dock',
  rotation: 0,
  x: 0,
  y: 10,
  rows: 3,
  cols: 2,
  cellLength: 1.2,
  cellWidth: 1,
});
function map(): MapData {
  let d: MapData = { nodes: [], lanes: [], roads: [], stations: [], stagingAreas: [area()], zones: [] };
  d = addRoad(
    d,
    [
      [-5, 0],
      [10, 0],
    ],
    { fleetLive: 'f' },
  ).data;
  return d;
}

describe('a station near the end of a road', () => {
  it('still joins the route when the nearest point is too close to the road end to cut it', () => {
    let d: MapData = { nodes: [], lanes: [], roads: [], stations: [], stagingAreas: [area()], zones: [] };
    d = addRoad(
      d,
      [
        [0, 0],
        [20, 0],
      ],
      { fleetLive: 'f' },
    ).data;
    const stand = withCellStation(
      { ...d, stagingAreas: [{ ...area(), x: 20.1, y: 6 }] },
      { ...area(), x: 20.1, y: 6 },
      'A1',
    )!;
    expect(resolveNodes(stand.data, stand.station)[0].at).not.toBeNull();
  });
});

describe('cells of a staging area', () => {
  it('are named column letter + row number and picked as a cell, a row, a column or several', () => {
    expect(parseCell('B7')).toEqual({ row: 7, col: 2 });
    expect(parseCell('nope')).toBeNull();
    const a = area();
    expect(rowCells(a, 2)).toEqual(['A2', 'B2']);
    expect(columnCells(a, 1)).toEqual(['A1', 'A2', 'A3']);
    expect(describePick(a, ['A1'])).toEqual({ kind: 'cell', ref: 'A1' });
    expect(describePick(a, rowCells(a, 2))).toEqual({ kind: 'row', row: 2 });
    expect(describePick(a, columnCells(a, 1))).toEqual({ kind: 'column', col: 1 });
    expect(describePick(a, ['A1', 'B2'])).toEqual({ kind: 'many', n: 2 });
  });
  it('turn and stand off on their own when asked, and the others keep the area setting', () => {
    const d = setCells(map(), 'SA-001', ['B2'], { angle: 20, offset: 2 });
    const a = d.stagingAreas[0];
    expect(a.cellSettings).toEqual({ B2: { angle: 20, offset: 2 } });
    const own = stationPoint(a, 2, 2),
      other = stationPoint(a, 2, 1);
    expect(own.x - other.x).toBeGreaterThan(1.9);
    expect(own.heading).not.toBe(other.heading);
    expect(cellCorners(a, 2, 2)).not.toEqual(cellCorners({ ...a, cellSettings: undefined }, 2, 2));
    // back to the area's value: the override goes away
    expect(setCells(d, 'SA-001', ['B2'], { angle: 0, offset: 0 }).stagingAreas[0].cellSettings).toBeUndefined();
  });
  it('shows a value as mixed when the picked cells differ', () => {
    const d = setCells(map(), 'SA-001', ['A1'], { angle: 10 });
    const a = d.stagingAreas[0];
    expect(cellSummary(d, a, ['A1', 'A2']).angle).toEqual({ value: 10, mixed: true });
    expect(cellSummary(d, a, ['A2', 'A3']).angle).toEqual({ value: 0, mixed: false });
    expect(cellSummary(d, a, ['A1']).onLane.mixed).toBe(false);
  });
  it('have nodes like a station: a cell is off the route with an automatic node, and a node edit is kept for that cell only', () => {
    const d = map();
    const a = d.stagingAreas[0];
    const stand = withCellStation(d, a, 'A1')!;
    expect(stand.station.id).toBe(CELL_STATION);
    expect(stand.station.onLane).toBe(false);
    const dropOff = editCells(d, 'SA-001', ['A1'], (m, id) => setSlotOn(m, id, 0, 'drop', false))!;
    const cell = dropOff.stagingAreas[0].cellSettings!.A1;
    expect(slotOf(cell.nodes![0], 'drop')).toBeUndefined();
    expect(dropOff.stagingAreas[0].cellSettings!.A2).toBeUndefined();
    // the stand-in station never stays in the map
    expect(dropOff.stations.some((s) => s.id === CELL_STATION)).toBe(false);
    expect(dropOff.nodes.some((n) => n.id === `N-${CELL_STATION}`)).toBe(false);
  });
  it('can give a whole row another way in at once, and say when their nodes differ', () => {
    let d = map();
    d = editCells(d, 'SA-001', ['A1'], (m, id) => setSlotOn(m, id, 0, 'pick', false))!;
    expect(cellSummary(d, d.stagingAreas[0], ['A1', 'B1']).nodes.mixed).toBe(true);
    const same = copyNodesFromFirst(d, 'SA-001', ['A1', 'B1']);
    expect(cellSummary(same, same.stagingAreas[0], ['A1', 'B1']).nodes.mixed).toBe(false);
    const more = editCells(same, 'SA-001', ['A1', 'B1'], (m, id) => addNodeAt(m, id, { x: 6, y: 0 }))!;
    for (const ref of ['A1', 'B1']) expect(stationNodes({ ...stand(more, ref) }).length).toBe(2);
    expect(editCells(map(), 'SA-001', ['A1'], () => null)).toBeNull();
  });
});
function stand(d: MapData, ref: string) {
  return { ...withCellStation(d, d.stagingAreas[0], ref)!.station, nodes: d.stagingAreas[0].cellSettings![ref].nodes };
}
