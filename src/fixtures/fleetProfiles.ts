import type { FleetProfile } from '@/features/fleets/model/types';
import { FLEET_ID } from '@/data/fleets';

/** Starting profile per fleet name. Fleets created later start with no map and no groups. */
export const SEED_PROFILES: Record<string, FleetProfile> = {
  [FLEET_ID.lineSide]: {
    mapId: 'main-assembly',
    groups: [
      { id: 'ST-01', stationId: 'ST-01', name: 'Engine Bay Line 2', codes: ['DCP-1001', 'DCP-1002'] },
      { id: 'ST-02', stationId: 'ST-02', name: 'Kitting Area', codes: ['DCP-1003'] },
    ],
  },
  [FLEET_ID.assembly]: {
    mapId: 'assembly-east',
    groups: [
      { id: 'ST-01', stationId: 'ST-01', name: 'Line A Feeder', codes: ['DCP-1005'] },
      { id: 'ST-02', stationId: 'ST-02', name: 'Sub-Assembly Cell', codes: ['DCP-1006'] },
    ],
  },
};
