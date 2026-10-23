import type { ManeuverId } from './types';

/** The distances a maneuver reads (metres, a negative value means "behind", see `approachFrom`). */
export type ParamKey = 'inlane_dist' | 'perpendicular_dist' | 'inlane_extension' | 'perpendicular_extension';
export interface ParamDef {
  key: ParamKey;
  default: number;
}
export const PARAMS: Record<ParamKey, ParamDef> = {
  inlane_dist: { key: 'inlane_dist', default: 2 },
  perpendicular_dist: { key: 'perpendicular_dist', default: 1 },
  inlane_extension: { key: 'inlane_extension', default: 1 },
  perpendicular_extension: { key: 'perpendicular_extension', default: 1 },
};
export const RANGE = { min: -20, max: 20 };

/** What each maneuver reads. A new maneuver = one entry here, its path in `geometry.ts` and its words in the `approach` catalog. */
export interface ManeuverDef {
  id: ManeuverId;
  /** the distances it uses, in the order they are shown */
  params: ParamKey[];
}
export const MANEUVER_DEFS: Record<ManeuverId, ManeuverDef> = {
  one_shot_turn: { id: 'one_shot_turn', params: ['inlane_dist', 'perpendicular_dist'] },
  inplace: { id: 'inplace', params: ['perpendicular_dist'] },
  lanechange: { id: 'lanechange', params: ['inlane_dist', 'perpendicular_dist'] },
  reverse_lanechange: { id: 'reverse_lanechange', params: ['inlane_dist', 'perpendicular_dist'] },
  three_point_turn: {
    id: 'three_point_turn',
    params: ['inlane_dist', 'perpendicular_dist', 'inlane_extension', 'perpendicular_extension'],
  },
  three_point_lanechange: {
    id: 'three_point_lanechange',
    params: ['inlane_dist', 'perpendicular_dist', 'inlane_extension', 'perpendicular_extension'],
  },
};
/** What the robot does when a slot names no maneuver (`[control.dynamic_router] default_parking_maneuver`). */
export const DEFAULT_MANEUVER: ManeuverId = 'one_shot_turn';
export const maneuverOf = (m: ManeuverId | undefined): ManeuverDef => MANEUVER_DEFS[m ?? DEFAULT_MANEUVER];
