import { unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildMapData } from '@/features/map-import/build';
import { routable } from '@/features/map-editor/model/connect';
import { planTrip } from '@/features/map-editor/model/simulate';
import { prepareImport } from '@/features/map-import/core/prepare';
import { poolNpz, poolFactor } from '@/features/map-import/core/pool';
import { readZip } from '@/features/map-import/core/zip';
import { exportMapZip } from '@/features/map-import/export';
import { importEntries } from '@/features/map-import/formats/registry';

/** A NumPy .npy of bytes (shape rows x cols), and an .npz holding it, the way NumPy writes them. */
function npy(rows: number, cols: number, data: Uint8Array): Uint8Array {
  const text = `{'descr': '|u1', 'fortran_order': False, 'shape': (${rows}, ${cols}), }`;
  const pad = 64 - ((10 + text.length + 1) % 64);
  const header = new TextEncoder().encode(text + ' '.repeat(pad) + '\n');
  const out = new Uint8Array(10 + header.length + data.length);
  out.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0, header.length & 255, header.length >> 8]);
  out.set(header, 10);
  out.set(data, 10 + header.length);
  return out;
}
const npz = (rows: number, cols: number, data: Uint8Array) => zipSync({ 'arr_0.npy': npy(rows, cols, data) });
const f64 = (vals: number[]) => {
  const text = `{'descr': '<f8', 'fortran_order': False, 'shape': (${vals.length / 3}, 3), }`;
  const header = new TextEncoder().encode(text + ' '.repeat(64 - ((10 + text.length + 1) % 64)) + '\n');
  const out = new Uint8Array(10 + header.length + vals.length * 8);
  out.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0, header.length & 255, header.length >> 8]);
  out.set(header, 10);
  new Float64Array(out.buffer, 10 + header.length, vals.length).set(vals);
  return out;
};
const json = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));

/**
 * A v5 export in miniature. The grid is stored the v5 way: axis 0 is x, axis 1 is y pointing up (400 x 300 cells of 2 cm, origin cell [100, 50]). Two long walls: x = 1 m from y -0.2 to 3 m,
 * and y = 3 m from x = 1 to 3 m. The robot drove along x = 0 from y 0.2 to 2.5 m.
 */
function v5Zip(extra: Record<string, Uint8Array> = {}) {
  const A = 400,
    B = 300,
    grid = new Uint8Array(A * B);
  for (let b = 40; b <= 200; b++) grid[150 * B + b] = 15; // x = (150 - 100) * 0.02 = 1 m, y = (b - 50) * 0.02
  for (let a = 150; a <= 250; a++) grid[a * B + 200] = 15; // y = 3 m
  const poses: number[] = [];
  for (let y = 0.2; y <= 2.5; y += 0.1) poses.push(0, y, 1.57);
  const lines = {
    '1': {
      id: 1,
      t1: [0, 0],
      t2: [10, 0],
      lane_name: 'aisle',
      bidirectional: true,
      bidirectional_line: null,
      heading_direction: 'both',
      regime: 'default',
    },
    '2': {
      id: 2,
      t1: [10, 0],
      t2: [10, 8],
      lane_name: 'one',
      bidirectional: false,
      bidirectional_line: null,
      heading_direction: 'forward',
      regime: 'default',
    },
  };
  const gmaj = {
    terminal_lines_info: lines,
    stations_info: {
      '1': {
        id: 1,
        station_name: 'Dock A',
        pose: [5, 0, Math.PI / 2],
        orientation: 'on_lane',
        station_tags: [],
        nodes: [{ lane_ids: [1] }],
      },
      '2': { id: 2, station_name: 'PARKING', pose: [10, 4, 0], orientation: 'off_lane', station_tags: [] },
    },
    metadata: {},
  };
  const attrs = {
    ...gmaj,
    terminal_lines_info: {
      ...lines,
      '195': {
        id: 195,
        t1: [10, 0],
        t2: [0, 0],
        lane_name: 'aisle',
        bidirectional: true,
        bidirectional_line: 1,
        heading_direction: 'both',
      },
    },
  };
  const area = (rows: number, cols: number) => ({
    cells: [[{ station_name: 'S_A1', station_id: 100001 }]],
    row_level_params: {},
    column_level_params: {},
    metadata: {
      name: 'ROTR1',
      x: 147.182,
      y: -1.855,
      rotation: 180,
      rows,
      cols,
      cell_width: 2,
      cell_height: 0.5,
      row_spacing: 1,
      col_spacing: 2.25,
      pickup_drop_logic: 'LIFO',
      sherpa_type: 'pallet_mover',
    },
  });
  const files: Record<string, Uint8Array> = {
    'map/webui_map.json': json({
      map_name: 'V5',
      map_version: 'v5',
      stations: {
        '1': { id: 1, name: 'Station 1', x: 0, y: 0, rotation: 0, charging: false, station_tags: [] },
        '2': {
          id: 2,
          name: 'Station 2',
          x: 0,
          y: 0,
          rotation: 0,
          charging: false,
          station_tags: ['dispatch_not_reqd'],
        },
        '3': { id: 3, name: 'Station 3', x: 0, y: 0, rotation: 0, charging: false, station_tags: [] },
      },
    }),
    'map/yelli_meta.json': json({ grid_res: 0.02, num_lookup_levels: 20, map_origins: [[100, 50]] }),
    'map/yelli_map.npz': npz(A, B, grid),
    'map/yelli_poses.npy': f64(poses),
    'map/gmaj.json': json(gmaj),
    'map/grid_map_attributes.json': json(attrs),
    'map/graph_object_v5.json': json({
      nodes_info: { N1: { pos: [0, 0] }, N2: { pos: [10, 0] }, N3: { pos: [10, 8] }, N9: { pos: [3, 0] } },
      edges_info: {},
      stations_info: { 'Dock A': { associated_nodes: { N9: {} } } },
    }),
    'map/staging_areas.json': json({ ROTR1: area(2, 3) }),
    'map/ez.json': json({ ez_gates: {} }),
    ...extra,
  };
  return zipSync(files);
}

describe('streamed grid', () => {
  it('pools every block to its strongest cell, however big the grid', () => {
    const rows = 60,
      cols = 50,
      data = new Uint8Array(rows * cols);
    data[7 * cols + 9] = 12;
    data[8 * cols + 9] = 5;
    data[59 * cols + 49] = 20;
    const g = poolNpz(npz(rows, cols, data), 700)!; // 3000 cells do not fit in 700: pooled by 4 (15 x 13)
    expect(g.factor).toBe(4);
    expect([g.poolRows, g.poolCols]).toEqual([15, 13]);
    expect(g.levels[1 * 13 + 2]).toBe(12); // rows 4-7, cols 8-11
    expect(g.levels[2 * 13 + 2]).toBe(5);
    expect(g.levels[14 * 13 + 12]).toBe(20);
    expect(g.max).toBe(20);
    expect(poolFactor(28836, 21322)).toBe(8); // the 615-million-cell map that used to be refused
  });
  it('keeps full detail when the grid is small, and ignores a grid that is not bytes', () => {
    const d = new Uint8Array(12).map((_, i) => i);
    expect(poolNpz(npz(3, 4, d))!.levels).toEqual(d);
  });
});

describe('Deployment Manager v5 export', () => {
  const prepared = () => prepareImport(v5Zip());
  it('reads the grid the right way round (axis 0 is x)', () => {
    const g = importEntries(readZip(v5Zip())).grid!;
    const at = (x: number, y: number) =>
      g.alpha[Math.round(g.originRow - y / g.res) * g.width + Math.round(g.originCol + x / g.res)];
    expect(at(1, 1.5)).toBeGreaterThan(0); // the wall at x = 1 m
    expect(at(2, 3)).toBeGreaterThan(0); // the wall at y = 3 m
    expect(at(-1, 1.5)).toBe(0);
    expect(at(2, 1)).toBe(0);
  });
  it('takes the real stations from gmaj.json instead of the placeholders', () => {
    const m = prepared().map;
    const s = Object.fromEntries(m.stations.map((x) => [x.externalId, x]));
    expect(s['1']).toMatchObject({ name: 'Dock A', x: 5, y: 0, rotation: 90, placed: true, onLane: true });
    expect(s['2']).toMatchObject({ name: 'PARKING', type: 'park', onLane: false });
    expect(s['3']).toMatchObject({ name: 'Station 3', placed: true }); // alone at the origin: it may really be there
    expect(m.warnings.map((w) => w.code)).not.toContain('station.unplaced');
  });
  it('turns lines into roads (the reverse copy of a two-way road is not a second road)', () => {
    const r = prepared().map.roads;
    expect(r.map((x) => [x.name, x.oneWay, x.heading])).toEqual([
      ['aisle', false, 'both'],
      ['one', true, 'forward'],
    ]);
    expect(prepared().map.warnings.map((w) => w.code)).not.toContain('content.noRoutes');
  });
  it('reads staging areas: the corner becomes the centre of A1, with gaps and the retrieval order', () => {
    const [a] = prepared().map.stagingAreas;
    expect(a).toMatchObject({
      name: 'ROTR1',
      sherpaType: 'Pallet Mover',
      rows: 2,
      cols: 3,
      rowGap: 1,
      colGap: 2.25,
      retrieval: 'lifo',
    });
    expect(a.x).toBeCloseTo(146.182, 3); // 147.182 - 2 / 2
    expect(a.y).toBeCloseTo(-1.605, 3); // -1.855 + 0.5 / 2
  });
  it('builds the editor map: joined lanes, route nodes, stations always connected, areas with fresh ids', () => {
    const saved = buildMapData(prepared(), [], ['STA-105'], undefined, ['SA-003']);
    expect(saved.roads.some((r) => r.extra?.access)).toBe(false); // the way onto the route is made on the fly, never saved
    const d = routable(saved);
    expect(d.roads.filter((r) => !r.extra?.access)).toHaveLength(4); // the aisle is cut at the node N9 (3, 0), the one-way road where PARKING stands
    expect(d.stations.map((s) => s.id)).toEqual(['STA-106', 'STA-107', 'STA-108']);
    expect(d.stations.every((s) => d.lanes.some((l) => l.from === s.nodeId || l.to === s.nodeId))).toBe(true);
    // Dock A is joined to the node the file names for it (3, 0), not to the nearest point of the road (5, 0)
    const dock = d.stations[0];
    const access = d.lanes.find((l) => l.to === dock.nodeId)!;
    const from = d.nodes.find((n) => n.id === access.from)!;
    expect([from.x, from.y]).toEqual([3, 0]);
    expect(planTrip(saved, '', dock.id, d.stations[1].id).ok).toBe(true); // the saved map routes too
    expect(d.stagingAreas[0].id).toBe('SA-004');
    expect(d.roads.find((r) => r.name.startsWith('aisle'))?.extra).toMatchObject({ dm: { externalId: '1' } });
  });
  it('keeps the files it does not use out of the unread list', () => {
    expect(prepared().map.unread).toEqual([]);
    expect(prepareImport(v5Zip({ 'map/mystery.dat': new Uint8Array([1]) })).map.unread).toEqual(['map/mystery.dat']);
  });
  it('writes edits back to gmaj.json and keeps v5 fields out of webui_map.json', () => {
    const zip = v5Zip();
    const p = prepared();
    const d = buildMapData(p, [], []);
    d.stations[0] = { ...d.stations[0], name: 'Dock B' };
    const out = unzipSync(exportMapZip({ original: zip, data: d, name: 'V5', version: 'v5' }));
    const gmaj = JSON.parse(new TextDecoder().decode(out['map/gmaj.json']));
    expect(gmaj.stations_info['1']).toMatchObject({ station_name: 'Dock B', pose: [5, 0, Math.PI / 2] });
    expect(gmaj.stations_info['1'].nodes).toEqual([{ lane_ids: [1] }]); // untouched
    const ui = JSON.parse(new TextDecoder().decode(out['map/webui_map.json']));
    expect(ui.stations['1'].name).toBe('Station 1'); // the v5 web file only holds placeholders: the real data is in gmaj.json
    expect(ui.stations['1'].nodes).toBeUndefined();
    expect(new TextDecoder().decode(out['map/staging_areas.json'])).toBe(
      new TextDecoder().decode(unzipSync(zip)['map/staging_areas.json']),
    );
  });
});
