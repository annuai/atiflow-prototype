import { datasetStore } from '@/data/dataset';
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
export function fleetImpact(name: string): FleetImpact {
  const data = datasetStore.getState();
  const id = data.fleets.find((f) => f.name === name)?.id;
  const mine = (list: typeof data.robot) => list.filter((d) => d.values.fleet === name).length;
  return {
    robots: mine(data.robot),
    hardware: mine(data.hardware),
    materials: masterDataStore.getState().materials.filter((m) => m.fleets.includes(name)).length,
    workflows: workflowsOfFleet(wfStore.getState().workflows, name).filter(isKept).length,
    users: id ? userDirectory.getState().users.filter((u) => u.fleets?.includes(id)).length : 0,
    openTrips:
      requestsStore.getState().requests.filter((r) => r.fleet === name && isActive(r.status)).length +
      bookingsStore.getState().trips.filter((t) => t.fleet === name && isActive(t.status)).length,
  };
}

/**
 * Delete a fleet and everything that belongs to it: its workflows go, its robots / hardware / materials become unassigned, its map assignment and station
 * groups go, and the people who had it among their fleets lose it. The map, the robots and the materials themselves stay. Refused (false) while trips of the fleet are open.
 */
export function deleteFleet(name: string): boolean {
  if (fleetImpact(name).openTrips > 0) return false;
  const id = datasetStore.getState().fleets.find((f) => f.name === name)?.id;
  wfStore.getState().removeFleet(name);
  masterDataStore.getState().removeFleet(name);
  fleetsStore.getState().removeProfile(name);
  if (id)
    for (const u of userDirectory.getState().users)
      if (u.fleets?.includes(id))
        userDirectory.getState().update(u.username, { fleets: u.fleets.filter((f) => f !== id) });
  datasetStore.getState().removeFleet(name); // last: the fleet's name is what the steps above look it up by
  return true;
}
