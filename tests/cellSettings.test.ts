import { describe, expect, it } from 'vitest';
import { resolveNodes, addNodeAt, setSlotOn, slotOf, stationNodes } from '@/features/map-editor/model/approach/nodes';
import { addRoad } from '@/features/map-editor/model/roads';
import { cellCenter as cellCenterOf, cellCorners, stationPoint } from '@/features/map-editor/model/staging';
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
import { LaneGraph } from '@/core/lanes';
import { applyPublishedMaps } from '@/features/map-editor/model/applyMaps';
import { cellOfStationId, cellStationId } from '@/features/map-editor/model/stagingCells';
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

describe('robots can drive to a particular cell', () => {
  it('every cell has a station in the live network, joined to the route through its own nodes, and no cell is a station of the floor', () => {
    let d = map();
    d = addRoad(
      d,
      [
        [-5, 0],
        [25, 0],
      ],
      { fleetLive: 'f' },
    ).data;
    d = editCells(d, 'SA-001', ['B2'], (m, id) => addNodeAt(setSlotOn(m, id, 0, 'laden', false), id, { x: 22, y: 0 }))!;
    const nav = applyPublishedMaps(
      { schema: 2, siteId: 's', nodes: [], lanes: [], stations: [], fleets: [], trafficZones: [], forbiddenZones: [] },
      [{ fleetLive: 'f', data: d }],
    );
    expect(nav.stations.some((s) => s.id.startsWith('SA-'))).toBe(false);
    expect(nav.cellStations).toHaveLength(6); // 3 rows x 2 columns
    const g = new LaneGraph(nav);
    const near = g.stationNode(cellStationId('SA-001', 'A1'))!,
      far = g.stationNode(cellStationId('SA-001', 'B3'))!;
    expect(near).toBeDefined();
    expect(far).toBeDefined();
    const lanes = g.route(near.id, far.id, 'f');
    expect(lanes?.length).toBeGreaterThan(0);
    expect(cellOfStationId('SA-001:B3')).toEqual({ area: 'SA-001', ref: 'B3' });
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
    expect(own.x - other.x).toBeGreaterThan(1.9); // two metres further from the centre
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

import { existsSync, readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { buildMapData } from '@/features/map-import/build';
import { prepareImport } from '@/features/map-import/core/prepare';
import { exportMapZip } from '@/features/map-import/export';
import { parsePy, type PyObj } from '@/features/map-import/dm/pyjson';

const SAMPLE = '/Users/annuaip/Downloads/amz_tcy5a_draft (1).zip';
describe.skipIf(!existsSync(SAMPLE))('cells of the real amz_tcy5a export', () => {
  const zip = () => new Uint8Array(readFileSync(SAMPLE));
  const build = () => buildMapData(prepareImport(zip()), [], []);
  const same = (a?: Uint8Array, b?: Uint8Array) => !!a && !!b && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
  const dec = (b: Uint8Array) => new TextDecoder().decode(b);
  it('reads every cell station: its nodes with their roles, and its own way where it differs', () => {
    const d = build();
    const a = d.stagingAreas.find((x) => x.name === 'pallet_pickup')!;
    expect(Object.keys(a.cellSettings!)).toHaveLength(12);
    expect(a.cellSettings!.A1.nodes!.length).toBe(2);
    expect(a.cellSettings!.A1.nodes![0].roles.park?.pick).toMatchObject({
      maneuver: 'inplace',
      params: { perpendicular_dist: 7 },
    });
    const dropArea = d.stagingAreas.find((x) => x.name === 'pallet_drop')!;
    expect(Object.values(dropArea.cellSettings!).some((s) => s.angle === -180)).toBe(true);
  });
  it('exports an untouched map byte for byte', () => {
    const out = unzipSync(exportMapZip({ original: zip(), data: build(), name: 'x', version: '2' }));
    const a = unzipSync(zip());
    for (const k of Object.keys(a)) if (!k.endsWith('/')) expect(same(a[k], out[k]), k).toBe(true);
  });
  it('writes a cell change to the cell station only: its roles and its way', () => {
    const d = build();
    const area = d.stagingAreas.find((x) => x.name === 'pallet_pickup')!;
    const edited = editCells(d, area.id, ['B2'], (m, id) => setSlotOn(m, id, 0, 'drop', false))!;
    const turned = setCells(edited, area.id, ['B2'], { angle: 15 });
    const out = unzipSync(exportMapZip({ original: zip(), data: turned, name: 'x', version: '2' }));
    const orig = unzipSync(zip());
    const changed = Object.keys(orig)
      .filter((k) => !k.endsWith('/') && !same(orig[k], out[k]))
      .map((k) => k.split('/').pop())
      .sort();
    expect(changed).toEqual(['graph_object_v5.json', 'grid_map_attributes.json']);
    const attrs = parsePy(dec(out[Object.keys(out).find((k) => k.endsWith('/grid_map_attributes.json'))!])) as PyObj;
    const st = [...(attrs.get('stations_info') as PyObj).values()].find(
      (v) => (v as PyObj).get('station_name') === 'pallet_pickup_B2',
    ) as PyObj;
    const node0 = (st.get('nodes') as PyObj[])[0];
    expect((node0.get('park') as PyObj).has('drop')).toBe(false);
    expect((node0.get('park') as PyObj).has('pick')).toBe(true);
    const pose = st.get('pose') as { value?: number }[] | number[];
    expect(
      Math.abs(Number((pose[2] as { value?: number }).value ?? pose[2]) - (91 + 15) * (Math.PI / 180)),
    ).toBeLessThan(0.01);
  });
  describe('aisle rows between the rows of an area', () => {
    const exported = (data: MapData) => unzipSync(exportMapZip({ original: zip(), data, name: 'x', version: '2' }));
    const file = (files: Record<string, Uint8Array>, name: string) =>
      parsePy(dec(files[Object.keys(files).find((k) => k.endsWith('/' + name))!])) as PyObj;
    const dropOf = (files: Record<string, Uint8Array>) =>
      [...file(files, 'staging_areas.json').values()].find(
        (v) => ((v as PyObj).get('metadata') as PyObj).get('name') === 'pallet_drop',
      ) as PyObj;
    const poseOf = (files: Record<string, Uint8Array>, name: string): [number, number] => {
      const st = [...(file(files, 'grid_map_attributes.json').get('stations_info') as PyObj).values()].find(
        (v) => (v as PyObj).get('station_name') === name,
      ) as PyObj;
      const p = st.get('pose') as unknown[];
      const n = (v: unknown) => Number((v as { value?: number }).value ?? v);
      return [n(p[0]), n(p[1])];
    };
    it('are read: real rows only, and every cell stands where the file puts its station', () => {
      const d = build();
      const a = d.stagingAreas.find((x) => x.name === 'pallet_drop')!;
      expect(a.rows).toBe(18);
      expect(a.aisles).toHaveLength(4);
      const [fx, fy] = poseOf(unzipSync(zip()), 'pallet_drop_A12');
      const c = cellCenterOf(a, 12, 1);
      expect(Math.hypot(c.x - fx, c.y - fy)).toBeLessThan(0.01);
    });
    it('a wider aisle changes its width in the file and moves the rows after it, nothing else', () => {
      const d = build();
      const a = d.stagingAreas.find((x) => x.name === 'pallet_drop')!;
      const wider = a.aisles!.map((x, i) => (i === 3 ? { ...x, length: x.length + 0.5 } : x));
      const data = { ...d, stagingAreas: d.stagingAreas.map((x) => (x.id === a.id ? { ...x, aisles: wider } : x)) };
      const out = exported(data),
        orig = unzipSync(zip());
      const area = dropOf(out);
      expect(area.get('cells') as unknown[]).toHaveLength(22);
      const params = area.get('row_level_params') as PyObj;
      const len = (params.get('14') as PyObj).get('length') as { value?: number } | number;
      expect(Number(typeof len === 'object' ? len.value : len)).toBeCloseTo(1.8, 3);
      const [x0, y0] = poseOf(orig, 'pallet_drop_A12'),
        [x1, y1] = poseOf(out, 'pallet_drop_A12');
      expect(Math.hypot(x1 - x0, y1 - y0)).toBeCloseTo(0.5, 2);
      const [u0, v0] = poseOf(orig, 'pallet_drop_A3'),
        [u1, v1] = poseOf(out, 'pallet_drop_A3');
      expect(Math.hypot(u1 - u0, v1 - v0)).toBeLessThan(0.001);
    });
    it('a new aisle adds an empty row to the cell table and moves the aisle rows after it', () => {
      const d = build();
      const a = d.stagingAreas.find((x) => x.name === 'pallet_drop')!;
      const aisles = [{ after: 2, length: 1 }, ...a.aisles!];
      const data = { ...d, stagingAreas: d.stagingAreas.map((x) => (x.id === a.id ? { ...x, aisles } : x)) };
      const area = dropOf(exported(data));
      const table = area.get('cells') as PyObj[][];
      expect(table).toHaveLength(23);
      expect(table[2]).toHaveLength(2);
      expect([...table[2][0].keys()]).toEqual([]);
      expect(((area.get('metadata') as PyObj).get('rows') as number) | 0).toBe(23);
      const params = area.get('row_level_params') as PyObj;
      expect([...params.keys()].filter((k) => (params.get(k) as PyObj).get('aisle')).sort((x, y) => +x - +y)).toEqual([
        '2',
        '6',
        '10',
        '13',
        '15',
      ]);
    });
  });
});

import { readFileSync as readFile } from 'node:fs';
import { FleetSim } from '@/adapters/sim';
import { seedMapData } from '@/features/map-editor';
import type { NavGraph, OrderUpdate, SiteLayout } from '@/core/types';

describe('a requested trip drives to the station of a staging cell', () => {
  it('a robot takes an order to cell B2 of the area, goes through the cell, and the order completes', () => {
    const site = JSON.parse(readFile('public/sites/ecc/site.json', 'utf8')) as SiteLayout;
    const base = JSON.parse(readFile('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
    const fleet = base.fleets[1].id;
    const data = seedMapData({ fleetLive: fleet }, site, base);
    const area = data.stagingAreas[0];
    const live = applyPublishedMaps(base, [{ fleetLive: fleet, data }]);
    const pick = live.stations.find((s) => s.fleets.includes(fleet) && s.type !== 'charge' && s.type !== 'park')!;
    const to = cellStationId(area.id, 'B2');
    expect(live.cellStations?.some((s) => s.id === to)).toBe(true);
    const sim = new FleetSim(live, site.siteId, 14, 7);
    expect(
      sim.submitOrder({
        id: 'REQ-C',
        fleetId: fleet,
        legs: [pick.id, to],
        loadFrom: 1,
        payload: { kind: 'x', qty: 1 },
      }),
    ).toBe(true);
    const updates: OrderUpdate[] = [];
    for (let t = 0; t < 3600 && !updates.some((u) => u.status === 'completed' || u.status === 'failed'); t += 0.1) {
      sim.step(0.1);
      updates.push(...sim.drainOrderUpdates());
      sim.drainEvents();
    }
    expect(updates.map((u) => u.status)).toContain('completed');
  });
});
