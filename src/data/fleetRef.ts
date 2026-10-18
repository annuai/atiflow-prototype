import { services } from '@/services';
import { fleetIdIn } from './fleetRefs';
import type { FleetId } from './fleets';

/** The same against the fleets of the shared dataset as the service holds them now (what the stores that do not own the fleet list use when they read saved data). */
export const fleetRef = (value: string): FleetId => fleetIdIn(services().dataset.read().fleets, value);
export const fleetRefs = (values: readonly string[]): FleetId[] => values.map(fleetRef);
