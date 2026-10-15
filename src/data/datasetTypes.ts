import type { FleetRecord } from './fleets';

/** One stored robot / hardware record: `values` is keyed by field (`values.name` is the unique name, `values.fleet` the fleet, '' = unassigned). */
export interface DatasetDevice {
  status: 'online' | 'offline';
  values: Record<string, string | string[]>;
}
/** What the shared dataset holds (and what is saved): fleets, robots and hardware. */
export interface DatasetData {
  version: 1;
  fleets: FleetRecord[];
  robot: DatasetDevice[];
  hardware: DatasetDevice[];
}
