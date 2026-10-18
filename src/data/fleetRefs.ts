import { asFleetId, type FleetId, type FleetRecord } from './fleets';

/**
 * Saved data from before fleets were pointed at by id holds fleet NAMES ("Line Side Fleet"). `fleetIdIn` turns whatever a saved record holds (an id, or an old name, ignoring case)
 * into the fleet's id; a value that is neither stays as it is (a fleet that no longer exists). Pure: stores call it (through `fleetRef`) when they read saved data, so old saves keep
 * working and nothing else needs to know.
 */
export function fleetIdIn(fleets: readonly FleetRecord[], value: string): FleetId {
  const v = value.trim().toLowerCase();
  const hit = fleets.find((f) => f.id === value) ?? fleets.find((f) => f.name.toLowerCase() === v);
  return asFleetId(hit?.id ?? value);
}
