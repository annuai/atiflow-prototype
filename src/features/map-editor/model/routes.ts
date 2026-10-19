import { addRoad, updateRoad } from './roads';
import type { MapData, MapRoad, MapStation } from './types';

/**
 * Point-to-point (v2) routes (pure). A v2 map has no free roads: a route joins a start station to an end station, one way, and can be bent with nodes. A node is a point of the route
 * (double-click a route to add one, drag it to bend the route) with its own curve radius: 0 keeps the corner sharp. The route is drawn and driven as straights joined by circular turns.
 * Everything here goes through `addRoad` / `updateRoad`, which rebuild the lanes; a route's two ends are always its stations' nodes.
 */
type P = [number, number];
export const MAX_RADIUS = 3;
const DEFAULT_RADIUS = 1;
const round = (v: number) => Math.round(v * 100) / 100;

const nodeOf = (data: MapData, s: MapStation) => data.nodes.find((n) => n.id === s.nodeId);
const laneOf = (data: MapData, r: MapRoad) => data.lanes.find((l) => l.id === r.laneIds[0]);

/** The start and end station of a route. */
export function routeEnds(data: MapData, road: MapRoad): { from?: MapStation; to?: MapStation } {
  const l = laneOf(data, road);
  return {
    from: l && data.stations.find((s) => s.nodeId === l.from),
    to: l && data.stations.find((s) => s.nodeId === l.to),
  };
}
/** The bend nodes of a route (its points between the two stations). */
export const routeNodes = (road: MapRoad): P[] => road.points.slice(1, -1);
/** The radius at bend node `i` (its own, else the route's). */
export const nodeRadius = (road: MapRoad, i: number): number => road.nodeRadii?.[i] ?? road.radius ?? DEFAULT_RADIUS;

/** A straight route from one station to another (nothing when they are the same, or a route with the same two ends already exists the same way). */
export function addRoute(
  data: MapData,
  fromId: string,
  toId: string,
  fleetLive: string,
): { data: MapData; id: string | null } {
  const a = data.stations.find((s) => s.id === fromId),
    b = data.stations.find((s) => s.id === toId);
  const na = a && nodeOf(data, a),
    nb = b && nodeOf(data, b);
  if (!a || !b || !na || !nb || a.id === b.id) return { data, id: null };
  return addRoad(
    data,
    [
      [na.x, na.y],
      [nb.x, nb.y],
    ],
    {
      fleetLive,
      oneWay: true,
      nodeA: a.nodeId,
      nodeB: b.nodeId,
      name: `${a.name} → ${b.name}`,
      offset: 0,
      radius: DEFAULT_RADIUS,
      snap: 0,
    },
  );
}

/** Change the start and / or end station of a route (its nodes stay where they are). */
export function setRouteEnds(data: MapData, roadId: string, fromId: string, toId: string): MapData {
  const road = data.roads.find((r) => r.id === roadId);
  const a = data.stations.find((s) => s.id === fromId),
    b = data.stations.find((s) => s.id === toId);
  const na = a && nodeOf(data, a),
    nb = b && nodeOf(data, b);
  if (!road || !a || !b || !na || !nb || a.id === b.id) return data;
  const lane = laneOf(data, road);
  const base: MapData = {
    ...data,
    lanes: data.lanes.filter((l) => !road.laneIds.includes(l.id)),
    roads: data.roads.filter((r) => r.id !== roadId),
  };
  const r = addRoad(base, [[na.x, na.y], ...routeNodes(road), [nb.x, nb.y]], {
    fleetLive: lane?.fleets[0] ?? '',
    oneWay: true,
    nodeA: a.nodeId,
    nodeB: b.nodeId,
    name: road.name,
    id: roadId,
    heading: road.heading,
    extra: road.extra,
    offset: 0,
    radius: road.radius ?? DEFAULT_RADIUS,
    nodeRadii: road.nodeRadii,
    snap: 0,
  });
  return r.id
    ? { ...r.data, roads: [...r.data.roads].sort((x, y) => x.id.localeCompare(y.id, undefined, { numeric: true })) }
    : data;
}

/** Where along the route's points a new node at `at` goes: after the point that starts the nearest piece. */
function insertAt(points: P[], at: P): number {
  let best = 0,
    bd = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1],
      [bx, by] = points[i];
    const dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((at[0] - ax) * dx + (at[1] - ay) * dy) / l2)) : 0;
    const d = Math.hypot(at[0] - (ax + t * dx), at[1] - (ay + t * dy));
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best; // the new point becomes points[best]
}

const withNodes = (data: MapData, roadId: string, interior: P[], radii: number[]): MapData => {
  const road = data.roads.find((r) => r.id === roadId);
  if (!road) return data;
  const ends = [road.points[0], road.points[road.points.length - 1]];
  return updateRoad(data, roadId, { points: [ends[0], ...interior, ends[1]], nodeRadii: radii });
};
const radiiOf = (road: MapRoad) => routeNodes(road).map((_, i) => nodeRadius(road, i));

/** Add a bend node where the route was double-clicked; returns its index among the nodes. */
export function addRouteNode(data: MapData, roadId: string, at: P): { data: MapData; index: number } {
  const road = data.roads.find((r) => r.id === roadId);
  if (!road) return { data, index: -1 };
  const k = insertAt(road.points, at); // index in points; nodes are points[1..n-2]
  const index = Math.max(0, Math.min(k - 1, routeNodes(road).length));
  const interior = routeNodes(road);
  const radii = radiiOf(road);
  interior.splice(index, 0, [round(at[0]), round(at[1])]);
  radii.splice(index, 0, road.radius ?? DEFAULT_RADIUS);
  return { data: withNodes(data, roadId, interior, radii), index };
}
export function moveRouteNode(data: MapData, roadId: string, index: number, to: P): MapData {
  const road = data.roads.find((r) => r.id === roadId);
  if (!road || index < 0 || index >= routeNodes(road).length) return data;
  const interior = routeNodes(road);
  interior[index] = [round(to[0]), round(to[1])];
  return withNodes(data, roadId, interior, radiiOf(road));
}
export function deleteRouteNode(data: MapData, roadId: string, index: number): MapData {
  const road = data.roads.find((r) => r.id === roadId);
  if (!road || index < 0 || index >= routeNodes(road).length) return data;
  const interior = routeNodes(road),
    radii = radiiOf(road);
  interior.splice(index, 1);
  radii.splice(index, 1);
  return withNodes(data, roadId, interior, radii);
}
/** The curve radius of one node, kept between 0 (a sharp corner) and `MAX_RADIUS`. */
export function setNodeRadius(data: MapData, roadId: string, index: number, radius: number): MapData {
  const road = data.roads.find((r) => r.id === roadId);
  if (!road || index < 0 || index >= routeNodes(road).length || !Number.isFinite(radius)) return data;
  const radii = radiiOf(road);
  radii[index] = Math.max(0, Math.min(MAX_RADIUS, round(radius)));
  return withNodes(data, roadId, routeNodes(road), radii);
}
/** The same route the other way: from the end station to the start station through the same nodes, as a route of its own. */
export function addReverseRoute(data: MapData, roadId: string): { data: MapData; id: string | null } {
  const road = data.roads.find((r) => r.id === roadId);
  if (!road) return { data, id: null };
  const { from, to } = routeEnds(data, road);
  if (!from || !to) return { data, id: null };
  const na = nodeOf(data, to)!,
    nb = nodeOf(data, from)!;
  return addRoad(data, [[na.x, na.y], ...routeNodes(road).reverse(), [nb.x, nb.y]], {
    fleetLive: laneOf(data, road)?.fleets[0] ?? '',
    oneWay: true,
    nodeA: to.nodeId,
    nodeB: from.nodeId,
    name: `${to.name} → ${from.name}`,
    heading: road.heading,
    offset: 0,
    radius: road.radius ?? DEFAULT_RADIUS,
    nodeRadii: radiiOf(road).reverse(),
    snap: 0,
  });
}
