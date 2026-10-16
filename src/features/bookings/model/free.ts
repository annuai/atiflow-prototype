import type { RobotTelemetry } from '@/core/types';

/** A robot a trip can be given to right now: nothing assigned (parking is nothing), enough battery to take a trip, and not in error, offline, charging or blocked. */
export const isFreeRobot = (r: RobotTelemetry) =>
  (!r.task || r.task.type === 'park') &&
  r.battery >= 25 &&
  !['error', 'offline', 'charging', 'blocked'].includes(r.state);
