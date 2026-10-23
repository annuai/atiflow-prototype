import type { NavNode } from '@/core/types';
import { accessNodes, ensureNode, nearestRoad, routable } from '../connect';
import type { MapData, MapStation } from '../types';
import { roleOf, SLOTS, type NodeRoles, type Slot, type SlotId, type StationNode, type ThreePointTurn } from './types';

/** A slot that is on and says nothing: the robot's own defaults. */
export const plainSlot = (): Slot => ({ params: {} });
/** Every role on, every slot default: what the Deployment Manager gives a new node. */
export const defaultRoles = (): NodeRoles => ({
  park: { pick: plainSlot(), drop: plainSlot() },
  unpark: { laden: plainSlot(), unladen: plainSlot() },
});

/** The nodes of a station as stored, or the one automatic node every station always has. */
export const stationNodes = (s: MapStation): StationNode[] =>
  s.nodes?.length ? s.nodes : [{ id: 'n1', roles: defaultRoles() }];

export interface ResolvedNode {
  index: number;
  node: StationNode;
  /** where it is on the network (null: no lane is in reach yet) */
  at: NavNode | null;
  /** worked out from the nearest lane, not pinned by a person */
  auto: boolean;
}
/**
 * The nodes of a station with their places on the road network. A pinned node is where it was pinned; an automatic one takes the nearest route node the station is joined to (on the fly, so it
 * follows the road). A station always has at least one node.
 */
export function resolveNodes(data: MapData, s: MapStation): ResolvedNode[] {
  const net = routable(data);
  const claimed = new Set(stationNodes(s).flatMap((n) => (n.at ? [n.at] : [])));
  const free = accessNodes(data, s.id).filter((n) => !claimed.has(n.id));
  return stationNodes(s).map((node, index) => ({
    index,
    node,
    auto: !node.at,
    at: node.at ? (net.nodes.find((n) => n.id === node.at) ?? null) : (free.shift() ?? null),
  }));
}

const patchStation = (data: MapData, id: string, fn: (s: MapStation) => MapStation): MapData => ({
  ...data,
  stations: data.stations.map((s) => (s.id === id ? fn(s) : s)),
});
/** A person's first change to an automatic node pins nothing by itself: the node stays automatic and only its roles are stored. */
const withNodes = (data: MapData, id: string, fn: (nodes: StationNode[]) => StationNode[]): MapData =>
  patchStation(data, id, (s) => ({ ...s, nodes: fn(stationNodes(s)) }));

/** Switch a slot on or off (an off slot is absent). A node that has every slot off is allowed: it is simply not used. */
export function setSlotOn(data: MapData, id: string, index: number, slot: SlotId, on: boolean): MapData {
  return withNodes(data, id, (nodes) =>
    nodes.map((n, i) => {
      if (i !== index) return n;
      const role = roleOf(slot);
      const roles = { ...n.roles, [role]: { ...n.roles[role] } } as NodeRoles;
      const group = roles[role] as Record<string, Slot | undefined>;
      if (on) group[slot] = group[slot] ?? plainSlot();
      else delete group[slot];
      if (!Object.keys(group).length) delete roles[role];
      return { ...n, roles };
    }),
  );
}
/** Change what one slot does (maneuver, direction, distances). */
export function updateSlot(data: MapData, id: string, index: number, slot: SlotId, patch: Partial<Slot>): MapData {
  return withNodes(data, id, (nodes) =>
    nodes.map((n, i) => {
      const role = roleOf(slot);
      const group = n.roles[role] as Record<string, Slot | undefined> | undefined;
      const old = group?.[slot];
      if (i !== index || !old) return n;
      return { ...n, roles: { ...n.roles, [role]: { ...group, [slot]: { ...old, ...patch } } } };
    }),
  );
}
/** Switch a whole role (Park or Unpark) on or off. */
export function setRoleOn(data: MapData, id: string, index: number, role: 'park' | 'unpark', on: boolean): MapData {
  return SLOTS[role].reduce((d, slot) => setSlotOn(d, id, index, slot, on), data);
}

/**
 * Pin every node of a station to a real node of the network: an automatic node exists only on the fly (its place is cut into the road for the robot), so pinning cuts the road there for good.
 */
function pinNodes(data: MapData, s: MapStation): { data: MapData; nodes: StationNode[] } {
  let work = data;
  const nodes = resolveNodes(data, s).map((r, i) => {
    if (r.node.at || !r.at) return r.node;
    const made = ensureNode(work, `N-A-${s.id}-${i + 1}`, r.at.x, r.at.y);
    if (!made) return r.node;
    work = made.data;
    return { ...r.node, at: made.node.id };
  });
  return { data: work, nodes };
}

/**
 * Give a station another way in: a node on the road nearest to `at` (the road is cut there when needed). The nodes the station had are pinned first, so the new one is an alternative, not a
 * replacement. Null when no road is within reach, or the station already comes in there.
 */
export function addNodeAt(data: MapData, stationId: string, at: { x: number; y: number }): MapData | null {
  const s = data.stations.find((q) => q.id === stationId);
  const hit = s && nearestRoad(data, at.x, at.y);
  if (!s || !hit) return null;
  const pinned = pinNodes(data, s);
  const made = ensureNode(pinned.data, `N-A-${stationId}-${pinned.nodes.length + 1}`, hit.at[0], hit.at[1]);
  if (!made || pinned.nodes.some((n) => n.at === made.node.id)) return null;
  const next = [...pinned.nodes, { id: `n${pinned.nodes.length + 1}`, at: made.node.id, roles: defaultRoles() }];
  return patchStation(made.data, stationId, (q) => ({ ...q, nodes: next }));
}
/** Take a node away (never the last one: a station always has one). */
export function removeNode(data: MapData, stationId: string, index: number): MapData {
  const s = data.stations.find((q) => q.id === stationId);
  if (!s || stationNodes(s).length <= 1) return data;
  const pinned = pinNodes(data, s);
  return patchStation(pinned.data, stationId, (q) => ({
    ...q,
    nodes: pinned.nodes.filter((_, i) => i !== index).map((n, i) => ({ ...n, id: `n${i + 1}` })),
  }));
}
/** What is on for one node: the slots that are switched on (an unused node is flagged in the panel). */
export const slotsOn = (n: StationNode): SlotId[] =>
  (['pick', 'drop', 'laden', 'unladen'] as SlotId[]).filter((id) => {
    const role = roleOf(id);
    return !!(n.roles[role] as Record<string, Slot | undefined> | undefined)?.[id];
  });
export const slotOf = (n: StationNode, id: SlotId): Slot | undefined =>
  (n.roles[roleOf(id)] as Record<string, Slot | undefined> | undefined)?.[id];
/** Change some distances of a slot and keep the others. */
export function setParams(
  data: MapData,
  id: string,
  index: number,
  slot: SlotId,
  params: Record<string, number>,
): MapData {
  const s = data.stations.find((q) => q.id === id);
  const old = s && slotOf(stationNodes(s)[index] ?? { id: '', roles: {} }, slot);
  return old ? updateSlot(data, id, index, slot, { params: { ...old.params, ...params } }) : data;
}
/** Change the size or the way of a station's three-point turn (nothing when the station does not ask for one). */
export function setThreePointTurn(data: MapData, id: string, patch: Partial<ThreePointTurn>): MapData {
  return patchStation(data, id, (s) => {
    const turn = s.features?.threePointTurn;
    return turn ? { ...s, features: { ...s.features, threePointTurn: { ...turn, ...patch } } } : s;
  });
}
