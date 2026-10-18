import type { FleetId } from '@/data/fleets';
export type { FleetMap, MapStation } from '@/features/maps';

/** Materials stocked at one station of the fleet's map. One group per station. */
export interface StationGroup {
  id: string;
  stationId: string;
  name: string;
  codes: string[];
}
/** The fleet profiles, by fleet id. */
export type FleetProfiles = Record<FleetId, FleetProfile>;
/** Everything the fleet page stores about a fleet itself (robots, hardware and materials live in their own features). */
export interface FleetProfile {
  mapId: string | null;
  groups: StationGroup[];
}
