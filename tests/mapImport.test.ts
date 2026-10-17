import { readFileSync } from 'node:fs';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readNpy } from '@/features/map-import/core/npy';
import { encodeMaskPng } from '@/features/map-import/core/png';
import { crop, halve, pyramid, removeSpecks, worldRect } from '@/features/map-import/core/grid';
import { readZip } from '@/features/map-import/core/zip';
import { importEntries } from '@/features/map-import/formats/registry';
import { ImportError } from '@/features/map-import/core/types';
import { exportMapZip } from '@/features/map-import/export';
import {
  alignmentScore,
  applyPoint,
  autoAlign,
  IDENTITY,
  parseLayout,
  refineAlignment,
  samplePoints,
  solveSimilarity,
  transformLayout,
} from '@/features/map-import/core/dwg';
import { extractStructure } from '@/features/map-import/core/walls';
import { prepareImport } from '@/features/map-import/core/prepare';
import { buildMapData } from '@/features/map-import/build';
import { mapVersionsStore } from '@/features/map-editor/model/store';
import { moveStation } from '@/features/map-editor/model/stations';
import { publishProblems } from '@/features/map-editor/model/validate';

const dir = new URL('./fixtures/maps/', import.meta.url);
const file = (n: string) => new Uint8Array(readFileSync(new URL(n, dir)));
const NAMES = ['webui_map.json', 'yelli_meta.json', 'yelli_map.npz', 'yelli_poses.npy', 'yelli_frames.npy'];
/** The sample map as a zip the way a Mac makes it: a folder, junk files and all. */
const sampleZip = () =>
  zipSync({
    'test_annuai/map/.DS_Store': new Uint8Array([1]),
    '__MACOSX/test_annuai/map/._webui_map.json': new Uint8Array([1]),
    ...Object.fromEntries(NAMES.map((n) => [`test_annuai/map/${n}`, file(n)])),
  });

describe('npy reader', () => {
  it('reads the robot path', () => {
    const a = readNpy(file('yelli_poses.npy'));
    expect(a.shape).toEqual([289, 3]);
    expect(a.dtype).toBe('<f8');
  });
  it('refuses things that are not arrays', () => {
    expect(() => readNpy(new Uint8Array(20))).toThrow(ImportError);
  });
});

describe('zip', () => {
  it('skips junk files and keeps the map files', () => {
    const e = readZip(sampleZip());
    expect(Object.keys(e).sort()).toEqual(NAMES.map((n) => `test_annuai/map/${n}`).sort());
  });
  it('refuses what is not a zip and what expands too much', () => {
    expect(() => readZip(new Uint8Array([1, 2, 3]))).toThrow(/not a readable zip/);
    expect(() => readZip(sampleZip(), { entries: 2, entryBytes: 1e9, totalBytes: 1e9 })).toThrow(/too many/);
    expect(() => readZip(sampleZip(), { entries: 99, entryBytes: 1000, totalBytes: 1e9 })).toThrow(/too large/);
  });
});

describe('Deployment Manager import (the sample map)', () => {
  const map = importEntries(readZip(sampleZip()));
  it('reads name, version and stations', () => {
    expect(map.format).toBe('deployment-manager');
    expect(map.name).toBe('test_annuai');
    expect(map.version).toBe('v5');
    expect(map.stations).toHaveLength(23);
    expect(map.stations[0]).toMatchObject({ externalId: '1', name: 'Station 1', type: 'drop' });
    expect(map.stations[2].type).toBe('park'); // the `parking` tag
    expect(map.stations[0].extra.three_point_turn).toBeDefined(); // kept for an export
  });
  it('knows the stations have no position yet (all on the origin)', () => {
    expect(map.stations.every((s) => !s.placed)).toBe(true);
    expect(map.warnings.map((w) => w.code)).toContain('station.unplaced');
  });
  it('cuts the grid down to the building and puts the origin in the right cell', () => {
    const g = map.grid!;
    expect(g.res).toBe(0.02);
    expect(g.width * g.height).toBeLessThan(3896 * 4065 * 0.25);
    // the mapping path starts at the origin and must fall on the picture
    const r = worldRect(g);
    for (const [x, y] of map.path) expect(x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY).toBe(true);
    const [x, y] = map.path[0];
    expect(x).toBeCloseTo(0, 1);
    expect(y).toBeCloseTo(0, 1);
    expect(map.stats.pathPoints).toBe(289);
  });
  it('removes noise but keeps the walls', () => {
    expect(map.stats.removedSpecks).toBeGreaterThan(0);
    expect(map.stats.keptCells).toBeGreaterThan(30000);
  });
  it('stores the picture small', () => {
    const g = map.grid!;
    const png = encodeMaskPng(g.alpha, g.width, g.height);
    expect(png.length).toBeLessThan(600 * 1024);
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
  it('refuses a zip nobody recognises', () => {
    expect(() => importEntries({ 'a.txt': new Uint8Array([1]) })).toThrow(/not a map/);
  });
  it('still reads when the grid is missing (stations only)', () => {
    const e = readZip(sampleZip());
    for (const k of Object.keys(e)) if (/yelli/.test(k)) delete e[k];
    const m = importEntries(e);
    expect(m.grid).toBeNull();
    expect(m.warnings.map((w) => w.code)).toContain('grid.missing');
  });
});

describe('grid helpers', () => {
  const g = (w: number, h: number, cells: [number, number][]) => {
    const alpha = new Uint8Array(w * h);
    for (const [x, y] of cells) alpha[y * w + x] = 255;
    return { res: 0.02, width: w, height: h, originCol: 2, originRow: 3, alpha };
  };
  it('removes small pieces and keeps long ones', () => {
    const grid = g(10, 10, [
      [1, 1],
      [5, 5],
      [5, 6],
      [5, 7],
      [5, 8],
      [6, 8],
    ]);
    expect(removeSpecks(grid.alpha, 10, 10, 3)).toBe(1);
    expect(grid.alpha[1 * 10 + 1]).toBe(0);
    expect(grid.alpha[5 * 10 + 5]).toBe(255);
  });
  it('crop moves the origin with the cut', () => {
    const c = crop(g(10, 10, [[4, 5]]), { x0: 4, x1: 4, y0: 5, y1: 5 }, 1);
    expect([c.width, c.height, c.originCol, c.originRow]).toEqual([3, 3, -1, -1]);
  });
  it('halving keeps thin lines and the pyramid stops at the minimum size', () => {
    const h = halve(g(4, 4, [[1, 1]]));
    expect(h.width).toBe(2);
    expect(h.alpha[0]).toBe(255);
    expect(pyramid(g(2000, 1000, []), 512).map((l) => l.width)).toEqual([2000, 1000, 500]);
  });
});

describe('creating a map from an import', () => {
  const prepared = prepareImport(sampleZip());
  it('gives every station its own id, point and kept source fields', () => {
    const d = buildMapData(
      prepared,
      prepared.levels.map((_, i) => `asset-${i}`),
      ['STA-133'],
      {
        assetId: 'zip',
        fileName: 'a.zip',
        format: 'deployment-manager',
      },
    );
    expect(d.stations).toHaveLength(23);
    expect(d.stations[0]).toMatchObject({ id: 'STA-134', externalId: '1', unplaced: true, onLane: false });
    expect(d.stations[0].extra?.station_tags).toBeDefined();
    expect(d.nodes).toHaveLength(23);
    expect(d.base?.levels[0].assetId).toBe('asset-0');
    expect(d.source?.fileName).toBe('a.zip');
    expect(d.path).toHaveLength(289);
  });
  it('starts as a draft, blocks Publish until stations are placed, and the first publish takes the chosen version', () => {
    const d = buildMapData(prepared, ['a', 'b', 'c', 'd'].slice(0, prepared.levels.length));
    const s = mapVersionsStore.getState();
    s.createImported('m1', 5, d, 'tester');
    const h = mapVersionsStore.getState().byMap.m1;
    expect(h.versions).toHaveLength(1);
    expect(h.versions[0].status).toBe('draft');
    expect(publishProblems(d, null, () => []).filter((p) => p.level === 'block')).toHaveLength(23);
    const placed = moveStation(d, d.stations[0].id, { x: 1, y: 2 });
    expect(placed.stations[0].unplaced).toBeUndefined();
    expect(mapVersionsStore.getState().publish('m1', 'tester')).toBe(5);
    mapVersionsStore.getState().startDraft('m1', 'tester');
    expect(mapVersionsStore.getState().publish('m1', 'tester')).toBe(6);
  });
});

describe('walls and objects from the grid', () => {
  const rectGrid = () => {
    // a 10 m x 6 m room with 8 cm thick walls, a 0.6 m pillar inside and one speck outside (2 cm cells)
    const w = 600,
      h = 400,
      alpha = new Uint8Array(w * h);
    const fill = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) alpha[y * w + x] = 255;
    };
    fill(50, 50, 550, 54);
    fill(50, 346, 550, 350);
    fill(50, 50, 54, 350);
    fill(546, 50, 550, 350);
    fill(300, 200, 330, 230);
    fill(10, 10, 12, 12);
    return { res: 0.02, width: w, height: h, originCol: 50, originRow: 350, alpha };
  };
  it('finds the room as wall lines, the pillar as one box, and drops the speck', () => {
    const s = extractStructure(rectGrid());
    expect(s.equipment).toHaveLength(1);
    expect(s.equipment[0].w).toBeCloseTo(0.6, 0);
    const len = s.walls.reduce((n, w) => n + Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), 0);
    expect(len).toBeGreaterThan(30); // the perimeter is 32 m
    expect(len).toBeLessThan(36);
    expect(s.walls.length).toBeLessThan(12); // straight lines, not a pile of pixels
    for (const w of s.walls)
      for (const [x, y] of [w.a, w.b]) expect(x >= -0.3 && x <= 10.3 && y >= -0.3 && y <= 6.3).toBe(true);
  });
  it('turns the sample map into a plausible building', () => {
    const t0 = performance.now();
    const grid = importEntries(readZip(sampleZip())).grid!;
    const s = extractStructure(grid);
    expect(s.walls.length).toBeGreaterThan(20);
    expect(s.walls.length).toBeLessThan(4000);
    expect(performance.now() - t0).toBeLessThan(8000);
  });
});

describe('export back to the Deployment Manager', () => {
  const orig = sampleZip();
  const prepared = prepareImport(orig);
  const data = () =>
    buildMapData(
      prepared,
      prepared.levels.map((_, i) => `a${i}`),
    );
  it('writes positions into webui_map.json, keeps every other file byte for byte, adds our own folder', () => {
    let d = data();
    d = moveStation(d, d.stations[0].id, { x: 4.5, y: -2.25 });
    d = { ...d, stations: d.stations.map((s, i) => (i === 0 ? { ...s, name: 'Dock A', type: 'charge' as const } : s)) };
    const out = readZip(exportMapZip({ original: orig, data: d, name: 'test_annuai', version: 'v5' }));
    const ui = JSON.parse(new TextDecoder().decode(out['test_annuai/map/webui_map.json']));
    expect(ui.stations['1']).toMatchObject({ name: 'Dock A', x: 4.5, y: -2.25, charging: true });
    expect(ui.stations['1'].three_point_turn).toBeDefined(); // a field we do not edit is untouched
    expect(ui.stations['3'].station_tags).toContain('parking');
    expect(Object.keys(ui.stations)).toHaveLength(23);
    const before = readZip(orig);
    for (const k of ['yelli_map.npz', 'yelli_meta.json', 'yelli_poses.npy', 'yelli_frames.npy'])
      expect(out[`test_annuai/map/${k}`]).toEqual(before[`test_annuai/map/${k}`]);
    expect(out['test_annuai/map/ati_flow/map.json']).toBeDefined();
  });
  it('a station we added gets the next Deployment Manager id', () => {
    const d = data();
    const extra = {
      ...d.stations[0],
      id: 'STA-999',
      externalId: undefined,
      unplaced: undefined,
      name: 'New',
      extra: undefined,
      nodeId: 'N-999',
    };
    const out = readZip(
      exportMapZip({
        original: orig,
        data: {
          ...d,
          stations: [...d.stations, extra],
          nodes: [...d.nodes, { id: 'N-999', x: 1, y: 2, kind: 'station' }],
        },
        name: 'x',
        version: 'v5',
      }),
    );
    const ui = JSON.parse(new TextDecoder().decode(out['test_annuai/map/webui_map.json']));
    expect(ui.stations['24']).toMatchObject({ name: 'New', x: 1, y: 2 });
  });
  it('importing our own export brings everything back (roads, zones, moved stations) and the Deployment Manager still reads it', () => {
    let d = data();
    d = moveStation(d, d.stations[0].id, { x: 4.5, y: -2.25 });
    d = {
      ...d,
      zones: [
        {
          id: 'Z1',
          type: 'no-go',
          name: 'Nope',
          shape: { kind: 'rect', cx: 0, cy: 0, w: 1, h: 1, rot: 0 },
          polygon: [],
          props: {},
        },
      ],
    };
    const again = prepareImport(exportMapZip({ original: orig, data: d, name: 'test_annuai', version: 'v5' }));
    expect(again.map.ati).not.toBeNull();
    const back = buildMapData(
      again,
      again.levels.map((_, i) => `a${i}`),
    );
    expect(back.zones.map((z) => z.id)).toEqual(['Z1']);
    expect(back.stations).toHaveLength(23);
    const s1 = back.stations.find((s) => s.externalId === '1')!;
    expect(s1.unplaced).toBeUndefined();
    expect(back.nodes.find((n) => n.id === s1.nodeId)).toMatchObject({ x: 4.5, y: -2.25 });
  });
  it('makes a minimal folder when there is no original zip', () => {
    const out = readZip(exportMapZip({ original: null, data: data(), name: 'm', version: 'v2' }));
    expect(Object.keys(out).sort()).toEqual(['map/ati_flow/map.json', 'map/webui_map.json']);
  });
});

describe('laying a DWG over the map', () => {
  const wall = (ax: number, ay: number, bx: number, by: number) => ({
    a: [ax, ay] as [number, number],
    b: [bx, by] as [number, number],
    t: 0.2,
    h: 3,
    layer: 'x',
  });
  const room = [wall(0, 0, 10, 0), wall(10, 0, 10, 6), wall(10, 6, 0, 6), wall(0, 6, 0, 0)];
  it('two matching pairs give the exact move', () => {
    const t = solveSimilarity([
      { from: [0, 0], to: [5, 5] },
      { from: [10, 0], to: [5, 15] }, // turned a quarter turn, 1x scale
    ]);
    expect(t.scale).toBeCloseTo(1);
    expect(t.rot).toBeCloseTo(Math.PI / 2);
    const [x, y] = applyPoint(t, [0, 6]);
    expect([x, y].map((v) => Math.round(v * 100) / 100)).toEqual([-1, 5]);
  });
  it('refines a drawing that is a little off back onto the lidar walls', () => {
    const lidar = room;
    const off = { scale: 1.01, rot: 0.03, dx: 0.5, dy: -0.4 };
    const drawing = transformLayout({ walls: room, equipment: [], floorPolygons: [] }, off).walls; // the drawing as supplied: moved away
    const { t, score } = refineAlignment(drawing, lidar, IDENTITY);
    expect(score).toBeGreaterThan(0.9);
    expect(Math.abs(t.dx)).toBeLessThan(0.5); // moved most of the way back
    expect(alignmentScore(samplePoints(drawing), lidar, t)).toBeGreaterThan(
      alignmentScore(samplePoints(drawing), lidar, IDENTITY),
    );
  });
  it('accepts the layout the DWG import writes and refuses anything else', () => {
    expect(parseLayout({ walls: [{ a: [0, 0], b: [1, 1] }] })?.walls).toHaveLength(1);
    expect(parseLayout({ walls: [] })).toBeNull();
    expect(parseLayout('nope')).toBeNull();
  });
});

describe('auto alignment', () => {
  const w = (ax: number, ay: number, bx: number, by: number) => ({
    a: [ax, ay] as [number, number],
    b: [bx, by] as [number, number],
    t: 0.2,
    h: 3,
    layer: 'x',
  });
  const lidar = [w(-5, -3, 5, -3), w(5, -3, 5, 3), w(5, 3, -5, 3), w(-5, 3, -5, -3), w(0, -3, 0, 3)]; // a room with a partition, around the origin
  it('finds a drawing that is turned a quarter and far away', () => {
    const away = { scale: 1, rot: Math.PI / 2, dx: 100, dy: 40 };
    const drawing = transformLayout({ walls: lidar, equipment: [], floorPolygons: [] }, away).walls;
    const { t, score } = autoAlign(drawing, lidar);
    expect(score).toBeGreaterThan(0.85);
    // the room is symmetric, so a half turn is as good a match: what counts is that every wall of the drawing lies on a lidar wall
    expect(alignmentScore(samplePoints(drawing), lidar, t, 0.1)).toBeGreaterThan(0.85);
    expect(Math.hypot(t.dx, t.dy)).toBeGreaterThan(0); // and it did move
  });
});
