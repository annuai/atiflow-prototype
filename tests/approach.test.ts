import { existsSync, readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildMapData } from '@/features/map-import/build';
import { prepareImport } from '@/features/map-import/core/prepare';
import { exportMapZip } from '@/features/map-import/export';
import { parsePy, type PyObj } from '@/features/map-import/dm/pyjson';
import { addRoad } from '@/features/map-editor/model/roads';
import { addStation } from '@/features/map-editor/model/stations';
import {
  resolveNodes,
  addNodeAt,
  removeNode,
  setSlotOn,
  updateSlot,
  stationNodes,
} from '@/features/map-editor/model/approach/nodes';
import { approachOf, withApproach } from '@/features/map-editor/model/approach/params';
import { approachPath, inlaneFromPoint, perpFromPoint } from '@/features/map-editor/model/approach/geometry';
import type { MapData } from '@/features/map-editor/model/types';
import { minRadius, planTrip } from '@/features/map-editor/model/simulate';
import { checkRoutes } from '@/features/map-editor/model/checkRoutes';
import { setThreePointTurn } from '@/features/map-editor/model/approach/nodes';
import { deleteRoad, splitRoad, updateRoad } from '@/features/map-editor/model/roads';
import { LaneGraph } from '@/core/lanes';
import { navOf } from '@/features/map-editor/model/simulate';
import { publishProblems } from '@/features/map-editor/model/validate';
import { setRoleOn } from '@/features/map-editor/model/approach/nodes';

const SAMPLE = '/Users/annuaip/Downloads/amz_tcy5a_draft (1).zip';
const dec = (b: Uint8Array) => new TextDecoder().decode(b);
const get = (m: unknown, ...path: string[]): any => path.reduce((o: any, k) => o?.get(k), m);
const same = (a?: Uint8Array, b?: Uint8Array) => !!a && !!b && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

/** A map with one road and a station standing off it (made here, no source file). */
function mini(): { data: MapData; id: string } {
  let d: MapData = { nodes: [], lanes: [], roads: [], stations: [], stagingAreas: [], zones: [] };
  d = addRoad(
    d,
    [
      [0, 0],
      [20, 0],
    ],
    { fleetLive: 'f' },
  ).data;
  const r = addStation(d, 'f', { x: 10, y: 3 });
  return { data: { ...r.data, stations: r.data.stations.map((s) => ({ ...s, onLane: false, angle: -90 })) }, id: r.id };
}

describe('station nodes', () => {
  it('a station always has one node, found on the nearest lane without being saved', () => {
    const { data, id } = mini();
    const s = data.stations.find((q) => q.id === id)!;
    expect(s.nodes).toBeUndefined();
    const r = resolveNodes(data, s);
    expect(r).toHaveLength(1);
    expect(r[0].auto).toBe(true);
    expect(r[0].at).not.toBeNull();
    expect(Math.abs(r[0].at!.y)).toBeLessThan(1);
  });
  it('a station made before any road gets its node once a road is drawn', () => {
    let d: MapData = { nodes: [], lanes: [], roads: [], stations: [], stagingAreas: [], zones: [] };
    const r = addStation(d, 'f', { x: 10, y: 3 });
    d = r.data;
    expect(resolveNodes(d, d.stations[0])[0].at).toBeNull();
    d = addRoad(
      d,
      [
        [0, 0],
        [20, 0],
      ],
      { fleetLive: 'f' },
    ).data;
    expect(resolveNodes(d, d.stations[0])[0].at).not.toBeNull();
  });
  it('another approach keeps the first one and cannot be on the same node twice', () => {
    const { data, id } = mini();
    const more = addNodeAt(data, id, { x: 4, y: 0 })!;
    const s = more.stations.find((q) => q.id === id)!;
    expect(stationNodes(s)).toHaveLength(2);
    expect(resolveNodes(more, s).every((n) => n.at)).toBe(true);
    expect(addNodeAt(more, id, { x: 4, y: 0 })).toBeNull();
    const less = removeNode(more, id, 1);
    expect(stationNodes(less.stations.find((q) => q.id === id)!)).toHaveLength(1);
    expect(stationNodes(removeNode(less, id, 0).stations.find((q) => q.id === id)!)).toHaveLength(1); // never the last
  });
  it('roles are on or off, maneuvers and distances change one slot only', () => {
    const { data, id } = mini();
    const off = setSlotOn(data, id, 0, 'drop', false);
    const n = stationNodes(off.stations.find((q) => q.id === id)!)[0];
    expect(n.roles.park?.drop).toBeUndefined();
    expect(n.roles.park?.pick).toBeDefined();
    const set = updateSlot(off, id, 0, 'pick', { maneuver: 'inplace', params: { perpendicular_dist: 1.5 } });
    const p = stationNodes(set.stations.find((q) => q.id === id)!)[0].roles.park!.pick!;
    expect(p).toMatchObject({ maneuver: 'inplace', params: { perpendicular_dist: 1.5 } });
  });
});

describe('a station comes in at the nearest point of the route', () => {
  it('a station beside a road joins the road where it is nearest, not at the road end', () => {
    const { data, id } = mini(); // road (0,0)-(20,0), station at (10,3)
    const at = resolveNodes(
      data,
      data.stations.find((q) => q.id === id)!,
    )[0].at!;
    expect(Math.abs(at.x - 10)).toBeLessThan(0.6);
    expect(Math.abs(at.y)).toBeLessThan(0.6);
  });
  it('a station standing on the road comes in at its own point, not at the far end of the road', () => {
    let d: MapData = { nodes: [], lanes: [], roads: [], stations: [], stagingAreas: [], zones: [] };
    d = addRoad(
      d,
      [
        [0, 0],
        [20, 0],
      ],
      { fleetLive: 'f' },
    ).data;
    const r = addStation(d, 'f', { x: 10, y: 0.1 });
    const at = resolveNodes(r.data, r.data.stations[0])[0].at!;
    expect(Math.abs(at.x - 10)).toBeLessThan(0.6);
  });
});

describe('a node is always found', () => {
  it('a node pinned to a node that is gone falls back to the nearest route', () => {
    const { data, id } = mini();
    const gone = {
      ...data,
      stations: data.stations.map((s) => (s.id === id ? { ...s, nodes: [{ id: 'n1', at: 'N-NOPE', roles: {} }] } : s)),
    };
    const r = resolveNodes(
      gone,
      gone.stations.find((q) => q.id === id)!,
    )[0];
    expect(r.at).not.toBeNull();
    expect(r.auto).toBe(true);
  });
  it('a station far from the route still joins it, whatever the distance', () => {
    let d: MapData = { nodes: [], lanes: [], roads: [], stations: [], stagingAreas: [], zones: [] };
    d = addRoad(
      d,
      [
        [0, 0],
        [20, 0],
      ],
      { fleetLive: 'f' },
    ).data;
    const r = addStation(d, 'f', { x: 10, y: 5000 });
    expect(resolveNodes(r.data, r.data.stations[0])[0].at).not.toBeNull();
    const none = addStation({ nodes: [], lanes: [], roads: [], stations: [], stagingAreas: [], zones: [] }, 'f', {
      x: 1,
      y: 1,
    });
    expect(resolveNodes(none.data, none.data.stations[0])[0].at).toBeNull(); // no route at all
  });
});

describe('front or behind', () => {
  it('flips the sign of the distances the maneuver reads and nothing else', () => {
    const slot = { maneuver: 'one_shot_turn' as const, params: { inlane_dist: 3, perpendicular_dist: 0.5, other: 9 } };
    expect(approachOf(slot)).toBe('front');
    const back = withApproach(slot, 'behind');
    expect(back).toMatchObject({ inlane_dist: -3, perpendicular_dist: -0.5, other: 9 });
    expect(approachOf({ ...slot, params: back })).toBe('behind');
    expect(withApproach({ ...slot, params: back }, 'front')).toMatchObject({ inlane_dist: 3, perpendicular_dist: 0.5 });
  });
});

describe('approach geometry', () => {
  const base = {
    node: [10, 0] as [number, number],
    lane: [1, 0] as [number, number],
    station: [10, 3] as [number, number],
    theta: -Math.PI / 2,
  };
  it('a one-shot turn runs from the lane to the station, and the handles give the distances back', () => {
    const slot = { params: { inlane_dist: 3, perpendicular_dist: 0.5 } };
    const p = approachPath({ ...base, role: 'park', slot });
    expect(p.pts[0]).toEqual([7, 0]); // starts 3 m back along the lane
    expect(p.pts.at(-1)).toEqual([10, 3]);
    expect(p.perpAt[0]).toBeCloseTo(10);
    expect(p.perpAt[1]).toBeCloseTo(2.5); // 0.5 m in front of the station (the station faces the lane)
    expect(inlaneFromPoint('park', base.node, base.lane, p.inlaneAt)).toBe(3);
    expect(perpFromPoint(base.station, base.theta, p.perpAt)).toBe(0.5);
  });
  it('negative distances approach from behind', () => {
    const p = approachPath({ ...base, role: 'park', slot: { params: { inlane_dist: -3, perpendicular_dist: -0.5 } } });
    expect(p.inlaneAt[0]).toBeCloseTo(13);
    expect(p.perpAt[1]).toBeCloseTo(3.5);
  });
  it('an in-place pick rotates on the lane, stops in front of the station, then drives in', () => {
    const p = approachPath({
      ...base,
      role: 'park',
      slot: { maneuver: 'inplace', params: { perpendicular_dist: 1.5 } },
    });
    expect(p.marks.map((m) => m.kind)).toEqual(['rotate', 'stop']);
    expect(p.pts).toHaveLength(3);
  });
  it('a three-point turn drives the last stretch in reverse; an unpark is the mirror of a park', () => {
    const park = approachPath({ ...base, role: 'park', slot: { maneuver: 'three_point_turn', params: {} } });
    expect(park.reverseFrom).toBeGreaterThan(0);
    const out = approachPath({ ...base, role: 'unpark', slot: { params: {} } });
    expect(out.pts[0]).toEqual([10, 3]);
  });
});

/** Two stations: A stands off the lane at (10, 3) with two ways in (nodes at x = 10 and x = 4), B stands on the lane at (17, 0). */
function trip() {
  const m = mini();
  const withB = addStation(m.data, 'f', { x: 17, y: 0 });
  const stations = withB.data.stations.map((s) => (s.id === withB.id ? { ...s, onLane: true } : s));
  const data = addNodeAt({ ...withB.data, stations }, m.id, { x: 4, y: 0 })!;
  return { data, a: m.id, b: withB.id };
}
describe('trips go by the nodes that allow them', () => {
  it('leaves by a node that has the Unladen slot on, and only that one', () => {
    const { data, a, b } = trip();
    const first = planTrip(data, 'f', a, b);
    expect(first.ok).toBe(true);
    const off0 = setRoleOn(data, a, 0, 'unpark', false); // node 1 no longer lets robots leave
    const p = planTrip(off0, 'f', a, b);
    expect(p.ok && p.via.start).toBe(2);
    const none = setRoleOn(off0, a, 1, 'unpark', false);
    expect(planTrip(none, 'f', a, b)).toMatchObject({ ok: false, reason: 'no-node', station: a, slot: 'unladen' });
  });
  it('arrives to pick by one node and to drop by another', () => {
    const { data, a, b } = trip();
    let d = setSlotOn(data, a, 0, 'drop', false); // node 1: pick only
    d = setSlotOn(d, a, 1, 'pick', false); // node 2: drop only
    const pick = planTrip(d, 'f', b, a, { pick: true });
    const drop = planTrip(d, 'f', b, a, { pick: false });
    expect(pick.ok && pick.via.end).toBe(1);
    expect(drop.ok && drop.via.end).toBe(2);
  });
  it('a robot that cannot drive the maneuver turns on the spot, and the plan says so', () => {
    const { data, a, b } = trip();
    const d = updateSlot(data, a, 0, 'unladen', { maneuver: 'three_point_turn' });
    const d2 = setRoleOn(d, a, 1, 'unpark', false);
    const can = planTrip(d2, 'f', a, b, { robot: 'Sherpa XT Lite' });
    const cannot = planTrip(d2, 'f', a, b, { robot: 'Pallet Mover' });
    expect(can.ok && can.notes).toHaveLength(0);
    expect(cannot.ok && cannot.notes).toEqual([{ robot: 'Pallet Mover', maneuver: 'three_point_turn' }]);
  });
  it('the path leaves the station, follows the lane and ends at the station', () => {
    const { data, a, b } = trip();
    const p = planTrip(data, 'f', a, b);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.pts[0]).toMatchObject({ x: 10, y: 3 });
    expect(Math.hypot(p.pts.at(-1)!.x - 17, p.pts.at(-1)!.y)).toBeLessThan(0.6);
  });
  it('Publish is blocked while an off-lane station has no way in or no way out', () => {
    const { data, a } = trip();
    const off = setRoleOn(setRoleOn(data, a, 0, 'park', false), a, 1, 'park', false);
    const out = publishProblems(off, null, () => []);
    expect(out.some((q) => q.level === 'block' && q.stationId === a)).toBe(true);
    expect(publishProblems(data, null, () => []).some((q) => q.stationId === a)).toBe(false);
  });
});

describe('lane weight', () => {
  /** Two roads from A to B: a short one and a long way round. */
  function twoWays(): MapData {
    let d: MapData = { nodes: [], lanes: [], roads: [], stations: [], stagingAreas: [], zones: [] };
    d = addRoad(
      d,
      [
        [0, 0],
        [10, 0],
      ],
      { fleetLive: 'f', oneWay: true, name: 'short' },
    ).data;
    d = addRoad(
      d,
      [
        [0, 0],
        [0, 6],
        [10, 6],
        [10, 0],
      ],
      { fleetLive: 'f', oneWay: true, name: 'long' },
    ).data;
    return d;
  }
  const first = (d: MapData) => {
    const nav = navOf(d, 'f');
    const g = new LaneGraph(nav);
    const a = d.nodes.find((n) => n.x === 0 && n.y === 0)!,
      b = d.nodes.find((n) => n.x === 10 && n.y === 0)!;
    return g.route(a.id, b.id, 'f')!.map((l) => l.id);
  };
  it('the router takes the cheapest way, and a heavier lane is avoided until it is the only one', () => {
    const d = twoWays();
    const short = d.roads.find((r) => r.name === 'short')!;
    expect(first(d)).toEqual(short.laneIds);
    const heavy = updateRoad(d, short.id, { weight: 100 });
    expect(heavy.roads.find((r) => r.id === short.id)!.weight).toBe(100);
    expect(first(heavy)).not.toEqual(short.laneIds);
    const back = updateRoad(heavy, short.id, { weight: null });
    expect(back.roads.find((r) => r.id === short.id)!.weight).toBeUndefined();
    expect(first(back)).toEqual(short.laneIds);
    expect(back.lanes.every((l) => l.weight === undefined)).toBe(true);
  });
  it('a road that is cut keeps its weight, shared by length', () => {
    const d = twoWays();
    const road = d.roads.find((r) => r.name === 'short')!;
    const w = updateRoad(d, road.id, { weight: 40 });
    const node = { id: 'N-X', x: 5, y: 0, kind: 'waypoint' as const };
    const cut = splitRoad({ ...w, nodes: [...w.nodes, node] }, road.id, 0, node)!;
    const parts = cut.roads.filter((r) => r.name.startsWith('short'));
    expect(parts).toHaveLength(2);
    expect(parts.reduce((n, r) => n + (r.weight ?? 0), 0)).toBeCloseTo(40, 1);
  });
});

describe('the three-point turn and the route check', () => {
  it('changes the size of the box only for a station that asks for a three-point turn', () => {
    const { data, id } = mini();
    expect(setThreePointTurn(data, id, { aisleWidth: 9 })).toEqual(data);
    const on = {
      ...data,
      stations: data.stations.map((s) =>
        s.id === id
          ? {
              ...s,
              features: {
                threePointTurn: {
                  startDirection: 'left' as const,
                  startAction: 'forward' as const,
                  aisleWidth: 4,
                  aisleLength: 6,
                },
              },
            }
          : s,
      ),
    };
    const next = setThreePointTurn(on, id, { aisleWidth: 7 });
    expect(next.stations.find((s) => s.id === id)!.features!.threePointTurn).toMatchObject({
      aisleWidth: 7,
      aisleLength: 6,
    });
  });
  it('measures the tightest turn of a path', () => {
    expect(
      minRadius([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ).toBeNull();
    const arc = Array.from({ length: 40 }, (_, i) => ({ x: 3 * Math.cos(i / 10), y: 3 * Math.sin(i / 10) }));
    expect(minRadius(arc)).toBeCloseTo(3, 0);
  });
  it('checks every pair for each robot type and reports what cannot be driven', async () => {
    const { data } = trip();
    const ok = await checkRoutes(data, { fleet: 'f', robots: ['Sherpa XT Lite'] });
    expect(ok.stations).toBe(2);
    expect(ok.checked).toBeGreaterThanOrEqual(2);
    expect(ok.findings.filter((f) => f.kind !== 'tight')).toEqual([]);
    const cut = data.roads.reduce((m, r) => deleteRoad(m, r.id), data);
    const bad = await checkRoutes(cut, { fleet: 'f', robots: ['Sherpa XT Lite', 'Pallet Mover'] });
    expect(bad.findings.some((f) => f.kind === 'unlinked' || f.kind === 'no-route')).toBe(true);
    expect(bad.robots).toEqual(['Sherpa XT Lite', 'Pallet Mover']);
  });
  it('can be stopped', async () => {
    const { data } = trip();
    let calls = 0;
    const r = await checkRoutes(data, { fleet: 'f', robots: ['Sherpa XT Lite'], shouldStop: () => ++calls > 0 });
    expect(r.checked).toBeLessThanOrEqual(8);
  });
});

describe.skipIf(!existsSync(SAMPLE))('the real amz_tcy5a export', () => {
  const zip = () => new Uint8Array(readFileSync(SAMPLE));
  const build = () => buildMapData(prepareImport(zip()), [], []);
  it('reads the nodes and their roles from the file', () => {
    const d = build();
    const s = d.stations.find((q) => q.name === 'parking_03')!;
    expect(s.nodes).toHaveLength(1);
    expect(s.nodes![0].roles.park?.pick).toMatchObject({ maneuver: 'inplace', params: { perpendicular_dist: 2 } });
    expect(s.nodes![0].roles.unpark?.laden).toBeDefined();
    expect(s.nodes![0].at).toBeDefined();
    const plain = d.stations.find((q) => q.nodes?.[0].roles.park?.pick?.maneuver === undefined)!;
    expect(plain.nodes![0].roles.park?.pick).toEqual({ params: {} });
  });
  it('exports an untouched map byte for byte', () => {
    const d = build();
    const out = exportMapZip({ original: zip(), data: d, name: 'x', version: '2' });
    const a = unzipSync(zip()),
      b = unzipSync(out);
    for (const k of Object.keys(a)) if (!k.endsWith('/')) expect(same(a[k], b[k]), k).toBe(true);
  });
  it('writes a custom lane weight to the line and reads it back (a line cut in pieces shares it by length)', () => {
    const d = build();
    const ext = (r: { extra?: Record<string, unknown> }) =>
      (r.extra?.dm as { externalId?: string } | undefined)?.externalId;
    const road = d.roads.find((r) => ext(r))!;
    const id = ext(road)!;
    const edited = updateRoad(d, road.id, { weight: 50 });
    const total = (m: MapData) =>
      m.roads
        .filter((r) => ext(r) === id)
        .reduce((n, r) => n + (r.weight ?? m.lanes.find((l) => l.id === r.laneIds[0])!.len), 0);
    const out = exportMapZip({ original: zip(), data: edited, name: 'x', version: '2' });
    const files = unzipSync(out);
    const gmaj = parsePy(dec(files[Object.keys(files).find((k) => k.endsWith('/gmaj.json'))!])) as PyObj;
    const written = get(gmaj, 'terminal_lines_info', id, 'custom_weight');
    expect(Number(written?.value ?? written)).toBeCloseTo(total(edited), 1);
    const again = buildMapData(prepareImport(out), [], []);
    expect(total(again)).toBeCloseTo(total(edited), 1);
  });
  it('writes a changed maneuver to the three files and nothing else', () => {
    const d = build();
    const s = d.stations.find((q) => q.name === 'parking_03')!;
    const edited = updateSlot(d, s.id, 0, 'pick', {
      maneuver: 'one_shot_turn',
      params: { inlane_dist: 3, perpendicular_dist: 0.5 },
    });
    const out = unzipSync(exportMapZip({ original: zip(), data: edited, name: 'x', version: '2' }));
    const orig = unzipSync(zip());
    const changed = Object.keys(orig).filter((k) => !k.endsWith('/') && !same(orig[k], out[k]));
    expect(changed.map((k) => k.split('/').pop()).sort()).toEqual([
      'gmaj.json',
      'graph_object_v5.json',
      'grid_map_attributes.json',
    ]);
    const gmaj = parsePy(dec(out[Object.keys(out).find((k) => k.endsWith('/gmaj.json'))!])) as PyObj;
    const st = [...get(gmaj, 'stations_info').values()].find((v: any) => get(v, 'station_name') === 'parking_03');
    const pick = get(st, 'nodes')[0].get('park').get('pick');
    expect(pick.get('maneuver')).toBe('one_shot_turn');
    expect(pick.get('params').get('inlane_dist')).toBe(3);
    expect(get(st, 'nodes')[0].get('park').get('drop').get('maneuver')).toBe('inplace'); // the other slots stay as they were
  });
});
