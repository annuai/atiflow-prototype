import { zipSync } from 'fflate';

/** Small Deployment Manager exports for tests (v5 and v2), written the way Python writes JSON, so a round trip can be compared byte for byte. */
const enc = (s: string) => new TextEncoder().encode(s);
export const py = (v: unknown): string => JSON.stringify(v, null, 4);
export const jsonFile = (v: unknown, indent = 4) => enc(JSON.stringify(v, null, indent));

/** A NumPy .npy of bytes (rows x cols) inside an .npz. */
export function npz(rows: number, cols: number, data: Uint8Array): Uint8Array {
  const text = `{'descr': '|u1', 'fortran_order': False, 'shape': (${rows}, ${cols}), }`;
  const pad = 64 - ((10 + text.length + 1) % 64);
  const header = enc(text + ' '.repeat(pad) + '\n');
  const out = new Uint8Array(10 + header.length + data.length);
  out.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0, header.length & 255, header.length >> 8]);
  out.set(header, 10);
  out.set(data, 10 + header.length);
  return zipSync({ 'arr_0.npy': out });
}
export function poses(vals: number[]): Uint8Array {
  const text = `{'descr': '<f8', 'fortran_order': False, 'shape': (${vals.length / 3}, 3), }`;
  const header = enc(text + ' '.repeat(64 - ((10 + text.length + 1) % 64)) + '\n');
  const out = new Uint8Array(10 + header.length + vals.length * 8);
  out.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0, header.length & 255, header.length >> 8]);
  out.set(header, 10);
  new Float64Array(out.buffer, 10 + header.length, vals.length).set(vals);
  return out;
}
/** The lidar files of a tiny site: 400 x 300 cells of 2 cm, origin cell [100, 50], two long walls (x = 1 m and y = 3 m). */
function lidar(): Record<string, Uint8Array> {
  const A = 400,
    B = 300,
    grid = new Uint8Array(A * B);
  for (let b = 40; b <= 200; b++) grid[150 * B + b] = 15;
  for (let a = 150; a <= 250; a++) grid[a * B + 200] = 15;
  const path: number[] = [];
  for (let y = 0.2; y <= 2.5; y += 0.1) path.push(0, y, 1.57);
  return {
    'yelli_meta.json': jsonFile({ grid_res: 0.02, num_lookup_levels: 20, map_origins: [[100, 50]] }, 0),
    'yelli_map.npz': npz(A, B, grid),
    'yelli_poses.npy': poses(path),
  };
}

const line = (
  id: number,
  t1: number[],
  t2: number[],
  bidir: boolean,
  related: object,
  name = `lane_${id}`,
  heading = 'both',
) => ({
  id,
  t1,
  t2,
  lane_name: name,
  regime: 'default',
  related_lines: related,
  pre_segment_action: null,
  bidirectional: bidir,
  bidirectional_line: null,
  heading_direction: heading,
  custom_weight: null,
  unknown_field: 'kept',
});
const rel = (r0: object, r1: object) => ({ '0': r0, '1': r1 });
const link = (t: string) => ({ terminal: t, radius: null });
const plain = () => ({
  park: { pick: { params: {} }, drop: { params: {} } },
  unpark: { laden: { params: {} }, unladen: { params: {} } },
});
const station = (id: number, name: string, pose: number[], lane: number, orientation = 'off_lane') => ({
  id,
  station_name: name,
  pose,
  orientation,
  station_tags: [],
  three_point_turn: {
    enable: false,
    start_direction: 'left',
    start_action: 'forward',
    aisle_width: 0.0,
    aisle_length: 0.0,
  },
  nodes: [{ lane_ids: [lane], ...plain() }],
  is_transit_allowed: true,
  unpark_merge: true,
});

/**
 * A v5 export in miniature: three lines in a U (L1 two-way along y = 0, L2 one-way up x = 10, L3 two-way back along y = 8), a node on L1 at x = 3 and one at x = 7, two stations, and one
 * 2 x 2 staging area with a station for every cell. Every file is written in Python's format.
 */
export function v5Mini(): Uint8Array {
  const lines = {
    '1': line(1, [0, 0], [10, 0], true, rel({}, { '2': link('t1') })),
    '2': line(2, [10, 0], [10, 8], false, rel({ '1': link('t2') }, { '3': link('t1') })),
    '3': line(3, [10, 8], [0, 8], true, rel({ '2': link('t2') }, {})),
  };
  const stations = {
    '1': station(1, 'Dock A', [3, 0.2, 1.571], 1),
    '2': station(2, 'Dock B', [7, 0.2, 1.571], 1),
  };
  const cell = (r: number, c: number) => ({
    id: 100000 + (r - 1) * 2 + c,
    graph_node_coords: null,
    is_transit_allowed: true,
    orientation: 'off_lane',
    pose: [20 - (c - 1) * 3, 5 + (r - 1) * 1, 3.141],
    station_lane: null,
    station_lane_unpark: null,
    station_name: `AREA_${'AB'[c - 1]}${r}`,
    station_tags: [],
    type: 'staging_area',
    unpark_merge: true,
    extra_args: {},
    nodes: [],
  });
  const cells = [cell(1, 1), cell(1, 2), cell(2, 1), cell(2, 2)];
  const attrLines = {
    ...Object.fromEntries(
      Object.entries(lines).map(([k, l]) => [
        k,
        {
          ...l,
          related_lines: [
            (l.related_lines as Record<string, object>)['0'],
            (l.related_lines as Record<string, object>)['1'],
            {},
          ],
        },
      ]),
    ),
    '4': { ...line(4, [10, 0], [0, 0], true, [{}, {}, {}], 'lane_1'), bidirectional_line: 1 },
    '5': { ...line(5, [0, 8], [10, 8], true, [{}, {}, {}], 'lane_3'), bidirectional_line: 3 },
  };
  const graphPoint = (x: number, y: number) => ({ pos: [x, y] });
  const edge = (a: string, b: string, w: number, h: string | null = null) => ({
    start_node: a,
    end_node: b,
    weight: w,
    heading_direction: h,
  });
  const graph = {
    metadata: { version: 1, timestamp: '2026-01-01 00:00:00', gmaj_checksum: 'abc', release: 1.0 },
    nodes_info: {
      N1: graphPoint(0, 0),
      N2: graphPoint(10, 0),
      N3: graphPoint(10, 8),
      N4: graphPoint(0, 8),
      N5: graphPoint(3, 0),
      N6: graphPoint(7, 0),
    },
    edges_info: {
      E1: edge('N1', 'N5', 3),
      E2: edge('N5', 'N1', 3),
      E3: edge('N5', 'N6', 4),
      E4: edge('N6', 'N5', 4),
      E5: edge('N6', 'N2', 3),
      E6: edge('N2', 'N6', 3),
      E7: edge('N2', 'N3', 8),
      E8: edge('N3', 'N4', 10),
      E9: edge('N4', 'N3', 10),
    },
    stations_info: {
      'Dock A': {
        pose: [3, 0.2, 1.571],
        tags: [],
        properties: {},
        orientation: 'off_lane',
        name: 'Dock A',
        graph_node_coords: null,
        associated_nodes: { N5: plain() },
      },
      'Dock B': {
        pose: [7, 0.2, 1.571],
        tags: [],
        properties: {},
        orientation: 'off_lane',
        name: 'Dock B',
        graph_node_coords: null,
        associated_nodes: { N6: plain() },
      },
      ...Object.fromEntries(
        cells.map((c) => [
          c.station_name,
          {
            pose: c.pose,
            tags: [],
            properties: {},
            orientation: 'off_lane',
            name: c.station_name,
            graph_node_coords: null,
            associated_nodes: {},
          },
        ]),
      ),
    },
  };
  const staging = {
    AREA: {
      cells: [
        [
          { station_id: 100001, station_name: 'AREA_A1', tags: [] },
          { station_id: 100002, station_name: 'AREA_B1', tags: [] },
        ],
        [
          { station_id: 100003, station_name: 'AREA_A2', tags: [] },
          { station_id: 100004, station_name: 'AREA_B2', tags: [] },
        ],
      ],
      row_level_params: {},
      column_level_params: {},
      metadata: {
        staging_id: 1,
        map_id: null,
        name: 'AREA',
        x: 21,
        y: 4.75,
        rotation: 180.0,
        rows: 2,
        cols: 2,
        total_width: 7.0,
        total_height: 3.0,
        row_spacing: 1.0,
        col_spacing: 1.0,
        cell_width: 2.0,
        cell_height: 1.0,
        direction: 0.0,
        station_offset: 0.0,
        pickup_drop_logic: 'FIFO',
        sherpa_type: 'tug',
        properties: {},
      },
    },
  };
  return zipSync({
    'Mini/map/webui_map.json': jsonFile({
      map_name: 'Mini',
      map_version: 'v5',
      stations: {
        '1': { id: 1, name: 'Station 1', x: 0.0, y: 0.0, rotation: 0.0 },
        '2': { id: 2, name: 'Station 2', x: 0.0, y: 0.0, rotation: 0.0 },
      },
    }),
    'Mini/map/gmaj.json': jsonFile({ terminal_lines_info: lines, stations_info: stations, metadata: {} }),
    'Mini/map/grid_map_attributes.json': jsonFile({
      terminal_lines_info: attrLines,
      stations_info: {
        ...Object.fromEntries(
          Object.entries(stations).map(([k, s]) => [
            k,
            { ...s, type: 'point', station_lane: null, station_lane_unpark: null },
          ]),
        ),
        ...Object.fromEntries(cells.map((c) => [String(c.id), c])),
      },
      metadata: {},
    }),
    'Mini/map/graph_object_v5.json': jsonFile(graph, 3),
    'Mini/map/staging_areas.json': jsonFile(staging),
    'Mini/map/ez.json': jsonFile({ ez_gates: {} }),
    ...Object.fromEntries(Object.entries(lidar()).map(([k, v]) => [`Mini/map/${k}`, v])),
  });
}

/** A v2 (point-to-point) export in miniature: three stations in a row, a route 1 -> 2 through one waypoint, a route 2 -> 3 straight, one gate. */
export function v2Mini(): Uint8Array {
  const st = (id: number, name: string, x: number, y: number, rot: number) => ({
    id,
    name,
    x,
    y,
    rotation: rot,
    charging: false,
    inplace: false,
    clockwise: 0,
    common_dispatch_station: false,
    post_process: false,
    station_tags: [],
    hidden: false,
  });
  const stations = { '1': st(1, 'S1', 0, 0, 90), '2': st(2, 'S2', 10, 6, 0), '3': st(3, 'S3', 20, 0, 0) };
  const routes = {
    '10': { id: 10, from_station: 1, to_station: 2, direction: 'forward', radius: 1.0, node: [11] },
    '12': { id: 12, from_station: 2, to_station: 3, direction: 'forward', radius: 1.0, node: [] },
  };
  const nodes = { '11': { id: 11, x: 0, y: 6, route_id: 10, post_process: false, radius: 1.0 } };
  const planned = [
    [
      [1, 2],
      [
        [
          'forward',
          [
            ['straight', [0, 0], [0, 5], 0],
            ['turn', [0, 5], [0, 1], [1, 6], [1, 0], 3],
            ['straight', [1, 6], [10, 6], 0],
          ],
        ],
      ],
    ],
    [
      [2, 3],
      [
        ['forward', [['straight', [10, 6], [20, 0], 0]]],
        ['inplace', 1.5],
      ],
    ],
  ];
  const lineOf = (id: number, a: number[], b: number[]) => ({
    t1: a,
    t2: b,
    lane_name: String(id),
    is_edge_line: true,
    id,
    regime: 'default',
    pre_segment_action: null,
  });
  const aStation = (name: string, x: number, y: number, th: number) => ({
    pose: [x, y, th],
    station_tags: [],
    orientation: 'axial',
    station_name: name,
    graph_node_coords: null,
    is_transit_allowed: true,
    station_lane: null,
    unpark_merge: true,
  });
  return zipSync({
    'Mini2/map/webui_map.json': jsonFile({
      map_name: 'Mini2',
      map_version: 'v2',
      stations: Object.fromEntries(
        Object.entries(stations).map(([k, s]) => [
          k,
          { ...s, three_point_turn: { enable: false }, orientation: 'null' },
        ]),
      ),
    }),
    'Mini2/map/waypoints.json': jsonFile({
      stations: [
        [0, 0, 1.571],
        [10, 6, 0],
        [20, 0, 0],
      ],
      routes: planned,
      map_editor: { map_data: { origin: { x: 0, y: 0 } }, stations, routes, nodes },
    }),
    'Mini2/map/grid_map_attributes.json': jsonFile({
      terminal_lines_info: {
        '0': lineOf(0, [0, 0], [0, 6]),
        '1': lineOf(1, [0, 6], [10, 6]),
        '2': lineOf(2, [10, 6], [20, 0]),
      },
      stations_info: { '1': aStation('S1', 0, 0, 1.571), '2': aStation('S2', 10, 6, 0), '3': aStation('S3', 20, 0, 0) },
      metadata: { wpsj_checksum: 'abc' },
    }),
    'Mini2/map/ez.json': jsonFile({
      ez_gates: {
        '1': {
          id: 1,
          name: 'Gate',
          line_segment: [
            [0, 0],
            [1, 1],
          ],
          opening_direction: [0.0, -1.0],
          exclusive_parking: false,
          station_pose: [5, 3, 0.0],
          linked_gate: false,
          linked_gates_ids: [],
          apply_dist: 0.5,
          gate_tags: [],
          linked_poses: [],
          polygon_edges: [
            [
              [4, 2],
              [6, 2],
            ],
            [
              [6, 2],
              [6, 4],
            ],
            [
              [6, 4],
              [4, 4],
            ],
            [
              [4, 4],
              [4, 2],
            ],
          ],
        },
      },
    }),
    ...Object.fromEntries(Object.entries(lidar()).map(([k, v]) => [`Mini2/map/${k}`, v])),
  });
}
