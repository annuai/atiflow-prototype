import type { FleetId } from '@/data/fleets';
import { fleetAreas, isAreaId, masterDataStore, type CellPlan } from '@/features/master-data';

/**
 * Staging-area cells and requests. A Station step may name a staging area (SA-001): a Pick Up there takes the material out of the area's cells in the area's FIFO / LIFO order, a Drop Off there
 * reserves a free cell for what arrives. Taking and reserving happen when the request is made (so two requests can never count on the same material or the same cell); when the trip ends the cells
 * are settled: delivered -> the reserved cell is filled (and its FIFO / LIFO clock starts), cancelled / rejected / failed -> the pieces go back and the cell is free again.
 */
export type CellsReserved = { plan?: CellPlan; failed?: string };

/** The leg of a workflow that is a staging area, for the given action (Drop Off: the last such leg). */
const areaLeg = (legs: string[], actions: string[] | undefined, action: 'Pick Up' | 'Drop Off', last = false) => {
  const hits = legs.map((id, i) => ({ id, i })).filter(({ id, i }) => isAreaId(id) && (actions?.[i] ?? '') === action);
  return (last ? hits[hits.length - 1] : hits[0])?.id;
};
export const usesAreas = (legs: string[]) => legs.some(isAreaId);

/** Reserve what a request needs in its staging areas. `failed` says why it cannot be done (nothing is changed then). */
export function reserveCells(r: {
  fleet: FleetId;
  code: string;
  qty: number;
  legs: string[];
  legActions?: string[];
  tripId: string;
  kind?: string;
}): CellsReserved {
  if (r.kind === 'route' || !usesAreas(r.legs)) return {};
  const areas = fleetAreas(r.fleet);
  const find = (id: string | undefined) => (id ? areas.find((a) => a.id === id) : undefined);
  const pickId = areaLeg(r.legs, r.legActions, 'Pick Up'),
    dropId = areaLeg(r.legs, r.legActions, 'Drop Off', true);
  const pick = find(pickId),
    drop = find(dropId);
  for (const [id, a] of [
    [pickId, pick],
    [dropId, drop],
  ] as const)
    if (id && (!a || !a.stationId))
      return { failed: `${id} is not available on this fleet's map (it needs an entry station)` };
  if (!pick && !drop) return {};
  const res = masterDataStore.getState().reserveForTrip({
    tripId: r.tripId,
    ...(pick ? { pick: { area: pick, code: r.code, qty: r.qty } } : {}),
    ...(drop ? { drop: { area: drop, code: r.code, qty: r.qty } } : {}),
  });
  if (res.ok) return { plan: res.plan };
  const x = res.reason;
  return {
    failed:
      x.kind === 'full'
        ? `${x.areaName} (${x.areaId}) is full: there is no free cell for ${x.code}`
        : `${x.areaName} (${x.areaId}) holds ${x.have} of the ${r.qty} pieces of ${x.code} that were asked for`,
  };
}

/** The trip is over: give the cells back or commit them. Returns the plan marked as settled (or the same plan when there is nothing to do). */
export function settleCells(
  r: { fleet: FleetId; tripId: string; cells?: CellPlan },
  how: 'committed' | 'released',
): CellPlan | undefined {
  if (!r.cells || r.cells.settled) return r.cells;
  const areas = fleetAreas(r.fleet);
  return masterDataStore.getState().settleTrip(r.cells, r.tripId, how, (id) => areas.find((a) => a.id === id));
}

/** Where a robot goes for a leg: a staging area is reached through its entry station. Consecutive legs that become the same station are one stop. */
export function entryLegs(r: { fleet: FleetId; legs: string[]; loadFrom: number }): {
  legs: string[];
  loadFrom: number;
} {
  const areas = fleetAreas(r.fleet);
  const legs: string[] = [];
  let loadFrom = r.loadFrom;
  r.legs.forEach((id, i) => {
    const st = isAreaId(id) ? (areas.find((a) => a.id === id)?.stationId ?? id) : id;
    if (legs[legs.length - 1] === st) {
      if (i < r.loadFrom) loadFrom--; // the stop it merged into came first
      return;
    }
    legs.push(st);
  });
  return { legs, loadFrom: Math.min(loadFrom, Math.max(0, legs.length - 1)) };
}
