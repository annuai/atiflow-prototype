import type { PooledGrid } from './pool';

/**
 * Which way round the grid is stored. Two exports exist: `rows-y` (the array's rows run down the picture, so axis 0 is y and axis 1 is x; the first one we saw) and `x-rows` (axis 0 is x
 * and axis 1 is y pointing up; the v5 export). `map_origins` is always [x cell, y cell]. The file does not say which, so it is found out: the path the robot drove while mapping (or, failing
 * that, the stations and roads) must lie on free floor with walls near it, and only one way round puts it there.
 */
export type Orientation = 'rows-y' | 'x-rows';

/** A point (metres from the origin) of the grid in the POOLED picture for each orientation, or null when outside it. */
export function poolCell(g: PooledGrid, o: Orientation, res: number, origin: [number, number], x: number, y: number) {
  const f = g.factor * res;
  const [ox, oy] = origin;
  const a = o === 'rows-y' ? oy / g.factor - y / f : ox / g.factor + x / f;
  const b = o === 'rows-y' ? ox / g.factor + x / f : oy / g.factor + y / f;
  const ai = Math.floor(a),
    bi = Math.floor(b);
  return ai >= 0 && ai < g.poolRows && bi >= 0 && bi < g.poolCols ? { a: ai, b: bi } : null;
}

/** How well the probes fit one orientation: the share that stand on free floor with a wall within `reach` metres. */
function fit(
  g: PooledGrid,
  o: Orientation,
  res: number,
  origin: [number, number],
  probes: [number, number][],
  minLevel: number,
  reach: number,
) {
  const r = Math.max(1, Math.ceil(reach / (g.factor * res)));
  let good = 0;
  for (const [x, y] of probes) {
    const c = poolCell(g, o, res, origin, x, y);
    if (!c || g.levels[c.a * g.poolCols + c.b] >= minLevel) continue;
    let near = false;
    for (let da = -r; da <= r && !near; da++) {
      const a = c.a + da;
      if (a < 0 || a >= g.poolRows) continue;
      for (let db = -r; db <= r; db++) {
        const b = c.b + db;
        if (b >= 0 && b < g.poolCols && g.levels[a * g.poolCols + b] >= minLevel) {
          near = true;
          break;
        }
      }
    }
    if (near) good++;
  }
  return probes.length ? good / probes.length : 0;
}

/** The orientation that fits the probes best; `rows-y` (the earlier convention) when they cannot tell. `scores` is for the log and tests. */
export function detectOrientation(
  g: PooledGrid,
  res: number,
  origin: [number, number],
  probes: [number, number][],
  minLevel: number,
): { orientation: Orientation; scores: Record<Orientation, number> } {
  const [ox, oy] = origin;
  const fits = { 'rows-y': ox < g.cols && oy < g.rows, 'x-rows': ox < g.rows && oy < g.cols };
  if (fits['rows-y'] !== fits['x-rows'])
    return { orientation: fits['rows-y'] ? 'rows-y' : 'x-rows', scores: { 'rows-y': 0, 'x-rows': 0 } };
  const step = Math.max(1, Math.floor(probes.length / 1500));
  const sample = probes.filter((_, i) => i % step === 0);
  const scores = {
    'rows-y': fit(g, 'rows-y', res, origin, sample, minLevel, 3),
    'x-rows': fit(g, 'x-rows', res, origin, sample, minLevel, 3),
  };
  return { orientation: scores['x-rows'] > scores['rows-y'] + 0.05 ? 'x-rows' : 'rows-y', scores };
}
