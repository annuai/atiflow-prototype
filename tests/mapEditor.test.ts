import { FLEET_ID } from '../src/data/fleets';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { NavGraph, SiteLayout } from '../src/core/types';
import { seedMapData } from '../src/features/map-editor/model/seed';
import {
  addStation,
  deleteStation,
  moveStation,
  nameProblem,
  nextStationId,
  updateStation,
} from '../src/features/map-editor/model/stations';
import { draftOf, latestOf, mapVersionsStore, publishedOf } from '../src/features/map-editor/model/store';
import { onRoad, publishProblems } from '../src/features/map-editor/model/validate';
import { workflowsUsing } from '../src/features/map-editor/model/usage';
import { areasByFleet, areasOfHistory, visibleCells } from '../src/features/master-data/model/mapAreas';
import { addRoad, deleteRoad, roadAngle, updateRoad } from '../src/features/map-editor/model/roads';
import {
  addStagingArea,
  cellCenter,
  cellRef,
  deleteStagingArea,
  totalCells,
  updateStagingArea,
} from '../src/features/map-editor/model/staging';
import { addZone, deleteZone } from '../src/features/map-editor/model/zones';
import { newGate, polygonOf, rectFromCorners } from '../src/features/map-editor/model/shape';
import { normaliseData } from '../src/features/map-editor/model/seed';
import { emptyHistory, record, redo, undo } from '../src/features/map-editor/model/history';
import { locateTarget } from '../src/features/map-editor/model/locate';
import { pinchStep } from '../src/components/map/useTouchGestures';
import { planTrip } from '../src/features/map-editor/model/simulate';
import { ZONE_TYPES, zoneType, zoneTypesOf } from '../src/features/map-editor/model/zoneTypes';
import { sampleWorkflows } from '../src/fixtures/workflows';

const site = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8')) as SiteLayout,
  nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
const lineSide = () => seedMapData({ fleetLive: 'line-side' }, site, nav),
  assembly = () => seedMapData({ fleetLive: 'asrs' }, site, nav);

describe('a map owns its full network, seeded from the real site', () => {
  it("each map holds ITS fleet's lanes, stations and zones and the nodes they use; two maps differ in their stations", () => {
    const a = lineSide(),
      b = assembly();
    expect(a.stations.every((s) => s.fleets.includes('line-side'))).toBe(true);
    expect(b.stations.every((s) => s.fleets.includes('asrs'))).toBe(true);
    expect(a.stations.map((s) => s.id)).toContain('STA-107');
    expect(a.stations.map((s) => s.id)).not.toContain('STA-113');
    expect(b.stations.map((s) => s.id)).toContain('STA-113');
    const nodeIds = new Set(a.nodes.map((n) => n.id));
    expect(a.lanes.every((l) => nodeIds.has(l.from) && nodeIds.has(l.to))).toBe(true);
    expect(a.stations.every((s) => nodeIds.has(s.nodeId))).toBe(true);
    expect(a.zones.some((z) => z.type === 'exclusive' && typeof z.props.capacity === 'number')).toBe(true);
    expect(a.zones.some((z) => z.type === 'no-go')).toBe(true);
    expect(a.zones.some((z) => z.type === 'area')).toBe(true);
  });
  it('the data is a copy: editing a map never changes the site files', () => {
    const a = lineSide();
    a.stations[0].name = 'changed';
    expect(nav.stations.find((s) => s.id === a.stations[0].id)!.name).not.toBe('changed');
  });
  it('every seeded station is on a road', () => {
    const d = lineSide();
    expect(d.stations.filter((s) => !onRoad(d, s.id))).toEqual([]);
  });
});

describe('station edits (pure)', () => {
  it("a new station gets the next free id (above the other maps' ids too), its own node, a default name and the map's fleet", () => {
    const d = lineSide();
    const taken = nav.stations.map((s) => s.id);
    const r = addStation(d, 'line-side', { x: 10.123, y: 20.987 }, taken);
    expect(r.id).toBe('STA-134');
    expect(nextStationId(r.data, taken)).toBe('STA-135');
    const s = r.data.stations.find((q) => q.id === r.id)!;
    expect(s).toMatchObject({ fleets: ['line-side'], type: 'drop', nodeId: 'N-STA-134' });
    expect(r.data.nodes.find((n) => n.id === s.nodeId)).toMatchObject({ x: 10.12, y: 20.99, kind: 'station' });
    expect(d.stations.length).toBe(r.data.stations.length - 1); // the old data is untouched
    expect(onRoad(r.data, r.id)).toBe(false);
  });
  it('rename, retype and move change only that station; delete removes it and its node unless a lane uses it', () => {
    const r = addStation(lineSide(), 'line-side', { x: 5, y: 5 });
    let d = updateStation(r.data, r.id, { name: 'Dock A', type: 'pick' });
    d = moveStation(d, r.id, { x: 6, y: 7 });
    expect(d.stations.find((s) => s.id === r.id)).toMatchObject({ name: 'Dock A', type: 'pick' });
    expect(d.nodes.find((n) => n.id === `N-${r.id}`)).toMatchObject({ x: 6, y: 7 });
    expect(deleteStation(d, r.id).nodes.some((n) => n.id === `N-${r.id}`)).toBe(false);
    const on = lineSide();
    const s = on.stations[0];
    const after = deleteStation(on, s.id);
    expect(after.stations.some((q) => q.id === s.id)).toBe(false);
    expect(after.nodes.find((n) => n.id === s.nodeId)?.kind).toBe('waypoint');
  });
  it('a name must be given and unique in the map (ignoring case)', () => {
    const d = lineSide();
    const [a, b] = d.stations;
    expect(nameProblem(d, a.id, '  ')).toBeTruthy();
    expect(nameProblem(d, a.id, b.name.toUpperCase())).toBeTruthy();
    expect(nameProblem(d, a.id, a.name)).toBe('');
    expect(nameProblem(d, a.id, 'A new name')).toBe('');
  });
});

describe('the publish gate', () => {
  const used = (id: string) => workflowsUsing(sampleWorkflows(), FLEET_ID.lineSide, id);
  it('blocks an On route station no route reaches (an Off route one is fine), an unnamed or duplicate name, and a deleted station that a published workflow uses', () => {
    const base = lineSide();
    expect(publishProblems(base, base, used)).toEqual([]);
    const off = addStation(base, 'line-side', { x: 1, y: 1 });
    expect(publishProblems(off.data, base, used).map((p) => p.title)).toEqual([
      expect.stringMatching(/no route reaches it/),
    ]);
    expect(publishProblems(updateStation(off.data, off.id, { onLane: false }), base, used)).toEqual([]);
    expect(
      publishProblems(updateStation(base, base.stations[0].id, { name: ' ' }), base, used).some((p) =>
        /has no name/.test(p.title),
      ),
    ).toBe(true);
    expect(
      publishProblems(updateStation(base, base.stations[0].id, { name: base.stations[1].name }), base, used).some((p) =>
        /share the name/.test(p.title),
      ),
    ).toBe(true);
    const gone = deleteStation(base, 'STA-107');
    const p = publishProblems(gone, base, used);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ level: 'block', stationId: 'STA-107' });
    expect(p[0].detail).toContain('Chain Pin to Workstation 1');
    expect(
      publishProblems(deleteStation(base, base.stations.find((s) => used(s.id).length === 0)!.id), base, used),
    ).toEqual([]); // a station no workflow uses may go
  });
  it('workflows are matched by station in Station, Confirm and If Logic steps of PUBLISHED workflows of that fleet only', () => {
    expect(used('STA-116')).toEqual(['Chain Pin to Workstation 1']);
    expect(workflowsUsing(sampleWorkflows(), FLEET_ID.assembly, 'STA-116')).toEqual(['Coupling Pad to Preparation 1']);
    expect(used('STA-999')).toEqual([]);
  });
});

describe('versions: one draft, read-only published versions', () => {
  beforeEach(() => mapVersionsStore.getState().reset());
  const s = () => mapVersionsStore.getState();
  const h = () => s().byMap.m;
  it('the first version is published once; a draft is a copy of the latest; only the draft changes; publish makes the next version and closes the draft', () => {
    s().ensure('m', 5, lineSide(), 1);
    s().ensure('m', 9, assembly(), 2);
    expect(publishedOf(h()).map((v) => v.number)).toEqual([5]); // a second ensure does nothing
    const d = s().startDraft('m', 'Kavin', undefined, 3)!;
    expect(d).toMatchObject({ status: 'draft', basedOn: 5, number: null });
    expect(s().startDraft('m', 'Other')!.id).toBe(d.id); // one draft only
    s().updateDraft('m', (x) => addStation(x, 'line-side', { x: 1, y: 1 }).data);
    expect(draftOf(h())!.data.stations.length).toBe(latestOf(h())!.data.stations.length + 1); // the published version is untouched
    expect(s().publish('m', 'Kavin', 4)).toBe(6);
    expect(draftOf(h())).toBeUndefined();
    expect(publishedOf(h()).map((v) => v.number)).toEqual([6, 5]);
    expect(latestOf(h())!.publishedBy).toBe('Kavin');
    s().updateDraft('m', () => {
      throw new Error('must not run without a draft');
    }); // no draft: nothing is edited
  });
  it('restore puts an older version into the draft (starting one when there is none); discard removes only the draft', () => {
    s().ensure('m', 5, lineSide(), 1);
    s().startDraft('m', 'K');
    s().updateDraft('m', (x) => addStation(x, 'line-side', { x: 1, y: 1 }).data);
    s().publish('m', 'K'); // v6 has one more station than v5
    expect(s().restoreToDraft('m', 5, 'K')!.basedOn).toBe(5);
    expect(draftOf(h())!.data.stations.length).toBe(lineSide().stations.length);
    s().updateDraft('m', (x) => addStation(x, 'line-side', { x: 2, y: 2 }).data);
    s().restoreToDraft('m', 6, 'K');
    expect(draftOf(h())!.data.stations.length).toBe(lineSide().stations.length + 1);
    expect(draftOf(h())!.basedOn).toBe(6);
    s().discardDraft('m');
    expect(draftOf(h())).toBeUndefined();
    expect(publishedOf(h())).toHaveLength(2);
  });
});

describe('zone types', () => {
  it('the registry has the exclusive / no-go / area types and the generic ones; an unknown type still draws', () => {
    expect(ZONE_TYPES.map((t) => t.id)).toEqual(expect.arrayContaining(['exclusive', 'no-go', 'area', 'low-speed']));
    expect(zoneType('exclusive').fields[0]).toMatchObject({ key: 'capacity', default: 1 });
    expect(zoneType('whatever').id).toBe('whatever');
    expect(zoneTypesOf('exclusive').map((t) => t.id)).toContain('exclusive');
    expect(zoneTypesOf('zones').map((t) => t.id)).toContain('low-speed');
  });
});

describe('roads, zones and staging areas', () => {
  const road = (): [number, number][] => [
    [5, 5],
    [5, 15],
    [12, 20],
  ];
  it('a road makes one lane per direction, offset to the right; one-way makes a single lane; deleting removes its lanes', () => {
    const d0 = lineSide();
    const r = addRoad(d0, road(), { fleetLive: 'line-side' });
    const road1 = r.data.roads.find((x) => x.id === r.id)!;
    expect(road1.laneIds).toHaveLength(2);
    expect(r.data.lanes.length).toBe(d0.lanes.length + 2);
    expect(addRoad(d0, road(), { fleetLive: 'line-side', oneWay: true }).data.lanes.length).toBe(d0.lanes.length + 1);
    expect(deleteRoad(r.data, r.id!).lanes.length).toBe(d0.lanes.length);
    expect(addRoad(d0, [[1, 1]], { fleetLive: 'line-side' }).id).toBeNull();
  });
  it('a road can be edited: end points, one lane or two, swapped direction; it keeps its id and name and stays joined where an end did not move', () => {
    const d0 = lineSide();
    const r = addRoad(
      d0,
      [
        [5, 5],
        [15, 5],
      ],
      { fleetLive: 'line-side', name: 'Aisle' },
    );
    const id = r.id!;
    const lanesOf = (d: typeof d0) => d.lanes.filter((l) => d.roads.find((x) => x.id === id)!.laneIds.includes(l.id));
    expect(roadAngle(r.data.roads.find((x) => x.id === id)!)).toBe(0);
    const one = updateRoad(r.data, id, { oneWay: true });
    expect(lanesOf(one)).toHaveLength(1);
    expect(one.roads.find((x) => x.id === id)).toMatchObject({ name: 'Aisle', oneWay: true });
    expect(one.lanes.length).toBe(d0.lanes.length + 1);
    const swapped = updateRoad(one, id, { swap: true });
    const [l0] = lanesOf(one),
      [l1] = lanesOf(swapped);
    expect([l1.from, l1.to]).toEqual([l0.to, l0.from]);
    const moved = updateRoad(r.data, id, {
      points: [
        [5, 5],
        [15, 9],
      ],
    });
    expect(roadAngle(moved.roads.find((x) => x.id === id)!)).toBeGreaterThan(0);
    expect(lanesOf(moved)).toHaveLength(2);
    expect(lanesOf(moved)[0].from).toBe(lanesOf(r.data)[0].from); // the start did not move: same node
    expect(updateRoad(r.data, id, { heading: 'forward' }).roads.find((x) => x.id === id)!.heading).toBe('forward');
    expect(updateRoad(r.data, id, { heading: 'forward' }).lanes).toBe(r.data.lanes);
    expect(d0.nodes.every((n) => moved.nodes.some((m) => m.id === n.id))).toBe(true); // nothing that was there is lost
  });
  it('zones: a box and a gate are traffic gates; unnamed types get default props', () => {
    const d0 = lineSide();
    const z = addZone(d0, 'exclusive', rectFromCorners([1, 1], [3, 4]));
    expect(z.data.zones.find((q) => q.id === z.id)).toMatchObject({ type: 'exclusive', props: { capacity: 1 } });
    expect(polygonOf(newGate([0, 0], [4, 0]))).toHaveLength(4);
    expect(deleteZone(z.data, z.id).zones).toHaveLength(d0.zones.length);
  });
  it('staging cells: A1 is the first cell, columns run along the direction, rows to the right', () => {
    const d = addStagingArea(lineSide(), { x: 10, y: 10 });
    const a = d.data.stagingAreas.find((q) => q.id === d.id)!;
    expect(cellRef(1, 1)).toBe('A1');
    expect(cellRef(2, 27)).toBe('AA2');
    expect(cellCenter(a, 1, 1)).toMatchObject({ x: 10, y: 10 });
    expect(totalCells(a)).toBe(a.rows * a.cols);
    expect(addStagingArea(d.data, { x: 1, y: 1 }, [d.id]).id).not.toBe(d.id);
  });
  it('older saved data is completed with roads and no staging areas', () => {
    const { roads: _r, stagingAreas: _s, ...old } = lineSide();
    const n = normaliseData(old);
    expect(n.roads.length).toBeGreaterThan(0);
    expect(n.stagingAreas).toEqual([]);
  });
});

describe('staging areas: the map defines them, Master Data keeps the cell states', () => {
  const withArea = (rows: number, cols: number) =>
    updateStagingArea(addStagingArea({ ...lineSide(), stagingAreas: [] }, { x: 10, y: 10 }).data, 'SA-001', {
      rows,
      cols,
    });
  it('only the latest PUBLISHED version shows; cells outside a smaller grid are hidden; states survive a new version', () => {
    mapVersionsStore.getState().reset();
    const st = mapVersionsStore.getState();
    st.ensure('m', 5, withArea(4, 4), 1);
    const cell = (state: 'filled' | 'blocked') => ({ state, updatedAt: 0, updatedBy: 'system' }) as const;
    const cells = { '1-1': cell('filled'), '4-4': cell('blocked') };
    const get = () => areasOfHistory(mapVersionsStore.getState().byMap.m, () => ({ cells: { ...cells } }))!;
    expect(get().areas[0].cells).toEqual(cells);
    st.startDraft('m', 'K');
    st.updateDraft('m', () => withArea(2, 2));
    expect(get().areas[0].rows).toBe(4); // a draft is never shown
    st.publish('m', 'K');
    expect(get()).toMatchObject({ version: 6 });
    expect(get().areas[0].cells).toEqual({ '1-1': cell('filled') }); // 4-4 is outside now, hidden not deleted
    expect(visibleCells({ '3-3': cell('blocked') }, 2, 2)).toEqual({});
  });
  it('areas are grouped by fleet through its assigned map; a fleet without a map or areas has none', () => {
    mapVersionsStore.getState().reset();
    mapVersionsStore.getState().ensure('m', 5, withArea(2, 2), 1);
    const g = areasByFleet(
      ['A', 'B'],
      (f) => (f === 'A' ? 'm' : null),
      () => 'Map M',
      mapVersionsStore.getState().byMap,
      () => undefined,
    );
    expect(g[0]).toMatchObject({ fleet: 'A', mapName: 'Map M', version: 5 });
    expect(g[0].areas).toHaveLength(1);
    expect(g[1]).toMatchObject({ fleet: 'B', version: null, areas: [] });
  });
  it('publishing is blocked when a Filled cell would be deleted or cut off, but only warned for Blocked ones', () => {
    const prev = withArea(4, 4);
    const cut = updateStagingArea(prev, 'SA-001', { rows: 2, cols: 2 });
    const probs = (states: Record<string, 'filled' | 'blocked'>) =>
      publishProblems(
        cut,
        prev,
        () => [],
        () => states,
      );
    expect(probs({ '4-4': 'filled' }).some((p) => p.level === 'block')).toBe(true);
    expect(probs({ '4-4': 'blocked' }).some((p) => p.level === 'block')).toBe(false);
    expect(
      publishProblems(
        deleteStagingArea(prev, 'SA-001'),
        prev,
        () => [],
        () => ({ '1-1': 'filled' }),
      ).some((p) => p.level === 'block'),
    ).toBe(true);
  });
});

describe("simulation: a robot drives from one station to another on the map's own lanes", () => {
  it('plans a route between two stations of the map, and says why when it cannot', () => {
    const d = lineSide();
    const work = d.stations.filter((x) => x.type !== 'park' && x.type !== 'charge');
    const [a, b] = [work[0].id, work[work.length - 1].id];
    const t = planTrip(d, 'line-side', a, b);
    expect(t.ok).toBe(true);
    if (t.ok) {
      expect(t.len).toBeGreaterThan(1);
      expect(t.pts.length).toBeGreaterThan(2);
    }
    expect(planTrip(d, 'line-side', a, a)).toEqual({ ok: false, reason: 'same' });
    expect(planTrip(d, 'line-side', a, 'NOPE')).toEqual({ ok: false, reason: 'missing' });
    const lonely = addStation(d, 'line-side', { x: 1, y: 1 });
    expect(planTrip(lonely.data, 'line-side', a, lonely.id)).toEqual({ ok: false, reason: 'no-route' }); // placed on no road
    expect(planTrip(d, 'asrs', a, b).ok).toBe(false); // another fleet's lanes are not used
  });
});

describe('undo and redo of the draft', () => {
  it('each change is a step; undo and redo walk through them; a new change drops the redo steps; quick changes with one key (a drag) are one step', () => {
    let h = emptyHistory<number>();
    h = record(h, 1, undefined, 0);
    h = record(h, 2, undefined, 10);
    expect(h.past).toEqual([1, 2]);
    const u = undo(h, 3)!;
    expect([u.value, u.history.past, u.history.future]).toEqual([2, [1], [3]]);
    const r = redo(u.history, 2)!;
    expect([r.value, r.history.past, r.history.future]).toEqual([3, [1, 2], []]);
    expect(undo(emptyHistory<number>(), 1)).toBeNull();
    expect(redo(emptyHistory<number>(), 1)).toBeNull();
    expect(record(u.history, 2, undefined, 20).future).toEqual([]);
    let d = emptyHistory<number>();
    d = record(d, 10, 'move:A', 0);
    d = record(d, 11, 'move:A', 100);
    d = record(d, 12, 'move:A', 200);
    expect(d.past).toEqual([10]); // one drag, one step
    d = record(d, 13, 'move:A', 5000);
    expect(d.past).toEqual([10, 13]);
    d = record(d, 14, 'move:B', 5100);
    expect(d.past).toEqual([10, 13, 14]); // later or another thing: a new step
    let big = emptyHistory<number>();
    for (let i = 0; i < 150; i++) big = record(big, i, undefined, i);
    expect(big.past).toHaveLength(100);
  });
});

describe('locate on the map', () => {
  it('finds the centre and size of a station, staging area, road and zone; nothing for a thing that is not in this version', () => {
    const d = lineSide();
    const st = d.stations[0];
    const t = locateTarget(d, { kind: 'station', id: st.id })!;
    expect(t.span).toBe(0);
    expect(Number.isFinite(t.x) && Number.isFinite(t.y)).toBe(true);
    const a = locateTarget(d, { kind: 'staging', id: d.stagingAreas[0].id })!;
    expect(a.span).toBeGreaterThan(5);
    const r = locateTarget(d, { kind: 'road', id: d.roads[0].id })!;
    expect(r.span).toBeGreaterThan(0);
    const z = d.zones.find((q) => q.type === 'exclusive')!;
    const zt = locateTarget(d, { kind: 'zone', id: z.id })!;
    const xs = z.polygon.map((p) => p[0]);
    expect(zt.x).toBeCloseTo((Math.min(...xs) + Math.max(...xs)) / 2);
    expect(locateTarget(d, { kind: 'station', id: 'NOPE' })).toBeNull();
    expect(locateTarget(d, { kind: 'zone', id: 'NOPE' })).toBeNull();
  });
});

describe('two-finger gestures on a map', () => {
  it('spreading the fingers zooms in, pinching zooms out, moving both pans; fingers on the same spot do not divide by zero', () => {
    const a = pinchStep(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      [
        { x: -50, y: 0 },
        { x: 150, y: 0 },
      ],
    );
    expect(a.scale).toBeCloseTo(2);
    expect([a.mid.x, a.dx, a.dy]).toEqual([50, 0, 0]);
    expect(
      pinchStep(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        [
          { x: 25, y: 0 },
          { x: 75, y: 0 },
        ],
      ).scale,
    ).toBeCloseTo(0.5);
    const p = pinchStep(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      [
        { x: 10, y: 20 },
        { x: 110, y: 20 },
      ],
    );
    expect(p.scale).toBe(1);
    expect([p.dx, p.dy]).toEqual([10, 20]);
    expect(
      pinchStep(
        [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ],
        [
          { x: 0, y: 0 },
          { x: 9, y: 9 },
        ],
      ).scale,
    ).toBe(1);
  });
});
