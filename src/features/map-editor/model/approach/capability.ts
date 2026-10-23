import { robotTypeByLabel } from '@/data/robotTypes';
import { DEFAULT_MANEUVER } from './maneuvers';
import type { ManeuverId, Slot } from './types';

/**
 * What a robot type does with a station's choice. A station asks for a maneuver; a robot that cannot drive it turns on the spot instead (the in-place turn every robot can do), and the
 * preview and the simulation say so. `robot` is the type's label, as stored in a robot's Sherpa Type.
 */
export function maneuverFor(slot: Slot, robot?: string): { maneuver: ManeuverId; fellBack: boolean } {
  if (!robot) return { maneuver: slot.maneuver ?? DEFAULT_MANEUVER, fellBack: false };
  const caps = robotTypeByLabel(robot).capabilities;
  const wanted = (slot.maneuver ?? caps.defaultManeuver) as ManeuverId;
  const can = caps.maneuvers;
  return can.includes(wanted) ? { maneuver: wanted, fellBack: false } : { maneuver: 'inplace', fellBack: true };
}
