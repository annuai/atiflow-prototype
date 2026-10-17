import { describe, expect, it } from 'vitest';
import { FleetSim } from '../src/adapters/sim';
import { comesFromGateSide } from '../src/core/gate';
import { pointInPoly } from '../src/core/geom';
import { fitRect, rectCorners } from '../src/core/rect';
import { RulesIndex } from '../src/core/rules';
import type { RobotTelemetry, SiteLayout } from '../src/core/types';
import {
  fitRect as fitShape,
  flipGate,
  gateFromThin,
  gateRect,
  newGate,
  polygonOf,
  resizeRect,
  rotateRectTo,
  toWorld,
} from '../src/features/map-editor/model/shape';
import { normaliseData } from '../src/features/map-editor/model/seed';
import { setZoneShape } from '../src/features/map-editor/model/zones';
import type { MapZone } from '../src/features/map-editor/model/types';
import { aisleMap, gridMap } from './helpers/maps';
import { run } from './helpers/run';

type P = [number, number];
const hullPoly: P[] = [
  [0, 0],
  [6, 1],
  [8, 4],
  [3, 6],
  [-1, 3],
];
const zone = (over: Partial<MapZone> = {}): Omit<MapZone, 'shape'> => ({
  id: 'Z1',
  type: 'exclusive',
  name: 'Z',
  polygon: hullPoly,
  props: {},
  ...over,
});

describe('rectangles', () => {
  it('the fitted rectangle covers the whole shape and is no bigger than the bounding box', () => {
    const r = fitRect(hullPoly);
    for (const [x, y] of hullPoly) {
      const lx = (x - r.cx) * Math.cos(-r.rot) - (y - r.cy) * Math.sin(-r.rot),
        ly = (x - r.cx) * Math.sin(-r.rot) + (y - r.cy) * Math.cos(-r.rot);
      expect(Math.abs(lx)).toBeLessThanOrEqual(r.w / 2 + 0.01);
      expect(Math.abs(ly)).toBeLessThanOrEqual(r.h / 2 + 0.01);
    }
    expect(rectCorners(r)).toHaveLength(4);
    const bb = (8 - -1) * (6 - 0);
    expect(r.w * r.h).toBeLessThanOrEqual(bb + 0.1);
  });
  it('a rotated rectangle is found at its own angle', () => {
    const r0 = { kind: 'rect' as const, cx: 10, cy: 5, w: 6, h: 2, rot: 0.6 };
    const fit = fitShape(polygonOf(r0));
    expect(Math.max(fit.w, fit.h)).toBeCloseTo(6, 1);
    expect(Math.min(fit.w, fit.h)).toBeCloseTo(2, 1);
  });
  it('resizing a corner keeps the opposite corner where it was', () => {
    const r = { kind: 'rect' as const, cx: 5, cy: 5, w: 4, h: 2, rot: 0.5 };
    const fixed = toWorld(r, -2, -1);
    const to = toWorld(r, 5, 3);
    const n = resizeRect(r, [1, 1], to);
    const fixedAfter = toWorld(n, -n.w / 2, -n.h / 2);
    expect(fixedAfter[0]).toBeCloseTo(fixed[0], 1);
    expect(fixedAfter[1]).toBeCloseTo(fixed[1], 1);
    expect(n.w).toBeCloseTo(7, 1);
    expect(n.h).toBeCloseTo(4, 1);
  });
  it('an edge handle changes one side only, and a size never goes below the minimum', () => {
    const r = { kind: 'rect' as const, cx: 0, cy: 0, w: 4, h: 2, rot: 0 };
    const n = resizeRect(r, [1, 0], [10, 3]);
    expect(n.h).toBe(2);
    expect(n.w).toBeCloseTo(12, 1);
    expect(resizeRect(r, [1, 0], [-30, 0]).w).toBeGreaterThan(0);
  });
  it('the rotate handle turns the zone about its centre (0 = the top edge faces +y)', () => {
    const r = { kind: 'rect' as const, cx: 2, cy: 2, w: 4, h: 2, rot: 0.3 };
    expect(rotateRectTo(r, [2, 9]).rot).toBeCloseTo(0, 5);
    expect(rotateRectTo(r, [2 + 5, 2], false).rot).toBeCloseTo(-Math.PI / 2, 5);
    expect(rotateRectTo(r, [2 + 5, 2 + 4.9], true).rot % (Math.PI / 12)).toBeCloseTo(0, 5);
  });
  it('setZoneShape moves, resizes and rotates a zone and its outline follows', () => {
    const d = normaliseData({ nodes: [], lanes: [], stations: [], zones: [zone()] });
    const z = d.zones[0];
    expect(z.shape.kind).toBe('rect');
    const moved = setZoneShape(d, z.id, { ...(z.shape as Extract<typeof z.shape, { kind: 'rect' }>), cx: 100 })
      .zones[0];
    expect(moved.polygon[0][0]).toBeGreaterThan(90);
  });
});

describe('saved zones are converted', () => {
  it('every old polygon becomes a rectangle around it; a thin old line gate becomes a directional gate 3 m deep', () => {
    const thin: P[] = [
      [0, 0.8],
      [4, 0.8],
      [4, -0.8],
      [0, -0.8],
    ];
    const d = normaliseData({
      nodes: [],
      lanes: [],
      stations: [],
      zones: [zone(), zone({ id: 'G', polygon: thin, props: { shape: 'line', capacity: 1 } })],
    });
    expect(d.zones[0].shape.kind).toBe('rect');
    expect(d.zones[1].shape).toMatchObject({ kind: 'gate', depth: 3, side: 1 });
    expect(d.zones[1].props.shape).toBeUndefined();
    expect(d.zones[1].props.capacity).toBe(1);
    expect(normaliseData({ nodes: [], lanes: [], stations: [], zones: d.zones }).zones).toEqual(d.zones); // converting twice changes nothing
  });
});

describe('Line gates', () => {
  it('the area reaches `depth` metres to the side the arrow points, flipping it moves the area to the other side', () => {
    const g = newGate([0, 0], [4, 0]); // left of a -> b is +y
    expect(g.side).toBe(1);
    const ys = polygonOf(g).map((p) => p[1]);
    expect(Math.min(...ys)).toBeCloseTo(0, 1);
    expect(Math.max(...ys)).toBeCloseTo(3, 1);
    const f = flipGate(g);
    const fy = polygonOf(f).map((p) => p[1]);
    expect(Math.max(...fy)).toBeCloseTo(0, 1);
    expect(Math.min(...fy)).toBeCloseTo(-3, 1);
    expect(gateRect({ ...g, depth: 5 }).h).toBe(5);
    expect(
      gateFromThin([
        [0, 1],
        [4, 1],
        [4, -1],
        [0, -1],
      ]).depth,
    ).toBe(3);
  });
  it('a robot is "from the controlled side" when it heads towards the line', () => {
    const g = { a: [0, 0] as P, b: [4, 0] as P, depth: 3, side: 1 as const };
    expect(comesFromGateSide(g, -Math.PI / 2)).toBe(true); // heading south, from the +y side
    expect(comesFromGateSide(g, Math.PI / 2)).toBe(false);
  });
});

const robot = (id: string, x: number, y: number, theta: number): RobotTelemetry =>
  ({
    id,
    model: 'm',
    fleetId: 'f1',
    siteId: 's',
    pose: { x, y, theta },
    speed: 1,
    state: 'moving',
    battery: 90,
    ts: 0,
  }) as RobotTelemetry;
describe('the checker at a Line gate', () => {
  const nav = aisleMap();
  const polygon = polygonOf(newGate([10, -3], [10, 3])); // area to +x... see below
  const gated = {
    ...nav,
    trafficZones: [
      {
        id: 'G1',
        name: 'Gate',
        capacity: 1,
        fleets: ['f1', 'f2'],
        polygon,
        gate: { a: [10, -3] as P, b: [10, 3] as P, depth: 3, side: -1 as const },
      },
    ],
  };
  const rules = new RulesIndex(gated, {
    bounds: { minX: -50, minY: -50, maxX: 50, maxY: 50 },
    floorPolygons: [],
    walls: [],
    pillars: [],
    zones: [],
    equipment: [],
    doors: [],
    labels: [],
  } as unknown as SiteLayout);
  it('counts only robots coming from the gate side: two of them are too many, one of them and a free one is fine', () => {
    const inside = polygon.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
    const cx = inside[0],
      cy = inside[1];
    const g = gated.trafficZones[0].gate;
    const towards = Math.atan2(g.a[1] - g.b[1], 0) === 0 ? Math.PI : Math.PI; // heading west: from the +x... (side -1 on a vertical line points to +x)
    const from = (id: string, dy: number) => robot(id, cx, cy + dy, towards);
    const free = (id: string, dy: number) => robot(id, cx, cy + dy, 0);
    expect(rules.traffic([from('A', 0), from('B', 1)]).G1.over).toBe(true);
    expect(rules.traffic([from('A', 0), free('B', 1)]).G1.over).toBe(false);
    expect(rules.traffic([free('A', 0), free('B', 1)]).G1.over).toBe(false);
  });
});

describe('the simulator at a Line gate', () => {
  it('robots coming from the gate side go through one at a time, the others are never held by it, and nothing breaks', () => {
    const map = gridMap({ cols: 2, rows: 2 });
    const g = { a: [7, -2] as P, b: [7, 2] as P, depth: 3, side: -1 as const }; // across the road between the two west junctions: side -1 of a -> b (north) is +x, so robots driving west come from it
    const polygon = polygonOf({ kind: 'gate', ...g });
    const zoned = {
      ...map,
      trafficZones: [
        ...map.trafficZones,
        { id: 'G1', name: 'Gate', capacity: 1, fleets: ['f1', 'f2'], polygon, gate: g },
      ],
    };
    const sim = new FleetSim(zoned, 'test', 4, 5);
    let controlledTogether = 0,
      free = 0,
      held = 0;
    for (let t = 0; t < 400; t += 0.1) {
      sim.step(0.1);
      sim.drainEvents();
      if (sim.bots.some((b) => b.waitingZone === 'G1')) held++;
      const inside = sim.bots.filter((b) => pointInPoly(b.pos.x, b.pos.y, polygon) && b.v > 0.05);
      if (inside.filter((b) => comesFromGateSide(g, b.theta)).length > 1) controlledTogether++;
      if (inside.some((b) => !comesFromGateSide(g, b.theta))) free++;
    }
    const r = run(zoned, 4, 600);
    expect(r.touches.slice(0, 3)).toEqual([]);
    for (const [id, n] of r.trips) expect(n, id).toBeGreaterThanOrEqual(3);
    expect(held).toBeGreaterThan(0); // the gate did hold robots that came from its side
    expect(free).toBeGreaterThan(0); // robots going the free way did cross the area
    expect(controlledTogether).toBe(0);
  });
});
