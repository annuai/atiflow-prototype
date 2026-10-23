import { maneuverOf, PARAMS, type ParamKey } from './maneuvers';
import type { Slot } from './types';

/** The value of a distance: what the slot says, else the default of the maneuver (docs: inlane 2 m, perpendicular 1 m, extensions 1 m). */
export const paramValue = (slot: Slot, key: ParamKey): number => slot.params[key] ?? PARAMS[key].default;

/**
 * "Approach from": the Deployment Manager flips the approach to the back of the station with NEGATIVE distances. People think in front / behind, so the screens say that and this maps to the
 * sign. Behind = the distances along the lane and across it both point the other way.
 */
export type Approach = 'front' | 'behind';
export function approachOf(slot: Slot): Approach {
  const m = maneuverOf(slot.maneuver);
  const keys = m.params.filter((k) => k === 'inlane_dist' || k === 'perpendicular_dist');
  return keys.length && keys.every((k) => paramValue(slot, k) < 0) ? 'behind' : 'front';
}
/** The distances of the slot for an approach from the front or from behind (other distances are kept). */
export function withApproach(slot: Slot, from: Approach): Record<string, number> {
  const out = { ...slot.params };
  for (const k of ['inlane_dist', 'perpendicular_dist'] as const) {
    if (!maneuverOf(slot.maneuver).params.includes(k)) continue;
    const v = Math.abs(paramValue(slot, k)) || PARAMS[k].default;
    out[k] = from === 'behind' ? -v : v;
  }
  return out;
}
/** Only the keys the maneuver reads, plus any other number the file already holds (kept, never dropped). */
export function shownParams(slot: Slot): string[] {
  const own = maneuverOf(slot.maneuver).params as string[];
  return [...own, ...Object.keys(slot.params).filter((k) => !own.includes(k))];
}
