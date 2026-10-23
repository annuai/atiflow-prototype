import {
  MANEUVERS,
  SLOTS,
  type ManeuverId,
  type NodeRoles,
  type Role,
  type Slot,
  type StationNode,
  type ThreePointTurn,
} from './types';

/**
 * Reading what a Deployment Manager station file says about a node (plain JSON, as `gmaj.json` / `grid_map_attributes.json` hold it). A role that is missing or empty is OFF. Anything we
 * have no field for stays in `extra` so it goes back unchanged.
 */
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function slotFrom(v: unknown): Slot | undefined {
  if (!isObj(v)) return undefined;
  const { maneuver, maneuver_direction, params, ...rest } = v;
  const nums: Record<string, number> = {};
  const other: Record<string, unknown> = {};
  if (isObj(params))
    for (const [k, x] of Object.entries(params)) (typeof x === 'number' && Number.isFinite(x) ? nums : other)[k] = x;
  const extra = { ...rest, ...(Object.keys(other).length ? { params: other } : {}) };
  return {
    ...(MANEUVERS.includes(maneuver as ManeuverId) ? { maneuver: maneuver as ManeuverId } : {}),
    ...(maneuver_direction === 'forward' || maneuver_direction === 'reverse' ? { direction: maneuver_direction } : {}),
    params: nums,
    ...(Object.keys(extra).length ? { extra } : {}),
  };
}
export function rolesFromFile(node: unknown): NodeRoles {
  const out: NodeRoles = {};
  if (!isObj(node)) return out;
  for (const role of ['park', 'unpark'] as Role[]) {
    const block = node[role];
    if (!isObj(block)) continue;
    const slots: Record<string, Slot> = {};
    for (const id of SLOTS[role]) {
      const s = slotFrom(block[id]);
      if (s) slots[id] = s;
    }
    if (Object.keys(slots).length) (out as Record<string, unknown>)[role] = slots;
  }
  return out;
}
/** The nodes of a station entry of the file, in the file's order. */
export function nodesFromFile(entry: unknown): StationNode[] {
  const list = isObj(entry) && Array.isArray(entry.nodes) ? entry.nodes : [];
  return list.map((n, i) => ({ id: `n${i + 1}`, roles: rolesFromFile(n), file: i }));
}

/** `three_point_turn` of a station entry: on only when `enable` is true. */
export function threePointTurnFrom(entry: unknown): ThreePointTurn | undefined {
  const t = isObj(entry) ? entry.three_point_turn : undefined;
  if (!isObj(t) || t.enable !== true) return undefined;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    startDirection: t.start_direction === 'right' ? 'right' : 'left',
    startAction: t.start_action === 'reverse' ? 'reverse' : 'forward',
    aisleWidth: n(t.aisle_width),
    aisleLength: n(t.aisle_length),
  };
}
