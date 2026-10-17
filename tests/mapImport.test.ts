import { readFileSync } from 'node:fs';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readNpy } from '@/features/map-import/core/npy';
import { encodeMaskPng } from '@/features/map-import/core/png';
import { crop, halve, pyramid, removeSpecks, worldRect } from '@/features/map-import/core/grid';
import { readZip } from '@/features/map-import/core/zip';
import { importEntries } from '@/features/map-import/formats/registry';
import { ImportError } from '@/features/map-import/core/types';
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
