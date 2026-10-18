import { datasetStore } from '@/data/dataset';
import type { FleetId } from '@/data/fleets';
import { fleetNameError } from '@/features/workflow-builder';

/**
 * Rename a fleet. Robots, hardware, workflows, materials, requests and the fleet's profile all point at its ID, so only the fleet list changes (workflow names are edited by hand and
 * stay). Returns an error text, or '' when renamed.
 */
export function renameFleet(fleet: FleetId, to: string): string {
  const name = to.trim();
  const fleets = datasetStore.getState().fleets;
  const current = fleets.find((f) => f.id === fleet)?.name;
  const error = fleetNameError(
    name,
    fleets.map((f) => f.name),
    current,
  );
  if (error) return error;
  if (name !== current) datasetStore.getState().renameFleet(fleet, name);
  return '';
}
