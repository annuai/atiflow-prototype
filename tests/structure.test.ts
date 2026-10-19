import { describe, expect, it } from 'vitest';
import type { MapData } from '@/features/map-editor';
import { structureSite } from '@/features/map-editor/model/structure/derive';
import { structureHits } from '@/features/map-editor/model/structure/collide';
import { withoutSections } from '@/features/map-editor/model/structure/legacy';
import { structureDxf } from '@/features/map-editor/model/structure/dxf';
import { publishProblems } from '@/features/map-editor/model/validate';
import {
  addArea,
  addBox,
  addDoor,
  addLine,
  addRoom,
  addWorkArea,
  deleteElements,
  duplicateElement,
  modelOf,
  moveElement,
  setPoint,
  updateElement,
  updateElements,
} from '@/features/map-editor/model/structure/ops';
import { boxAround, carry } from '@/features/map-editor/model/structure/transform';
import { boxElements, elementsInRect, pickElement } from '@/features/map-editor/model/structure/select';
import {
  eraseRect,
  nearestEstimateWall,
  restoreEstimate,
  traceAll,
  traceWalls,
} from '@/features/map-editor/model/structure/trace';

const blank = (): MapData => ({
  nodes: [],
  lanes: [],
  roads: [],
  stations: [],
  stagingAreas: [],
  zones: [],
  structure: {
    walls: [
      { a: [0, 0], b: [10, 0], t: 0.2, h: 3, layer: 'wall' },
      { a: [0, 5], b: [10, 5], t: 0.2, h: 3, layer: 'wall' },
    ],
    equipment: [{ kind: 'equipment', x: 5, y: 2, w: 2, d: 1, h: 1.5, layer: 'e' }],
  },
});
const first = (d: MapData) => modelOf(d).elements[0];

describe('structure elements', () => {
  it('a wall is high, a partition lower, a machine about as high as a partition', () => {
    let d = blank();
    d = addLine(d, 'wall', [
      [0, 0],
      [4, 0],
    ]).data;
    d = addLine(d, 'partition', [
      [0, 1],
      [4, 1],
    ]).data;
    d = addBox(d, 'machine', [1, 2], [3, 3]).data;
    const [w, p, m] = modelOf(d).elements;
    expect([w.height, p.height, m.height]).toEqual([4, 1.6, 1.8]);
    expect(w.height).toBeGreaterThan(p.height);
    expect(Math.abs(m.height - p.height)).toBeLessThan(0.5);
  });
  it('refuses empty shapes and gives ids one after the other', () => {
    const d = blank();
    expect(addLine(d, 'wall', [[0, 0]]).id).toBeNull();
    expect(
      addLine(d, 'wall', [
        [0, 0],
        [0.01, 0],
      ]).id,
    ).toBeNull();
    expect(addBox(d, 'machine', [0, 0], [0.05, 3]).id).toBeNull();
    const a = addLine(d, 'wall', [
      [0, 0],
      [4, 0],
    ]);
    const b = addLine(a.data, 'wall', [
      [0, 1],
      [4, 1],
    ]);
    expect([a.id, b.id]).toEqual(['E1', 'E2']);
  });
  it('a room is four walls in one closed line', () => {
    const r = addRoom(blank(), [0, 0], [6, 4]);
    expect(first(r.data)).toMatchObject({ kind: 'wall' });
    expect((first(r.data) as { points: unknown[] }).points).toHaveLength(5);
    expect(structureSite({ ...r.data, structure: undefined }).walls).toHaveLength(4);
  });
  it('moving, editing a point, duplicating and deleting', () => {
    let d = addLine(blank(), 'wall', [
      [0, 0],
      [4, 0],
    ]).data;
    d = moveElement(d, 'E1', 1, 2);
    expect((first(d) as { points: number[][] }).points).toEqual([
      [1, 2],
      [5, 2],
    ]);
    d = setPoint(d, 'E1', 1, [9, 9]);
    expect((first(d) as { points: number[][] }).points[1]).toEqual([9, 9]);
    const dup = duplicateElement(d, 'E1');
    expect(modelOf(dup.data).elements).toHaveLength(2);
    expect(deleteElements(dup.data, ['E1', dup.id!]).model3d?.elements).toEqual([]);
  });
});

describe('colours and labels', () => {
  it("an element's own colour wins over its kind's", () => {
    let d = blank();
    d = addBox(d, 'machine', [0, 0], [2, 2]).data;
    d = addBox(d, 'machine', [3, 0], [5, 2]).data;
    d = updateElement(d, 'E2', { color: '#fda4af' });
    const eq = structureSite({ ...d, structure: undefined }).equipment;
    expect(eq.map((q) => q.color)).toEqual(['#9aa9a5', '#fda4af']);
  });
  it('a machine label is carried to the scene', () => {
    const d = addBox(blank(), 'machine', [0, 0], [2, 2], { label: 'Press 1' }).data;
    expect(structureSite({ ...d, structure: undefined }).equipment[0].label).toBe('Press 1');
  });
  it('a map saved with sections keeps the colours people saw and loses the sections', () => {
    const old = {
      elements: [
        { id: 'E1', kind: 'machine', x: 0, y: 0, w: 1, d: 1, rot: 0, height: 1, section: 's1' },
        { id: 'E2', kind: 'machine', x: 3, y: 0, w: 1, d: 1, rot: 0, height: 1, section: 's1', color: '#fda4af' },
      ],
      sections: [{ id: 's1', name: 'ASRS', color: '#93c5fd', label: true }],
      hiddenWalls: [],
      hiddenEquipment: [],
    } as never;
    const m = withoutSections(old)!;
    expect(m.elements.map((e) => e.color)).toEqual(['#93c5fd', '#fda4af']);
    expect(JSON.stringify(m)).not.toContain('section');
  });
});

describe('doors', () => {
  it('cut the wall they are on and leave the wall above the opening', () => {
    let d = addLine(blank(), 'wall', [
      [0, 0],
      [10, 0],
    ]).data;
    const door = addDoor(d, [5, 0.3]);
    expect(door.id).toBe('E2');
    d = door.data;
    const w = structureSite({ ...d, structure: undefined }).walls;
    const low = w.filter((x) => !x.base),
      lintel = w.filter((x) => x.base);
    expect(low.map((x) => [x.a[0], x.b[0]])).toEqual([
      [0, 4.3],
      [5.7, 10],
    ]);
    expect(lintel).toHaveLength(1);
    expect(lintel[0].base).toBeCloseTo(2.2);
    expect(lintel[0].h).toBeCloseTo(4 - 2.2);
  });
  it('need a wall: nothing is added in the open', () => {
    expect(addDoor(blank(), [5, 0.3]).id).toBeNull();
  });
});

describe('the lidar estimate', () => {
  it("a wall is traced into an element and the estimate's is hidden (not drawn twice)", () => {
    const d = blank();
    expect(nearestEstimateWall(d, [5, 0.4])).toBe(0);
    const t = traceWalls(d, [0]);
    expect(modelOf(t.data).hiddenWalls).toEqual([0]);
    expect(nearestEstimateWall(t.data, [5, 0.4])).toBe(-1);
    expect(structureSite(t.data).walls).toHaveLength(2); // the other estimate wall + the traced one
    expect(traceWalls(t.data, [0]).ids).toEqual([]); // not twice
    expect(d.structure?.walls).toHaveLength(2); // the estimate itself is untouched
  });
  it('trace everything, erase a rectangle, and bring the estimate back', () => {
    let d = traceAll(blank());
    expect(modelOf(d).elements).toHaveLength(3); // two walls and a machine
    d = eraseRect(d, [-1, -1], [11, 1]); // takes the first wall and the machine (centre 5,2? no: outside), only what is inside
    expect(
      modelOf(d)
        .elements.map((e) => e.kind)
        .sort(),
    ).toEqual(['machine', 'wall']);
    const e2 = eraseRect(blank(), [-1, -1], [11, 1]);
    expect(modelOf(e2).hiddenWalls).toEqual([0]);
    expect(structureSite(e2).walls).toHaveLength(1);
    expect(structureSite(restoreEstimate(e2)).walls).toHaveLength(2);
  });
});

describe('routes against solids', () => {
  const lane = (id: string, geom: [number, number][]) => ({
    id,
    from: 'a',
    to: 'b',
    geom,
    fleets: [''],
    speed: 1,
    len: 1,
  });
  it('a route through a wall or a machine is a hit, an opening or an overhead item is not', () => {
    let d: MapData = { ...blank(), structure: undefined };
    d = addLine(d, 'wall', [
      [5, -3],
      [5, 3],
    ]).data; // E1
    d = addBox(d, 'machine', [8, -1], [10, 1]).data; // E2
    d = addBox(d, 'machine', [12, -1], [14, 1], { base: 2.5 }).data; // E3: overhead
    d = {
      ...d,
      lanes: [
        lane('L1', [
          [0, 0],
          [20, 0],
        ]),
      ],
      roads: [
        {
          id: 'R1',
          name: 'r',
          oneWay: true,
          points: [
            [0, 0],
            [20, 0],
          ],
          laneIds: ['L1'],
        },
      ],
    };
    expect(
      structureHits(d)
        .map((h) => h.elementId)
        .sort(),
    ).toEqual(['E1', 'E2']);
    d = addDoor(d, [5, 0]).data; // a door where the route crosses
    expect(structureHits(d).map((h) => h.elementId)).toEqual(['E2']);
  });
  it('traced elements say so (a rough estimate is only a warning)', () => {
    let d = traceWalls(blank(), [0]).data;
    d = {
      ...d,
      lanes: [
        lane('L1', [
          [5, -2],
          [5, 2],
        ]),
      ],
      roads: [],
    };
    const hits = structureHits(d);
    expect(hits).toHaveLength(1);
    expect(hits[0].traced).toBe(true);
  });
  it('areas and floor patches', () => {
    const a = addArea(
      blank(),
      [
        [0, 0],
        [2, 0],
        [2, 2],
      ],
      0,
    );
    expect(modelOf(a.data).elements[0]).toMatchObject({ kind: 'area', height: 0 });
    expect(
      addArea(blank(), [
        [0, 0],
        [2, 0],
      ]).id,
    ).toBeNull();
    expect(structureSite({ ...a.data, structure: undefined }).shapes).toHaveLength(1);
  });
});

describe('publish gate and drawing', () => {
  it('blocks a route through a wall; the DXF has the layers and ends properly', () => {
    let d: MapData = { ...blank(), structure: undefined };
    d = addLine(d, 'wall', [
      [5, -3],
      [5, 3],
    ]).data;
    d = addBox(d, 'machine', [8, -1], [10, 1], { label: 'Press' }).data;
    d = {
      ...d,
      lanes: [
        {
          id: 'L1',
          from: 'a',
          to: 'b',
          geom: [
            [0, 0],
            [20, 0],
          ],
          fleets: [''],
          speed: 1,
          len: 20,
        },
      ],
      roads: [
        {
          id: 'R1',
          name: 'Road 1',
          oneWay: true,
          points: [
            [0, 0],
            [20, 0],
          ],
          laneIds: ['L1'],
        },
      ],
    };
    const p = publishProblems(d, null, () => []);
    expect(p.some((x) => x.level === 'block' && x.title.includes('Road 1'))).toBe(true);
    const dxf = structureDxf(d);
    expect(dxf).toContain('WALL');
    expect(dxf).toContain('Press');
    expect(dxf.trim().endsWith('EOF')).toBe(true);
  });
});

describe('selecting several elements', () => {
  it('a box takes what it touches (a Work area only when it holds all of it); clicks toggle', () => {
    let d: MapData = { ...blank(), structure: undefined };
    d = addLine(d, 'wall', [
      [0, 0],
      [10, 0],
    ]).data; // E1
    d = addLine(d, 'wall', [
      [0, 5],
      [10, 5],
    ]).data; // E2
    d = addBox(d, 'machine', [20, 20], [22, 22]).data; // E3 far away
    d = addWorkArea(d, [
      [-5, -5],
      [15, -5],
      [15, 8],
      [-5, 8],
    ]).data; // E4 holds E1 and E2
    expect(elementsInRect(d, [4, -1], [6, 6])).toEqual(['E1', 'E2']); // crosses both walls, not the area
    expect(elementsInRect(d, [-6, -6], [16, 9])).toEqual(['E1', 'E2', 'E4']);
    const one = pickElement(null, 'E1', false);
    const two = pickElement(one, 'E2', true);
    expect(two).toMatchObject({ id: 'E2', ids: ['E1', 'E2'] });
    expect(pickElement(two, 'E1', true)).toMatchObject({ id: 'E2', ids: ['E2'] });
    expect(pickElement(pickElement(null, 'E1', false), 'E1', true)).toBeNull();
    expect(boxElements(d, two, [19, 19], [23, 23], true)).toMatchObject({ ids: ['E1', 'E2', 'E3'] });
  });
  it('several are changed or deleted together', () => {
    let d: MapData = { ...blank(), structure: undefined };
    d = addLine(d, 'wall', [
      [0, 0],
      [10, 0],
    ]).data;
    d = addLine(d, 'wall', [
      [0, 5],
      [10, 5],
    ]).data;
    d = updateElements(d, ['E1', 'E2'], { color: '#93c5fd' });
    expect(modelOf(d).elements.every((e) => e.color === '#93c5fd')).toBe(true);
    expect(modelOf(deleteElements(d, ['E1', 'E2'])).elements).toHaveLength(0);
  });
});

describe('resizing and turning a wall as a whole', () => {
  it('carries points into a bigger or turned box', () => {
    const pts: [number, number][] = [
      [0, 0],
      [10, 0],
    ];
    const from = boxAround(pts);
    expect(from).toMatchObject({ cx: 5, cy: 0, w: 10 });
    // twice as long, same place
    expect(carry(pts, from, { ...from, w: 20, rot: 0 })).toEqual([
      [-5, 0],
      [15, 0],
    ]);
    // a quarter turn about its middle
    const [a, b] = carry(pts, from, { ...from, rot: Math.PI / 2 });
    expect(a[0]).toBeCloseTo(5);
    expect(a[1]).toBeCloseTo(-5);
    expect(b[1]).toBeCloseTo(5);
  });
});
