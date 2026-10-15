import type { Lane, NavGraph, NavNode, Station } from '../../src/core/types';

/** Tiny hand-made lane maps for traffic tests: every road is a pair of one-way lanes (keep-right offset), stations hang on dead-end spurs. */
interface GridOptions {
  cols: number;
  rows: number;
  spacing?: number;
  offset?: number;
  fleet?: string;
  spurs?: 'all' | 'edges';
}
export function gridMap({
  cols,
  rows,
  spacing = 14,
  offset = 0.5,
  fleet = 'f1',
  spurs = 'edges',
}: GridOptions): NavGraph {
  const nodes: NavNode[] = [],
    lanes: Lane[] = [],
    stations: Station[] = [];
  const id = (c: number, r: number) => `n${c}_${r}`;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) nodes.push({ id: id(c, r), x: c * spacing, y: r * spacing, kind: 'waypoint' });
  const at = (n: string) => nodes.find((q) => q.id === n)!;
  const road = (a: NavNode, b: NavNode, extra = 0) => {
    const L = Math.hypot(b.x - a.x, b.y - a.y),
      dx = (b.x - a.x) / L,
      dy = (b.y - a.y) / L;
    for (const [p, q, sx, sy, ex, ey] of [
      [a, b, dx, dy, dx, dy],
      [b, a, -dx, -dy, -dx, -dy],
    ] as const) {
      const nx = sy * offset,
        ny = -sx * offset; // keep right
      lanes.push({
        id: `L${lanes.length + 1}`,
        from: p.id,
        to: q.id,
        geom: [
          [p.x + nx + sx * extra, p.y + ny + sy * extra],
          [q.x + nx - ex * extra, q.y + ny - ey * extra],
        ],
        fleets: [fleet],
        speed: 1.2,
        len: L,
      });
    }
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) road(at(id(c, r)), at(id(c + 1, r)));
      if (r + 1 < rows) road(at(id(c, r)), at(id(c, r + 1)));
    }
  let k = 0;
  const spurAt = (n: NavNode, dx: number, dy: number) => {
    const s: NavNode = { id: `s${k}`, x: n.x + dx * 5, y: n.y + dy * 5, kind: 'station' };
    nodes.push(s);
    road(n, s);
    stations.push({
      id: `STA-${100 + k}`,
      name: `Station ${k + 1}`,
      nodeId: s.id,
      type: k % 2 ? 'drop' : 'pick',
      zone: null,
      fleets: [fleet],
    });
    k++;
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const n = at(id(c, r));
      if (spurs === 'all' || c === 0) spurAt(n, -1, 0);
      if (spurs === 'all' || c === cols - 1) spurAt(n, 1, 0);
      if (spurs === 'all' || r === 0) spurAt(n, 0, -1);
      if (spurs === 'all' || r === rows - 1) spurAt(n, 0, 1);
    }
  return {
    schema: 2,
    siteId: 'test',
    nodes,
    lanes,
    stations,
    fleets: [{ id: fleet, name: 'Test fleet', color: '#14b8a6', areas: [] }],
    trafficZones: [],
    forbiddenZones: [],
  };
}

/** One narrow two-lane aisle (opposite lanes only `gap` apart). Two fleets share it and each shuttles between its own two stations at the far ends, so the robots meet head-on in the aisle. */
export function aisleMap(length = 24, gap = 0.8): NavGraph {
  const nodes: NavNode[] = [
    { id: 'a', x: 0, y: 0, kind: 'waypoint' },
    { id: 'b', x: length, y: 0, kind: 'waypoint' },
    { id: 'sa', x: -5, y: 0, kind: 'station' },
    { id: 'sb', x: length + 5, y: 0, kind: 'station' },
    { id: 'na', x: 0, y: 6, kind: 'station' },
    { id: 'nb', x: length, y: 6, kind: 'station' },
  ];
  const lanes: Lane[] = [];
  const add = (from: string, to: string, g: [number, number][], len: number) =>
    lanes.push({ id: `L${lanes.length + 1}`, from, to, geom: g, fleets: ['f1', 'f2'], speed: 1.2, len });
  const h = gap / 2;
  add(
    'sa',
    'a',
    [
      [-5, -h],
      [0, -h],
    ],
    5,
  );
  add(
    'a',
    'sa',
    [
      [0, h],
      [-5, h],
    ],
    5,
  );
  add(
    'a',
    'b',
    [
      [0, -h],
      [length, -h],
    ],
    length,
  );
  add(
    'b',
    'a',
    [
      [length, h],
      [0, h],
    ],
    length,
  );
  add(
    'b',
    'sb',
    [
      [length, -h],
      [length + 5, -h],
    ],
    5,
  );
  add(
    'sb',
    'b',
    [
      [length + 5, h],
      [length, h],
    ],
    5,
  );
  add(
    'a',
    'na',
    [
      [0.5, 0],
      [0.5, 6],
    ],
    6,
  );
  add(
    'na',
    'a',
    [
      [-0.5, 6],
      [-0.5, 0],
    ],
    6,
  );
  add(
    'b',
    'nb',
    [
      [length + 0.5, 0],
      [length + 0.5, 6],
    ],
    6,
  );
  add(
    'nb',
    'b',
    [
      [length - 0.5, 6],
      [length - 0.5, 0],
    ],
    6,
  );
  const station = (id: string, name: string, nodeId: string, type: Station['type'], fleet: string): Station => ({
    id,
    name,
    nodeId,
    type,
    zone: null,
    fleets: [fleet],
  });
  const stations = [
    station('STA-1', 'West', 'sa', 'pick', 'f1'),
    station('STA-2', 'East', 'sb', 'drop', 'f1'),
    station('STA-3', 'North west', 'na', 'pick', 'f2'),
    station('STA-4', 'North east', 'nb', 'drop', 'f2'),
  ];
  return {
    schema: 2,
    siteId: 'aisle',
    nodes,
    lanes,
    stations,
    fleets: [
      { id: 'f1', name: 'Fleet 1', color: '#14b8a6', areas: [] },
      { id: 'f2', name: 'Fleet 2', color: '#f59e0b', areas: [] },
    ],
    trafficZones: [],
    forbiddenZones: [],
  };
}
