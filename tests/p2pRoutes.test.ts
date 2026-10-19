import { describe, expect, it } from 'vitest';
import { buildMapData } from '@/features/map-import/build';
import { prepareImport } from '@/features/map-import/core/prepare';
import { routeLine, routeSegments } from '@/features/map-editor/model/fillet';
import {
  addReverseRoute,
  addRoute,
  addRouteNode,
  deleteRouteNode,
  moveRouteNode,
  nodeRadius,
  routeEnds,
  routeNodes,
  setNodeRadius,
  setRouteEnds,
} from '@/features/map-editor/model/routes';
import { routable } from '@/features/map-editor/model/connect';
import { publishProblems } from '@/features/map-editor/model/validate';
import { planTrip } from '@/features/map-editor/model/simulate';
import { v2Mini } from './helpers/dmZips';

const build = () => buildMapData(prepareImport(v2Mini()), [], [], undefined, []);
const road = (d: ReturnType<typeof build>, i = 0) => d.roads[i];
const noUse = () => [];

describe('turns of a route (per-node radius)', () => {
  const pts: [number, number][] = [
    [0, 0],
    [0, 6],
    [10, 6],
  ];
  it('rounds a corner with its own radius, and keeps it sharp at 0', () => {
    const round = routeSegments(pts, 1, [2]);
    expect(round.map((s) => s.kind)).toEqual(['straight', 'turn', 'straight']);
    expect(round.find((s) => s.kind === 'turn')!.r).toBeCloseTo(2, 3);
    const sharp = routeSegments(pts, 1, [0]);
    expect(sharp.map((s) => s.kind)).toEqual(['straight', 'straight']);
    expect(sharp[0].to).toEqual([0, 6]); // the corner is kept, not cut
    expect(routeLine(pts, 1, [0])).toEqual(pts);
  });
  it('a turn never needs more room than half of each side', () => {
    const t = routeSegments(pts, 50).find((s) => s.kind === 'turn')!;
    expect(t.r!).toBeLessThanOrEqual(3 + 1e-6);
  });
});

describe('editing a point-to-point route', () => {
  it('a route is made by clicking two stations: one-way, straight, ends on the stations', () => {
    const d = build();
    const r = addRoute(d, d.stations[2].id, d.stations[0].id, '');
    expect(r.id).toBeTruthy();
    const made = r.data.roads.find((q) => q.id === r.id)!;
    expect(made.oneWay).toBe(true);
    expect(made.points.length).toBe(2);
    expect(routeEnds(r.data, made).from?.id).toBe(d.stations[2].id);
    expect(addRoute(d, d.stations[0].id, d.stations[0].id, '').id).toBeNull(); // not from a station to itself
    expect(planTrip(r.data, '', d.stations[2].id, d.stations[0].id).ok).toBe(true);
  });
  it('a double-click adds a node, dragging it bends the route, its radius and deletion work', () => {
    let d = build();
    const id = road(d, 1).id; // S2 -> S3, straight
    const a = addRouteNode(d, id, [15, 3]);
    d = a.data;
    expect(a.index).toBe(0);
    expect(routeNodes(road(d, 1)).length).toBe(1);
    d = moveRouteNode(d, id, 0, [15, -4]);
    expect(routeNodes(road(d, 1))[0]).toEqual([15, -4]);
    d = setNodeRadius(d, id, 0, 2);
    expect(nodeRadius(road(d, 1), 0)).toBe(2);
    expect(setNodeRadius(d, id, 0, 99).roads[1].nodeRadii).toEqual([3]); // kept within 0 .. 3 m
    expect(setNodeRadius(d, id, 0, 0).roads[1].nodeRadii).toEqual([0]);
    // the lane follows the bend; the route still joins its two stations
    const lane = d.lanes.find((l) => l.id === road(d, 1).laneIds[0])!;
    expect(lane.geom.some(([, y]) => y < -2)).toBe(true);
    d = deleteRouteNode(d, id, 0);
    expect(routeNodes(road(d, 1)).length).toBe(0);
    expect(planTrip(d, '', d.stations[1].id, d.stations[2].id).ok).toBe(true);
  });
  it('a new node goes between the right two points', () => {
    const d = build();
    const id = road(d, 0).id; // S1 -> (0, 6) -> S2
    const a = addRouteNode(d, id, [5, 6]); // on the second piece
    expect(a.index).toBe(1);
    expect(routeNodes(road(a.data, 0))).toEqual([
      [0, 6],
      [5, 6],
    ]);
    expect(addRouteNode(d, id, [0, 3]).index).toBe(0); // on the first piece
  });
  it('the start and end station can be changed and swapped; the nodes stay', () => {
    let d = build();
    const [s1, s2, s3] = d.stations;
    const r0 = road(d, 0);
    d = setRouteEnds(d, r0.id, s3.id, s2.id);
    const e = routeEnds(d, road(d, 0));
    expect([e.from?.id, e.to?.id]).toEqual([s3.id, s2.id]);
    expect(routeNodes(road(d, 0))).toEqual(routeNodes(r0));
    expect(s1).toBeTruthy();
  });
  it('"Add reverse route" makes the route back through the same nodes, in its own right', () => {
    const d = build();
    const r = addReverseRoute(d, road(d, 0).id);
    const back = r.data.roads.find((q) => q.id === r.id)!;
    expect(routeEnds(r.data, back).from?.id).toBe(d.stations[1].id);
    expect(routeNodes(back)).toEqual(routeNodes(road(d, 0)).reverse());
    expect(back.oneWay).toBe(true);
    expect(planTrip(r.data, '', d.stations[1].id, d.stations[0].id).ok).toBe(true);
  });
});

describe('a point-to-point map has nothing off its routes', () => {
  it('no access roads are made for a station: it must be on a route, in and out, to publish', () => {
    const d = build();
    expect(routable(d)).toBe(d);
    expect(publishProblems(d, null, noUse).filter((p) => p.level === 'block' && p.stationId)).toHaveLength(2); // S1 has nothing arriving, S3 nothing leaving
    const full = addRoute(
      addRoute(d, d.stations[2].id, d.stations[0].id, '').data,
      d.stations[0].id,
      d.stations[2].id,
      '',
    ).data;
    expect(publishProblems(full, null, noUse).filter((p) => p.level === 'block')).toEqual([]);
  });
});

describe('moving a station of a point-to-point map', () => {
  it('the routes at it follow (ends and lanes), the bend nodes stay', async () => {
    const { moveStation } = await import('@/features/map-editor/model/stations');
    const d = build();
    const s2 = d.stations[1]; // end of route 1 (through a node at (0, 6)), start of route 2
    const moved = moveStation(d, s2.id, { x: 14, y: 8 });
    const r1 = moved.roads[0],
      r2 = moved.roads[1];
    expect(r1.points[r1.points.length - 1]).toEqual([14, 8]);
    expect(r2.points[0]).toEqual([14, 8]);
    expect(routeNodes(r1)).toEqual(routeNodes(d.roads[0])); // bend nodes did not move
    const lane = moved.lanes.find((l) => l.id === r1.laneIds[0])!;
    expect(lane.geom[lane.geom.length - 1]).toEqual([14, 8]);
    expect(planTrip(moved, '', moved.stations[0].id, moved.stations[2].id).ok).toBe(true);
  });
});
