import { existsSync, readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildMapData } from '@/features/map-import/build';
import { prepareImport } from '@/features/map-import/core/prepare';
import { exportMapZip } from '@/features/map-import/export';
import { parsePy, type PyObj } from '@/features/map-import/dm/pyjson';
import { addRoad, deleteRoad, updateRoad } from '@/features/map-editor/model/roads';
import { addStation, deleteStation, moveStation, updateStation } from '@/features/map-editor/model/stations';
import { updateStagingArea } from '@/features/map-editor/model/staging';
import { planTrip } from '@/features/map-editor/model/simulate';
import { num } from '@/features/map-import/dm/tree';
import { v2Mini, v5Mini } from './helpers/dmZips';

const dec = (b: Uint8Array) => new TextDecoder().decode(b);
const build = (zip: Uint8Array) => buildMapData(prepareImport(zip), ['a', 'b', 'c', 'd'], [], undefined, []);
type Data = ReturnType<typeof build>;
const exportOf = (zip: Uint8Array, d: Data, version: string) =>
  exportMapZip({ original: zip, data: d, name: 'x', version });
const same = (a?: Uint8Array, b?: Uint8Array) => !!a && !!b && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
/** The files of an export that differ from the original zip (ours, in ati_flow/, is not one of them). */
const changed = (orig: Uint8Array, out: Uint8Array) => {
  const a = unzipSync(orig),
    b = unzipSync(out);
  return Object.keys(a)
    .filter((k) => !k.endsWith('/') && !same(a[k], b[k]))
    .map((k) => k.split('/').pop());
};
const J = (zip: Uint8Array, name: string) => {
  const f = unzipSync(zip);
  const key = Object.keys(f).find((k) => k.endsWith('/' + name))!;
  return parsePy(dec(f[key])) as PyObj;
};
const get = (m: unknown, ...path: string[]): any => path.reduce((o: any, k) => o?.get(k), m);
const lineIdOf = (r: { extra?: Record<string, unknown> }) =>
  (r.extra?.dm as { externalId?: string } | undefined)?.externalId;

describe('v5 export: patching the Deployment Manager files', () => {
  const zip = v5Mini();
  it('an unedited map comes out byte for byte', () => {
    expect(changed(zip, exportOf(zip, build(zip), 'v5'))).toEqual([]);
  });
  it('imports the roads, the nodes on them and the stations joined to those nodes', () => {
    const d = build(zip);
    expect(new Set(d.roads.map(lineIdOf))).toEqual(new Set(['1', '2', '3']));
    expect(d.roads.length).toBe(5); // L1 is cut at its two nodes into three roads that share its id
    expect(Object.values(d.fileNodes ?? {}).sort()).toEqual(['N1', 'N2', 'N3', 'N4', 'N5', 'N6']);
    expect(d.stations.map((s) => s.routeNodes?.length)).toEqual([1, 1]);
  });
  it('a renamed, moved and turned station is written to every file that holds it', () => {
    let d = build(zip);
    const s = d.stations[0];
    d = updateStation(moveStation(updateStation(d, s.id, { name: 'Renamed' }), s.id, { x: 3.5, y: 0.4 }), s.id, {
      angle: 45,
    });
    const out = exportOf(zip, d, 'v5');
    expect(changed(zip, out).sort()).toEqual(['graph_object_v5.json', 'grid_map_attributes.json', 'gmaj.json'].sort());
    for (const f of ['gmaj.json', 'grid_map_attributes.json']) {
      const e = get(J(out, f), 'stations_info', '1');
      expect(e.get('station_name')).toBe('Renamed');
      expect(e.get('pose').slice(0, 2).map(num)).toEqual([3.5, 0.4]);
      expect(Math.round(num(e.get('pose')[2]) * 1000) / 1000).toBe(0.785);
      expect(e.get('nodes')[0].get('lane_ids')).toEqual([1]); // everything it did not edit stays
    }
    const g = get(J(out, 'graph_object_v5.json'), 'stations_info');
    expect([...g.keys()].slice(0, 2)).toEqual(['Renamed', 'Dock B']); // renamed in place, the order kept
    expect([...g.get('Renamed').get('associated_nodes').keys()]).toEqual(['N5']);
  });
  it('a deleted road removes its line, its reverse line and its edges', () => {
    let d = build(zip);
    for (const r of d.roads.filter((q) => lineIdOf(q) === '3')) d = deleteRoad(d, r.id);
    const out = exportOf(zip, d, 'v5');
    expect([...get(J(out, 'gmaj.json'), 'terminal_lines_info').keys()]).toEqual(['1', '2']);
    expect([...get(J(out, 'grid_map_attributes.json'), 'terminal_lines_info').keys()]).toEqual(['1', '2', '4']);
    expect(get(J(out, 'graph_object_v5.json'), 'edges_info').size).toBe(7); // the two edges of L3 are gone
    expect(get(J(out, 'gmaj.json'), 'terminal_lines_info', '2', 'related_lines', '1').size).toBe(0); // and nothing points at it
  });
  it('a new road becomes a line (and a reverse line when two-way), joined to the nodes it meets', () => {
    let d = build(zip);
    const a = d.nodes.find((n) => d.fileNodes?.[n.id] === 'N1')!,
      b = d.nodes.find((n) => d.fileNodes?.[n.id] === 'N4')!;
    d = addRoad(
      d,
      [
        [a.x, a.y],
        [b.x, b.y],
      ],
      { fleetLive: '', nodeA: a.id, nodeB: b.id, snap: 0, name: 'Connector' },
    ).data;
    const out = exportOf(zip, d, 'v5');
    const lines = get(J(out, 'gmaj.json'), 'terminal_lines_info');
    expect([...lines.keys()]).toEqual(['1', '2', '3', '6']);
    expect(lines.get('6').get('lane_name')).toBe('Connector');
    expect(get(J(out, 'grid_map_attributes.json'), 'terminal_lines_info', '7', 'bidirectional_line')).toBe(6);
    const edges = [...get(J(out, 'graph_object_v5.json'), 'edges_info').values()].map(
      (e: PyObj) => `${e.get('start_node')}>${e.get('end_node')}`,
    );
    expect(edges).toContain('N1>N4');
    expect(edges).toContain('N4>N1');
    // the lines it touches now know it
    expect([...get(lines, '1', 'related_lines', '0').keys()]).toContain('6');
  });
  it('a moved staging area moves its metadata and the station of every cell with it', () => {
    let d = build(zip);
    d = updateStagingArea(d, d.stagingAreas[0].id, { x: d.stagingAreas[0].x + 2 });
    const out = exportOf(zip, d, 'v5');
    expect(num(get(J(out, 'staging_areas.json'), 'AREA', 'metadata', 'x'))).toBeCloseTo(23, 3);
    const was = get(J(zip, 'graph_object_v5.json'), 'stations_info', 'AREA_A1', 'pose');
    const now = get(J(out, 'graph_object_v5.json'), 'stations_info', 'AREA_A1', 'pose');
    expect(num(now[0]) - num(was[0])).toBeCloseTo(2, 3);
    expect(num(now[1])).toBeCloseTo(num(was[1]), 3);
  });
  it('a station made here is added to every file with the same id; a deleted one is removed from all', () => {
    let d = build(zip);
    d = addStation(d, '', { x: 5, y: 2 }, []).data;
    d = deleteStation(d, d.stations[1].id);
    const out = exportOf(zip, d, 'v5');
    for (const f of ['gmaj.json', 'grid_map_attributes.json'])
      expect([...get(J(out, f), 'stations_info').keys()].filter((k: string) => !k.startsWith('1000'))).toEqual([
        '1',
        '3',
      ]);
    expect([...get(J(out, 'webui_map.json'), 'stations').keys()]).toEqual(['1', '3']);
    expect(get(J(out, 'graph_object_v5.json'), 'stations_info').has('Dock B')).toBe(false);
    const name = get(J(out, 'gmaj.json'), 'stations_info', '3', 'station_name');
    const assoc = get(J(out, 'graph_object_v5.json'), 'stations_info', name, 'associated_nodes');
    expect(assoc.size).toBeGreaterThan(0); // joined to a route node, so the Deployment Manager can route to it
  });
  it('exporting what was just exported changes nothing more (ids handed out once)', () => {
    let d = build(zip);
    const a = d.nodes.find((n) => d.fileNodes?.[n.id] === 'N1')!,
      b = d.nodes.find((n) => d.fileNodes?.[n.id] === 'N4')!;
    d = addRoad(
      d,
      [
        [a.x, a.y],
        [b.x, b.y],
      ],
      { fleetLive: '', nodeA: a.id, nodeB: b.id, snap: 0 },
    ).data;
    d = addStation(d, '', { x: 5, y: 2 }, []).data;
    const out1 = exportOf(zip, d, 'v5');
    const out2 = exportOf(out1, build(out1), 'v5');
    expect(changed(out1, out2).filter((n) => n !== 'map.json')).toEqual([]);
  });
});

describe('v2 (point-to-point) maps', () => {
  const zip = v2Mini();
  it('imports routes between stations, the waypoints in order, direction and turning radius', () => {
    const p = prepareImport(zip).map;
    expect(p.layout).toBe('v2');
    expect(p.roads.map((r) => [r.fromStation, r.toStation, r.points.length, r.heading])).toEqual([
      ['1', '2', 3, 'forward'],
      ['2', '3', 2, 'forward'],
    ]);
    expect(p.roads[1].extra.inplace).toBe(1.5);
    expect(p.gates.map((g) => g.name)).toEqual(['Gate']);
    expect(p.stations.every((s) => s.onLane)).toBe(true);
  });
  it('builds a map whose every station is on a route and whose routes join their stations', () => {
    const d = build(zip);
    expect(d.p2p).toBe(true);
    expect(d.roads.every((r) => r.oneWay)).toBe(true);
    for (const l of d.lanes) {
      const from = d.stations.find((s) => s.nodeId === l.from),
        to = d.stations.find((s) => s.nodeId === l.to);
      expect(from && to).toBeTruthy();
    }
    expect(planTrip(d, '', d.stations[0].id, d.stations[2].id).ok).toBe(true);
    expect(planTrip(d, '', d.stations[2].id, d.stations[0].id).ok).toBe(false); // routes have directions
    expect(d.zones.map((z) => z.type)).toEqual(['exclusive']);
  });
  it('an unedited map comes out byte for byte', () => {
    expect(changed(zip, exportOf(zip, build(zip), 'v2'))).toEqual([]);
  });
  it('an edited route is rewritten everywhere (route, waypoints, planned path, line pieces) and the others are not', () => {
    let d = build(zip);
    const r = d.roads[0];
    d = updateRoad(d, r.id, { points: [r.points[0], [2, 6], [8, 7], r.points[r.points.length - 1]] });
    const out = exportOf(zip, d, 'v2');
    expect(changed(zip, out).sort()).toEqual(['grid_map_attributes.json', 'waypoints.json']);
    const me = get(J(out, 'waypoints.json'), 'map_editor');
    expect(get(me, 'routes', '10', 'node').length).toBe(2);
    expect([...me.get('nodes').values()].map((n: PyObj) => n.get('route_id'))).toEqual([10, 10]);
    const planned = get(J(out, 'waypoints.json'), 'routes');
    expect(planned.length).toBe(2);
    expect(planned[0][1][0][1].some((s: unknown[]) => s[0] === 'turn')).toBe(true);
    expect(planned[1][1][1][0]).toBe('inplace'); // the other route is untouched, in-place turn and all
    expect(get(J(out, 'grid_map_attributes.json'), 'terminal_lines_info').size).toBe(1 + 3); // route 12's piece + the three pieces of route 10
  });
  it('a deleted route and a new two-way route', () => {
    let d = build(zip);
    d = deleteRoad(d, d.roads[1].id);
    d = addRoad(
      d,
      [
        [0, 0],
        [5, -3],
        [20, 0],
      ],
      {
        fleetLive: '',
        nodeA: d.stations[0].nodeId,
        nodeB: d.stations[2].nodeId,
        oneWay: false,
        offset: 0,
        radius: 1,
        snap: 0,
      },
    ).data;
    const out = exportOf(zip, d, 'v2');
    const routes = get(J(out, 'waypoints.json'), 'map_editor', 'routes');
    expect(routes.size).toBe(3); // route 10, and the new road's two routes
    expect([...routes.values()].map((r: PyObj) => `${r.get('from_station')}>${r.get('to_station')}`).sort()).toEqual([
      '1>2',
      '1>3',
      '3>1',
    ]);
    expect(get(J(out, 'waypoints.json'), 'routes').length).toBe(3);
  });
  it('an edited station is written to every file that holds it', () => {
    let d = build(zip);
    d = updateStation(moveStation(d, d.stations[1].id, { x: 11, y: 6 }), d.stations[1].id, { name: 'Dock' });
    const out = exportOf(zip, d, 'v2');
    const me = get(J(out, 'waypoints.json'), 'map_editor', 'stations', '2');
    expect([me.get('name'), num(me.get('x'))]).toEqual(['Dock', 11]);
    expect(get(J(out, 'webui_map.json'), 'stations', '2', 'name')).toBe('Dock');
    expect(num(get(J(out, 'waypoints.json'), 'stations')[1][0])).toBe(11);
    expect(get(J(out, 'grid_map_attributes.json'), 'stations_info', '2', 'station_name')).toBe('Dock');
    // the two routes that end at it were made for its old place: both are worked out again
    expect(changed(zip, out)).toContain('waypoints.json');
  });
  it('exporting what was just exported changes nothing more', () => {
    let d = build(zip);
    d = addRoad(
      d,
      [
        [0, 0],
        [5, -3],
        [20, 0],
      ],
      {
        fleetLive: '',
        nodeA: d.stations[0].nodeId,
        nodeB: d.stations[2].nodeId,
        oneWay: false,
        offset: 0,
        radius: 1,
        snap: 0,
      },
    ).data;
    const out1 = exportOf(zip, d, 'v2');
    const out2 = exportOf(out1, build(out1), 'v2');
    expect(changed(out1, out2).filter((n) => n !== 'map.json')).toEqual([]);
  });
});

const REAL = { v5: '/Users/annuaip/Downloads/TBR_ROTR_YOHT.zip', v2: '/Users/annuaip/Downloads/Brose-Alab.zip' };
describe.skipIf(!existsSync(REAL.v5) || !existsSync(REAL.v2))(
  'the real maps of the Deployment Manager (only where the files are)',
  () => {
    it.each(Object.entries(REAL))(
      '%s: import then export without edits changes no Deployment Manager file',
      (v, path) => {
        const zip = new Uint8Array(readFileSync(path));
        expect(changed(zip, exportOf(zip, build(zip), v))).toEqual([]);
      },
      60000,
    );
  },
);
