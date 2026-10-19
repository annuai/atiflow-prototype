import type { NavNode } from '@/core/types';
import { addRoad, splitRoad } from './roads';
import type { MapData, MapRoad, MapStation } from './types';

/**
 * Joining stations to the road network (pure). A robot drives a station by its node, so a station whose node touches no lane can never be reached. In the Deployment Manager a route is a line
 * made of nodes ("dots") and a station is always joined to a node of it by a short connector; that is what is done here:
 *  - the nodes of the source (`ensureNode`) are put on the roads (a road is cut where a node lies on it);
 *  - a station is joined to the nodes the source names for it, else to the nearest node of any route, by a short two-way access road;
 *  - only where no node is near (a map with nodes at the road ends only) is the road cut at the station's nearest point and joined there.
 */
const ON_ROAD = 0.15,
  SAME = 0.02, // a source node and the end of a road are the same point (road points are rounded to 0.01 m); nodes a few decimetres apart are two nodes
  ON_STATION = 0.3,
  NODE_SLACK = 2,
  REACH = 30;
type P = [number, number];

/** The station's node is the end of at least one lane. */
export const isConnected = (data: MapData, s: MapStation): boolean =>
  data.lanes.some((l) => l.from === s.nodeId || l.to === s.nodeId);

/** Nearest point of a road's centre line to (x, y): its distance, the point, and the index of the line segment it lies on. */
function nearestOnRoad(r: MapRoad, x: number, y: number) {
  let best = { d: Infinity, at: [0, 0] as P, seg: 0 };
  for (let i = 1; i < r.points.length; i++) {
    const [ax, ay] = r.points[i - 1],
      [bx, by] = r.points[i];
    const dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    const q: P = [ax + t * dx, ay + t * dy];
    const d = Math.hypot(x - q[0], y - q[1]);
    if (d < best.d) best = { d, at: q, seg: i - 1 };
  }
  return best;
}
const nearestRoad = (data: MapData, x: number, y: number) =>
  data.roads.map((road) => ({ road, ...nearestOnRoad(road, x, y) })).sort((a, b) => a.d - b.d)[0];

/** Nodes that belong to the road network (a lane starts or ends there) and are not stations. */
const routeNodes = (data: MapData): NavNode[] => {
  const used = new Set(data.lanes.flatMap((l) => [l.from, l.to]));
  const stations = new Set(data.stations.map((s) => s.nodeId));
  return data.nodes.filter((n) => used.has(n.id) && !stations.has(n.id));
};

/**
 * The node of the network at (x, y): an existing one within 0.3 m, else the road that passes through the point is cut there and the new node is called `id`. Null when no road passes through it
 * (the source has a node that lies on no line).
 */
export function ensureNode(data: MapData, id: string, x: number, y: number): { data: MapData; node: NavNode } | null {
  const near = routeNodes(data).find((n) => Math.hypot(n.x - x, n.y - y) <= SAME);
  if (near) return { data, node: near };
  const hit = nearestRoad(data, x, y);
  if (!hit || hit.d > ON_ROAD) return null;
  const node: NavNode = { id, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, kind: 'waypoint' };
  const cut = splitRoad({ ...data, nodes: [...data.nodes, node] }, hit.road.id, hit.seg, node);
  return cut ? { data: cut, node } : null;
}

/** A short two-way access road from a network node to the station's node (nothing when they are already joined or the same). */
function join(data: MapData, s: MapStation, station: NavNode, to: NavNode, fleetLive: string): MapData {
  if (to.id === station.id) return data;
  if (Math.hypot(to.x - station.x, to.y - station.y) < 0.3) {
    // the station stands on the node: it uses that node itself (no room for an access road)
    return {
      ...data,
      nodes: data.nodes.filter((q) => q.id !== station.id),
      stations: data.stations.map((q) => (q.id === s.id ? { ...q, nodeId: to.id } : q)),
    };
  }
  if (data.lanes.some((l) => (l.from === to.id && l.to === station.id) || (l.from === station.id && l.to === to.id)))
    return data;
  const r = addRoad(
    data,
    [
      [to.x, to.y],
      [station.x, station.y],
    ],
    {
      fleetLive,
      nodeA: to.id,
      nodeB: station.id,
      name: `${s.name} access`,
      snap: 0,
      allowShort: true,
      extra: { access: s.id },
    },
  );
  if (!r.id) return data;
  // access lanes carry their own prefix: they are made on the fly and must never share an id with a drawn lane
  const made = new Set(r.data.roads.find((q) => q.id === r.id)?.laneIds ?? []);
  const rename = (id: string) => (made.has(id) ? `A-${id}` : id);
  return {
    ...r.data,
    lanes: r.data.lanes.map((l) => (made.has(l.id) ? { ...l, id: rename(l.id) } : l)),
    roads: r.data.roads.map((q) => (q.id === r.id ? { ...q, laneIds: q.laneIds.map(rename) } : q)),
  };
}

/**
 * Connect one station. `targets` = ids of the network nodes the source names for it (each is joined). Without them the station joins the nearest node of any route, unless the road passes
 * clearly closer than that node, in which case the road is cut at the station's nearest point and joined there (a station standing on the road becomes that cut itself). Unchanged when the
 * station is already connected or nothing is within reach.
 */
export function connectStation(data: MapData, stationId: string, fleetLive: string, targets: string[] = []): MapData {
  const s = data.stations.find((q) => q.id === stationId);
  const n = s && data.nodes.find((q) => q.id === s.nodeId);
  if (!s || !n || isConnected(data, s)) return data;
  const named = targets.map((t) => data.nodes.find((q) => q.id === t)).filter((q): q is NavNode => !!q);
  if (named.length) return named.reduce((d, t) => join(d, s, n, t, fleetLive), data);
  const node = routeNodes(data)
    .map((q) => ({ q, d: Math.hypot(q.x - n.x, q.y - n.y) }))
    .sort((a, b) => a.d - b.d)[0];
  const road = data.roads.length ? nearestRoad(data, n.x, n.y) : undefined;
  if (node && node.d <= REACH && (!road || node.d <= road.d + NODE_SLACK)) return join(data, s, n, node.q, fleetLive);
  if (!road || road.d > REACH) return data;
  // stand on the road: the station's own node is the cut; otherwise a new node at the nearest point
  const cutAt: NavNode =
    road.d <= ON_STATION
      ? n
      : {
          id: `N-J-${s.id}`,
          x: Math.round(road.at[0] * 100) / 100,
          y: Math.round(road.at[1] * 100) / 100,
          kind: 'waypoint',
        };
  const withNode = cutAt === n ? data : { ...data, nodes: [...data.nodes, cutAt] };
  const cut = splitRoad(withNode, road.road.id, road.seg, cutAt);
  return cut ? join(cut, s, n, cutAt, fleetLive) : data;
}

/** Connect every station that is not connected yet. `targetsOf(station)` = the network node ids the source names for it. */
export function connectStations(
  data: MapData,
  fleetLive: string,
  targetsOf: (s: MapStation) => string[] = () => [],
): MapData {
  return data.stations.reduce((d, s) => connectStation(d, s.id, fleetLive, targetsOf(s)), data);
}

/**
 * The map as robots drive it: every station that is off the route gets its own way onto it (an access road to the route node the source names, else the nearest one), made on the fly and never
 * saved, so it follows the station when it is moved or added and a trip never needs connecting by hand. What is edited and published stays as drawn.
 */
export const routable = (data: MapData): MapData =>
  !data.p2p && // a point-to-point map has no free access roads: a station off its routes stays unconnected until a route is drawn to it
  data.stations.some((s) => !isConnected(data, s))
    ? connectStations(data, data.lanes[0]?.fleets[0] ?? '', (s) => s.routeNodes ?? [])
    : data;

/** The route nodes a station is joined to as robots drive it: the ones the source names, else (a station made here) the nodes its on-the-fly access reaches. */
export function accessNodes(data: MapData, stationId: string): NavNode[] {
  const s = data.stations.find((q) => q.id === stationId);
  if (!s) return [];
  const net = routable(data);
  const own = net.stations.find((q) => q.id === stationId);
  const at = own?.nodeId ?? s.nodeId;
  const named = (s.routeNodes ?? []).flatMap((id) => net.nodes.find((n) => n.id === id) ?? []);
  if (named.length) return named;
  const ends = new Set(net.lanes.filter((l) => l.from === at || l.to === at).flatMap((l) => [l.from, l.to]));
  ends.delete(at);
  return [...ends].flatMap((id) => net.nodes.find((n) => n.id === id) ?? []);
}
