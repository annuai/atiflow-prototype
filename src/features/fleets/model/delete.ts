import { datasetStore } from '@/data/dataset';
import type { FleetId } from '@/data/fleets';
import { userDirectory } from '@/features/auth';
import { bookingsStore } from '@/features/bookings';
import { masterDataStore } from '@/features/master-data';
import { isActive, requestsStore } from '@/features/requests';
import { isKept, wfStore, workflowsOfFleet } from '@/features/workflow-builder';
import { fleetsStore } from './store';

/** What deleting a fleet touches, for the confirmation. `openTrips` (requests and booked trips that are not finished) blocks the deletion. */
export interface FleetImpact {
  robots: number;
  hardware: number;
  materials: number;
  workflows: number;
  users: number;
  openTrips: number;
}
export function fleetImpact(fleet: FleetId): FleetImpact {
  const data = datasetStore.getState();
  const mine = (list: typeof data.robot) => list.filter((d) => d.values.fleet === fleet).length;
  return {
    robots: mine(data.robot),
    hardware: mine(data.hardware),
    materials: masterDataStore.getState().materials.filter((m) => m.fleets.includes(fleet)).length,
    workflows: workflowsOfFleet(wfStore.getState().workflows, fleet).filter(isKept).length,
    users: userDirectory.getState().users.filter((u) => u.fleets?.includes(fleet)).length,
    openTrips:
      requestsStore.getState().requests.filter((r) => r.fleet === fleet && isActive(r.status)).length +
      bookingsStore.getState().trips.filter((t) => t.fleet === fleet && isActive(t.status)).length,
  };
}

/**
 * Delete a fleet and everything that belongs to it: its workflows go, its robots / hardware / materials become unassigned, its map assignment and station
 * groups go, and the people who had it among their fleets lose it. The map, the robots and the materials themselves stay. Refused (false) while trips of the fleet are open.
 */
export function deleteFleet(fleet: FleetId): boolean {
  if (fleetImpact(fleet).openTrips > 0) return false;
  wfStore.getState().removeFleet(fleet);
  masterDataStore.getState().removeFleet(fleet);
  fleetsStore.getState().removeProfile(fleet);
  for (const u of userDirectory.getState().users)
    if (u.fleets?.includes(fleet))
      userDirectory.getState().update(u.username, { fleets: u.fleets.filter((f) => f !== fleet) });
  datasetStore.getState().removeFleet(fleet);
  return true;
}
