import { z } from 'zod';
import type { ImportedGate, ImportedRoad } from '../../core/types';

/**
 * The point-to-point ("v2") map of the Deployment Manager. There are no free roads: every station is on a route, and a route runs from one station to another in one direction through
 * waypoints the person clicked. `waypoints.json` holds them as `map_editor.routes` (from, to, direction, turning radius, the ids of its waypoints), `map_editor.nodes` (the waypoints) and,
 * for the robot, `routes` (the smoothed path of straights and turns the Deployment Manager worked out). We read the routes as the polyline the person drew (station, waypoints, station);
 * the smooth path is drawn again from the radius, and a route nobody edits is written back byte for byte.
 */
const num = z.coerce.number().finite();
const routeSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    from_station: z.union([z.string(), z.number()]),
    to_station: z.union([z.string(), z.number()]),
    direction: z.string().default('forward'),
    radius: num.default(1),
    node: z.array(z.union([z.string(), z.number()])).default([]),
  })
  .passthrough();
const nodeSchema = z.object({ id: z.union([z.string(), z.number()]), x: num, y: num }).passthrough();

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

export interface V2Routes {
  roads: ImportedRoad[];
  /** the stations' positions in the Deployment Manager's own list, in order: [x, y, heading] */
  found: boolean;
}

/** The routes of `waypoints.json` as roads between stations. `place(id)` = where the station with that file id stands. */
export function readRoutes(
  waypoints: unknown,
  place: (stationId: string) => { x: number; y: number; name: string } | undefined,
): V2Routes {
  const w = asRecord(waypoints);
  const me = asRecord(w.map_editor);
  const routes = asRecord(me.routes),
    nodes = asRecord(me.nodes);
  if (!Object.keys(routes).length) return { roads: [], found: !!Object.keys(w).length };
  // the second list: the planned path of every route, with an optional in-place turn at the end ["inplace", angle]
  const planned = Array.isArray(w.routes) ? (w.routes as unknown[][]) : [];
  const inplaceOf = (from: string, to: string, index: number): number | undefined => {
    const entry = planned[index];
    const same = (e: unknown[] | undefined) =>
      Array.isArray(e?.[0]) && String((e![0] as unknown[])[0]) === from && String((e![0] as unknown[])[1]) === to;
    const row = same(entry) ? entry : planned.find((e) => same(e));
    const items = Array.isArray(row?.[1]) ? (row![1] as unknown[]) : [];
    const ip = items.find((i) => Array.isArray(i) && i[0] === 'inplace') as unknown[] | undefined;
    return typeof ip?.[1] === 'number' ? ip[1] : undefined;
  };
  const roads: ImportedRoad[] = [];
  let index = -1;
  for (const [key, value] of Object.entries(routes)) {
    index++;
    const p = routeSchema.safeParse(value);
    if (!p.success) continue;
    const r = p.data;
    const a = place(String(r.from_station)),
      b = place(String(r.to_station));
    if (!a || !b) continue;
    const waypoints = r.node.flatMap((id) => {
      const n = nodeSchema.safeParse(nodes[String(id)]);
      return n.success ? [n.data] : [];
    });
    const { id: _id, from_station: _f, to_station: _t, direction, radius, node: _n, ...rest } = r;
    const inplace = inplaceOf(String(r.from_station), String(r.to_station), index);
    roads.push({
      externalId: String(r.id ?? key),
      fromStation: String(r.from_station),
      toStation: String(r.to_station),
      name: `${a.name} → ${b.name}`,
      points: [[a.x, a.y], ...waypoints.map((n): [number, number] => [n.x, n.y]), [b.x, b.y]],
      oneWay: true, // a route runs one way; the other way is another route
      heading: direction === 'reverse' ? 'backward' : 'forward',
      extra: {
        radius,
        direction,
        waypoints: waypoints.map(({ id, x, y, ...more }) => ({ id, x, y, ...more })),
        ...(inplace !== undefined ? { inplace } : {}),
        ...rest,
      },
    });
  }
  return { roads, found: true };
}

const gateSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().optional(),
    polygon_edges: z.array(z.array(z.tuple([num, num])).min(2)).default([]),
  })
  .passthrough();

/** The exclusive zones ("gates") of `ez.json`: each is the outline its `polygon_edges` make. Everything else of a gate stays on it as it came. */
export function readGates(ez: unknown): ImportedGate[] {
  const gates = asRecord(asRecord(ez).ez_gates);
  const out: ImportedGate[] = [];
  for (const [key, value] of Object.entries(gates)) {
    const g = gateSchema.safeParse(value);
    if (!g.success) continue;
    const pts: [number, number][] = [];
    for (const e of g.data.polygon_edges)
      for (const p of e) if (!pts.some((q) => q[0] === p[0] && q[1] === p[1])) pts.push([p[0], p[1]]);
    if (pts.length < 3) continue;
    const { id, name, ...rest } = g.data;
    out.push({ externalId: String(id ?? key), name: name?.trim() || `Gate ${key}`, polygon: pts, extra: rest });
  }
  return out;
}
