import { useMemo } from 'react';
import { codesForFleet } from './logic';
import { masterDataStore, useMasterData } from './store';
import type { FleetId } from '@/data/fleets';

/** Material codes assigned to a fleet, read once (stores, parsers). */
export const fleetMaterialCodes = (fleet: FleetId) => codesForFleet(masterDataStore.getState().materials, fleet);

/** Same, as a hook: re-renders when the master data changes (Workflow Builder dropdowns). */
export function useFleetMaterialCodes(fleet: FleetId): string[] {
  const materials = useMasterData((s) => s.materials);
  return useMemo(() => codesForFleet(materials, fleet), [materials, fleet]);
}
