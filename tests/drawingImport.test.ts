import { readFileSync } from 'node:fs';
import { zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseAi } from '@/features/map-editor/drawing/core/ai';
import { buildDrawing } from '@/features/map-editor/drawing/core/build';
import { parseDxf } from '@/features/map-editor/drawing/core/dxf';
import { summarise } from '@/features/map-editor/drawing/core/stats';
import { aboutCentre, invert, svgMatrix, twoPoints } from '@/features/map-editor/drawing/core/align';
import { alignToMap } from '@/features/map-editor/drawing/core/autoAlign';
import { placeBuilt } from '@/features/map-editor/drawing/core/place';
import { applyPoint } from '@/features/map-import';
import { guessBlock, guessLayer, kindFromName } from '@/features/map-editor/drawing/core/classify';

/** A DXF written by hand: each entity is a list of [group code, value]. */
type Ent = (string | number)[][];
const dxf = (blocks: Ent[][], entities: Ent[], units = 4) => {
  const flat = (e: Ent) => e.map(([c, v]) => `${c}\n${v}`).join('\n');
  return [
    '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n' + units + '\n0\nENDSEC',
    '0\nSECTION\n2\nBLOCKS' + blocks.map((b) => '\n' + b.map(flat).join('\n')).join('') + '\n0\nENDSEC',
    '0\nSECTION\n2\nENTITIES' + entities.map((e) => '\n' + flat(e)).join('') + '\n0\nENDSEC\n0\nEOF',
  ].join('\n');
};
const line = (layer: string, x1: number, y1: number, x2: number, y2: number) => [
  [0, 'LINE'],
  [8, layer],
  [10, x1],
  [20, y1],
  [11, x2],
  [21, y2],
];
const rect = (layer: string, x: number, y: number, w: number, h: number) => [
  [0, 'LWPOLYLINE'],
  [8, layer],
  [70, 1],
  [10, x],
  [20, y],
  [10, x + w],
  [20, y],
  [10, x + w],
  [20, y + h],
  [10, x],
  [20, y + h],
];
const block = (name: string, shapes: Ent[]): Ent[] => [
  [
    [0, 'BLOCK'],
    [2, name],
    [10, 0],
    [20, 0],
  ],
  ...shapes,
  [[0, 'ENDBLK']],
];
const insert = (name: string, layer: string, x: number, y: number, rot = 0) => [
  [0, 'INSERT'],
  [8, layer],
  [2, name],
  [10, x],
  [20, y],
  [50, rot],
];
const text = (layer: string, t: string, x: number, y: number) => [
  [0, 'TEXT'],
  [8, layer],
  [1, t],
  [10, x],
  [20, y],
  [40, 250],
];

describe('names', () => {
  it('reads layer and block names the way a CAD office writes them', () => {
    expect(kindFromName('A-WALL')?.kind).toBe('wall');
    expect(kindFromName('50 MM EXTERNAL PILLAR')?.kind).toBe('pillar');
    expect(kindFromName('FAB WALL PANEL-1')?.kind).toBe('wall');
    expect(kindFromName('GLASS PARTITION')?.kind).toBe('partition');
    expect(kindFromName('Door_Swing')?.kind).toBe('door');
    expect(kindFromName('700 mm conveyor')?.kind).toBe('machine');
    expect(kindFromName('DIMENSIONS')?.kind).toBe('ignore');
    expect(kindFromName('WALL TEXT')?.kind).toBe('ignore'); // a note about a wall is not a wall
    expect(kindFromName('Color_12')).toBeNull(); // "col" must not start a word here
    expect(guessLayer('LAYER01').kind).toBe('ignore');
    expect(guessLayer('Mystery').why).toBe('unknown');
  });
  it('sorts blocks with no useful name by size', () => {
    expect(guessBlock('A$C1234', 0.4, 0.4, 8).kind).toBe('pillar');
    expect(guessBlock('A$C1235', 3, 1.2, 30).kind).toBe('machine');
    expect(guessBlock('A$C1236', 0.05, 0.05, 3).kind).toBe('ignore');
    expect(guessBlock('A$C1237', 90, 60, 100).kind).toBe('explode');
    expect(guessBlock('COLUMN_400', 3, 1, 4).kind).toBe('pillar'); // the name wins over the size
  });
});

describe('reading a DXF', () => {
  it('reads lines, polylines with arcs, circles, blocks, inserts and text', () => {
    const t = dxf(
      [block('B1', [rect('0', 0, 0, 1000, 500)])],
      [
        line('WALL', 0, 0, 10000, 0),
        rect('EQUIP', 1000, 1000, 2000, 1000),
        [
          [0, 'CIRCLE'],
          [8, 'COLUMN'],
          [10, 5000],
          [20, 5000],
          [40, 200],
        ],
        [
          [0, 'LWPOLYLINE'],
          [8, 'X'],
          [70, 0],
          [10, 0],
          [20, 0],
          [42, 1],
          [10, 2],
          [20, 0],
        ], // a half circle
        insert('B1', 'EQUIP', 7000, 3000, 90),
        text('NOTES', 'Hello', 0, 0),
        [
          [0, 'HATCH'],
          [8, 'H'],
        ],
      ],
    );
    const d = parseDxf(t, 'x.dxf');
    expect(d.unitCode).toBe(4);
    expect(d.shapes.length).toBe(4);
    expect(d.inserts).toHaveLength(1);
    expect(d.blocks.get('B1')?.shapes).toHaveLength(1);
    expect(d.texts[0].text).toBe('Hello');
    expect(d.skipped.HATCH).toBe(1);
    const half = d.shapes.find((s) => s.layer === 'X')!;
    // a bulge of 1 is a half circle of radius 1 about (1, 0): the middle of the curve is at (1, -1) or (1, 1), never on the chord
    const mid = half.pts[Math.floor(half.pts.length / 2)];
    expect(Math.abs(Math.hypot(mid[0] - 1, mid[1]))).toBeCloseTo(1, 1);
    expect(Math.abs(mid[1])).toBeGreaterThan(0.9);
  });
  it('refuses a binary DXF and an empty drawing with a reason', () => {
    expect(() => parseDxf('AutoCAD Binary DXF\r\n\u001a\u0000', 'b.dxf')).toThrow(/binary/i);
    expect(() => parseDxf(dxf([], []), 'e.dxf')).toThrow(/no lines/i);
  });
});

describe('what the rules make of a drawing', () => {
  // a 10 m x 6 m room in millimetres: double-line walls 200 mm thick, a column, a machine block, a door block in the south wall, an area with a name
  const room = () =>
    parseDxf(
      dxf(
        [
          block('COLUMN_400', [rect('0', -200, -200, 400, 400)]),
          block('A$C99', [rect('0', 0, 0, 3000, 1200), rect('0', 100, 100, 2800, 1000)]), // a machine with an inner outline
          block('DOOR_900', [
            line('0', 0, 0, 900, 0),
            [
              [0, 'ARC'],
              [8, '0'],
              [10, 0],
              [20, 0],
              [40, 900],
              [50, 0],
              [51, 90],
            ],
          ]),
        ],
        [
          // south wall: two faces, with a gap for the door between x = 4000 and 4900
          line('WALL', 0, -100, 4000, -100),
          line('WALL', 0, 100, 4000, 100),
          line('WALL', 4900, -100, 10000, -100),
          line('WALL', 4900, 100, 10000, 100),
          // north, west, east: two faces each
          line('WALL', 0, 5900, 10000, 5900),
          line('WALL', 0, 6100, 10000, 6100),
          line('WALL', -100, 100, -100, 5900),
          line('WALL', 100, 100, 100, 5900),
          line('WALL', 9900, 100, 9900, 5900),
          line('WALL', 10100, 100, 10100, 5900),
          insert('COLUMN_400', 'COLS', 5000, 3000),
          insert('A$C99', 'MISC', 2000, 2000, 90),
          insert('DOOR_900', 'DOORS', 4000, 0),
          rect('ZONE', 500, 500, 9000, 5000),
          text('ZONE', 'Assembly', 2000, 4000),
          text('DIM', '3500', 2000, 4200),
        ],
      ),
      'room.dxf',
    );
  it('pairs the two faces of a wall into one wall as thick as the gap', () => {
    const s = summarise(room());
    const b = buildDrawing(room(), s.rules, 0.001);
    const south = b.lines.filter((l) => l.points.every((p) => Math.abs(p[1]) < 0.01));
    expect(south.length).toBeGreaterThanOrEqual(2); // either side of the door
    for (const l of south) expect(l.thickness).toBeCloseTo(0.2, 1);
    // four walls, the south one in two pieces
    expect(b.lines.length).toBeGreaterThanOrEqual(5);
    expect(b.lines.length).toBeLessThanOrEqual(8);
  });
  it('makes a pillar, one machine (not two) and a door from blocks, a named area from an outline', () => {
    const s = summarise(room());
    const b = buildDrawing(room(), s.rules, 0.001);
    expect(b.boxes.filter((x) => x.kind === 'pillar')).toHaveLength(1);
    const pillar = b.boxes.find((x) => x.kind === 'pillar')!;
    expect([pillar.x, pillar.y, pillar.w, pillar.d]).toEqual([5, 3, 0.4, 0.4]);
    const machines = b.boxes.filter((x) => x.kind === 'machine');
    expect(machines).toHaveLength(1);
    expect(machines[0].w).toBeCloseTo(3, 1);
    expect(machines[0].d).toBeCloseTo(1.2, 1);
    expect(b.doors).toHaveLength(1);
    expect(b.doors[0].y).toBeCloseTo(0, 1); // snapped onto the south wall
    expect(b.areas).toHaveLength(1);
    expect(b.areas[0].label).toBe('Assembly'); // not the dimension "3500"
  });
  it('follows the rules a person changes', () => {
    const d = room();
    const s = summarise(d);
    const rules = structuredClone(s.rules);
    rules.layers.WALL = { kind: 'ignore' };
    rules.blocks.COLUMN_400 = { kind: 'machine', height: 3 };
    const b = buildDrawing(d, rules, 0.001);
    expect(b.lines).toHaveLength(0);
    expect(b.boxes.find((x) => x.w === 0.4)?.kind).toBe('machine');
    expect(b.boxes.find((x) => x.w === 0.4)?.height).toBe(3);
  });
  it('treats millimetres and metres the same once the unit is right', () => {
    const d = room();
    const a = buildDrawing(d, summarise(d).rules, 0.001);
    expect(a.bounds!.maxX - a.bounds!.minX).toBeGreaterThan(9);
    expect(a.bounds!.maxX - a.bounds!.minX).toBeLessThan(11);
  });
});

describe('a drawing from the dwg tool (dummy_annuai)', () => {
  it('finds walls, columns and machines on the layers that say so and nothing on the title block', () => {
    const d = parseDxf(readFileSync('tests/fixtures/drawings/dummy.dxf', 'utf8'), 'dummy.dxf');
    const s = summarise(d);
    expect(s.rules.layers.WALL.kind).toBe('wall');
    expect(s.rules.layers.COLUMN.kind).toBe('pillar');
    expect(s.rules.layers.EQUIP.kind).toBe('machine');
    expect(s.rules.layers.DIM.kind).toBe('ignore');
    expect(s.rules.layers.TITLEBLOCK.kind).toBe('ignore');
    const b = buildDrawing(d, s.rules, s.guessedUnit);
    expect(b.lines.length).toBeGreaterThan(5);
    expect(b.boxes.filter((x) => x.kind === 'pillar').length).toBeGreaterThanOrEqual(10);
    expect(b.boxes.filter((x) => x.kind === 'machine').length).toBeGreaterThanOrEqual(2);
    const w = b.bounds!.maxX - b.bounds!.minX;
    expect(w).toBeGreaterThan(30);
    expect(w).toBeLessThan(60);
  });
});

describe('an Illustrator file', () => {
  /** A one-page PDF the way Illustrator writes it: the content is compressed, layers are optional-content groups named in the page's Properties. */
  const ai = (compress: boolean) => {
    const content = [
      '/OC /MC0 BDC',
      '1 0 0 1 100 200 cm', // everything below is moved by (100, 200)
      '0 0 m 400 0 l 400 10 l 0 10 l h f', // a thin wall: 400 x 10 points
      'EMC',
      '/OC /MC1 BDC',
      '50 50 30 30 re S', // a 30 x 30 point square on the second layer
      '0 0 m 10 0 20 10 30 10 c S', // a curve
      'EMC',
    ].join('\n');
    const data = compress ? zlibSync(new TextEncoder().encode(content)) : new TextEncoder().encode(content);
    const parts: (string | Uint8Array)[] = [
      '%PDF-1.6\n',
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Properties << /MC0 5 0 R /MC1 6 0 R >> >> >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n',
      `4 0 obj\n<< /Length ${data.length}${compress ? ' /Filter /FlateDecode' : ''} >>\nstream\n`,
      data,
      '\nendstream\nendobj\n',
      '5 0 obj\n<< /Type /OCG /Name (Walls) >>\nendobj\n',
      '6 0 obj\n<< /Type /OCG /Name (Equipment 1) >>\nendobj\n',
      '%%EOF\n',
    ];
    const bytes = parts.map((p) => (typeof p === 'string' ? new TextEncoder().encode(p) : p));
    const out = new Uint8Array(bytes.reduce((n, b) => n + b.length, 0));
    let at = 0;
    for (const b of bytes) {
      out.set(b, at);
      at += b.length;
    }
    return out;
  };
  for (const compress of [false, true]) {
    it(`reads paths with their layer names and transforms (${compress ? 'compressed' : 'plain'})`, () => {
      const d = parseAi(ai(compress), 'plan.ai');
      expect(d.format).toBe('ai');
      expect(d.shapes.map((s) => s.layer)).toEqual(['Walls', 'Equipment 1', 'Equipment 1']);
      const wall = d.shapes[0];
      expect(wall.closed).toBe(true);
      expect(wall.pts[0]).toEqual([100, 200]); // moved by the cm
      expect(wall.pts[2]).toEqual([500, 210]);
      expect(d.shapes[1].pts).toEqual([
        [150, 250],
        [180, 250],
        [180, 280],
        [150, 280],
      ]); // the transform of the first layer carries on: it was not inside q / Q
      expect(d.shapes[2].pts.length).toBeGreaterThan(5); // the curve is cut into short lines
      // a drawing in points: units are points, so a 400 pt wall is about 14 cm until the person scales it
      const s = summarise(d);
      expect(s.guessedUnit).toBeCloseTo(0.0254 / 72, 6);
      expect(s.rules.layers.Walls.kind).toBe('wall');
      expect(s.rules.layers['Equipment 1'].kind).toBe('machine');
    });
  }
  it('says what to do with a file that has no PDF content', () => {
    expect(() =>
      parseAi(new TextEncoder().encode('%!PS-Adobe-3.0 EPSF-3.0\n%%Creator: Illustrator'), 'old.ai'),
    ).toThrow(/PDF Compatible/);
  });
});

describe('placing a drawing on the map', () => {
  const t0 = { scale: 1.2, rot: 0.6, dx: 12, dy: -5 };
  it('turns and scales about the drawing centre without moving it', () => {
    const c: [number, number] = [40, 25];
    const before = applyPoint(t0, c);
    const t1 = aboutCentre(t0, c, { rot: 1.4, scale: 0.8 });
    const after = applyPoint(t1, c);
    expect(after[0]).toBeCloseTo(before[0], 9);
    expect(after[1]).toBeCloseTo(before[1], 9);
    expect(t1.rot).toBe(1.4);
  });
  it('inverts a placement', () => {
    const p: [number, number] = [7, 3];
    const back = invert(t0, applyPoint(t0, p));
    expect(back[0]).toBeCloseTo(7, 9);
    expect(back[1]).toBeCloseTo(3, 9);
  });
  it('solves two picked points, keeping the scale unless asked', () => {
    const truth = { scale: 1, rot: Math.PI / 2, dx: 100, dy: 50 };
    const from: [number, number][] = [
      [0, 0],
      [10, 0],
    ];
    const pairs = from.map((f) => ({ from: f, to: applyPoint(truth, f) }));
    const t = twoPoints(pairs, 1)!;
    expect(t.rot).toBeCloseTo(Math.PI / 2, 9);
    expect(applyPoint(t, [10, 0])[0]).toBeCloseTo(100, 6);
    // a slightly imprecise second click: with the scale kept, the first point is still met
    const rough = twoPoints([pairs[0], { from: pairs[1].from, to: [pairs[1].to[0], pairs[1].to[1] + 0.5] }], 1)!;
    expect(rough.scale).toBe(1);
    const fit = twoPoints([pairs[0], { from: pairs[1].from, to: [pairs[1].to[0], pairs[1].to[1] + 1] }], 1, true)!;
    expect(fit.scale).toBeCloseTo(Math.hypot(10, 0) === 10 ? Math.hypot(0, 11) / 10 : 1, 6);
  });
  it('draws with the same matrix the SVG uses (y points down there)', () => {
    const m = svgMatrix(t0, 3, 80)
      .match(/matrix\((.*)\)/)![1]
      .split(' ')
      .map(Number);
    const p: [number, number] = [5, 9];
    const [x, y] = applyPoint(t0, p);
    expect(m[0] * p[0] + m[2] * p[1] + m[4]).toBeCloseTo(x - 3, 9);
    expect(m[1] * p[0] + m[3] * p[1] + m[5]).toBeCloseTo(80 - y, 9);
  });
  it('leaves out what lies outside the map and scales the rest', () => {
    const d = parseDxf(
      dxf([], [line('WALL', 0, 0, 10000, 0), line('WALL', 500000, 500000, 510000, 500000)], 4),
      'far.dxf',
    );
    const s = summarise(d);
    const built = buildDrawing(d, s.rules, 0.001);
    expect(built.lines).toHaveLength(2);
    const placed = placeBuilt(built, { scale: 2, rot: 0, dx: 0, dy: 0 }, { minX: -5, minY: -5, maxX: 100, maxY: 100 });
    expect(placed.lines).toHaveLength(1);
    expect(placed.lines[0].points[1][0]).toBeCloseTo(20, 6); // 10 m drawn at scale 2
    expect(placed.notes.outside).toBe(1);
  });
});

describe('finding where a drawing lies on a map', () => {
  const dummy = () => {
    const d = parseDxf(readFileSync('tests/fixtures/drawings/dummy.dxf', 'utf8'), 'dummy.dxf');
    const b = buildDrawing(d, summarise(d).rules, 0.001);
    return b.lines.flatMap((l) =>
      l.points.slice(1).map((p, i) => ({ a: l.points[i], b: p, t: l.thickness, h: 4, layer: 'x' })),
    );
  };
  it('finds a turn and a shift, even when the map holds only part of the drawing', () => {
    const drawing = dummy();
    const truth = { scale: 1, rot: 0.64, dx: 130.4, dy: -62.7 }; // 37 degrees, somewhere far away
    const moved = drawing.map((w) => ({ ...w, a: applyPoint(truth, w.a), b: applyPoint(truth, w.b) }));
    // the map has only the walls east of the western third (a smaller map than the drawing)
    const xs = moved.flatMap((w) => [w.a[0], w.b[0]]).sort((a, b) => a - b);
    const cut = xs[Math.floor(xs.length * 0.3)];
    const map = moved.filter((w) => w.a[0] > cut && w.b[0] > cut);
    expect(map.length).toBeGreaterThan(4);
    expect(map.length).toBeLessThan(moved.length);
    const r = alignToMap(drawing, map);
    expect(r.score).toBeGreaterThan(0.6);
    const p = applyPoint(r.t, drawing[0].a),
      q = applyPoint(truth, drawing[0].a);
    expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeLessThan(0.4);
  });
  it('says nothing is found when there is nothing to align to', () => {
    expect(alignToMap(dummy(), []).score).toBe(0);
  });
});

describe('MTEXT', () => {
  it('drops formatting codes and keeps the words', () => {
    const mtext = (raw: string) => [
      [0, 'MTEXT'],
      [8, 'T'],
      [10, 0],
      [20, 0],
      [40, 100],
      [1, raw],
    ];
    const d = parseDxf(
      dxf(
        [],
        [
          line('W', 0, 0, 1000, 0),
          mtext('\\pxqc;SMT LINES'),
          mtext('{\\fArial|b0|i0;\\H2.5;Assembly\\PArea}'),
          mtext('A\\~B %%uunder'),
        ],
      ),
      't.dxf',
    );
    expect(d.texts.map((t) => t.text)).toEqual(['SMT LINES', 'Assembly Area', 'A B under']);
  });
});

describe('a PDF made by another program', () => {
  it('reads a file with object streams (as newer PDF writers pack them)', () => {
    const d = parseAi(new Uint8Array(readFileSync('tests/fixtures/drawings/plan.ai')), 'plan.ai');
    expect(d.shapes.length).toBe(3);
    expect(d.shapes.every((s) => s.closed && s.pts.length === 4)).toBe(true);
    const xs = d.shapes.flatMap((s) => s.pts.map((p) => p[0]));
    expect(Math.max(...xs)).toBeCloseTo(576, 0); // an 8 x 6 inch page in points
  });
});

describe('a DXF made from a point cloud map (tools/pointcloud-to-dxf)', () => {
  const d = () =>
    parseDxf(readFileSync('tests/fixtures/drawings/warehouse_mexico.dxf', 'utf8'), 'warehouse_mexico.dxf');
  it('is read as metres, with its layers understood without any review', () => {
    const s = summarise(d());
    expect(s.guessedUnit).toBe(1);
    expect(s.rules.layers.WALL.kind).toBe('wall');
    expect(s.rules.layers.EQUIP.kind).toBe('machine');
    expect(s.rules.layers.PILLAR.kind).toBe('pillar');
    expect(s.rules.layers.ROOM.kind).toBe('area');
  });
  it('gives a handful of walls of the right thickness, machines, pillars and one named room', () => {
    const dr = d();
    const b = buildDrawing(dr, summarise(dr).rules, 1);
    expect(b.lines.length).toBeGreaterThanOrEqual(8);
    expect(b.lines.length).toBeLessThanOrEqual(20); // a few walls, not hundreds of traced pieces
    for (const l of b.lines) expect(l.thickness).toBeGreaterThan(0.08);
    for (const l of b.lines) expect(l.thickness).toBeLessThan(0.4);
    expect(b.boxes.filter((x) => x.kind === 'machine').length).toBeGreaterThanOrEqual(5);
    expect(b.areas.length).toBeGreaterThanOrEqual(1);
    expect(b.areas[0].label).toBe('Hall');
    const w = b.bounds!.maxX - b.bounds!.minX,
      h = b.bounds!.maxY - b.bounds!.minY;
    expect(w).toBeGreaterThan(10);
    expect(w).toBeLessThan(20);
    expect(h).toBeGreaterThan(22);
    expect(h).toBeLessThan(32);
  });
});
