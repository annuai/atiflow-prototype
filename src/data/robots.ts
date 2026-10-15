import { useStore } from 'zustand';
import { datasetStore, type DatasetData } from './dataset';
import { robotTypeByLabel, type RobotType } from './robotTypes';
import type { FleetRecord } from './fleets';
import type { DeviceStatus } from '@/features/devices/model/types';

/**
 * The one reading of a robot, derived from the shared dataset. The Robots page, the fleet pages, the Live Floor roster and the Dashboard all go
 * through this, so a robot has the same name, type, fleet and status wherever it is shown. Pure: no React, no Three.
 */
export interface RobotRecord {
  /** The unique name, e.g. AMR-007 (also the id in telemetry). */
  id: string;
  type: RobotType;
  /** The fleet it is assigned to; null = unassigned. */
  fleet: FleetRecord | null;
  status: DeviceStatus;
}

export function robotRecords(d: Pick<DatasetData, 'robot' | 'fleets'>): RobotRecord[] {
  return d.robot.map((r) => ({
    id: String(r.values.name),
    type: robotTypeByLabel(r.values.sherpaType),
    fleet: d.fleets.find((f) => f.name === r.values.fleet) ?? null,
    status: r.status,
  }));
}

/**
 * The robots that run on the Live Floor: assigned to a fleet that has a lane map there (`mapFleetIds`, ids of the map's fleets) and not offline.
 * Everything else (offline, unassigned, a fleet without a map) is in the configurator only.
 */
export function robotsOnFloor(records: RobotRecord[], mapFleetIds: Iterable<string>): RobotRecord[] {
  const maps = new Set(mapFleetIds);
  return records.filter((r) => r.fleet && r.status !== 'offline' && maps.has(r.fleet.liveId ?? r.fleet.id));
}

export const useRobotRecords = (): RobotRecord[] => {
  const robot = useStore(datasetStore, (s) => s.robot),
    fleets = useStore(datasetStore, (s) => s.fleets);
  return robotRecords({ robot, fleets });
};
