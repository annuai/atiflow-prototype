/**
 * How a robot enters and leaves an off-lane station (Deployment Manager v5 "nodes"). A station has one or more nodes; each node sits on a lane and can be used to PARK (arrive: Pick or Drop)
 * and to UNPARK (leave: Laden or Unladen). A role that is switched off is simply absent, the way the file stores it.
 */
export const MANEUVERS = [
  'one_shot_turn',
  'inplace',
  'lanechange',
  'reverse_lanechange',
  'three_point_turn',
  'three_point_lanechange',
] as const;
export type ManeuverId = (typeof MANEUVERS)[number];
export type Role = 'park' | 'unpark';
export type SlotId = 'pick' | 'drop' | 'laden' | 'unladen';
/** The slots of each role, in the order the Deployment Manager lists them. */
export const SLOTS: Record<Role, SlotId[]> = { park: ['pick', 'drop'], unpark: ['laden', 'unladen'] };
export const roleOf = (slot: SlotId): Role => (slot === 'pick' || slot === 'drop' ? 'park' : 'unpark');

/** One way of arriving or leaving. No maneuver = the robot's own default (one_shot_turn unless its config says otherwise). `params` are metres; any key the file has is kept. */
export interface Slot {
  maneuver?: ManeuverId;
  direction?: 'forward' | 'reverse';
  params: Record<string, number>;
  /** fields of the file we do not know, kept so nothing is lost on export */
  extra?: Record<string, unknown>;
}
export interface NodeRoles {
  park?: { pick?: Slot; drop?: Slot };
  unpark?: { laden?: Slot; unladen?: Slot };
}
/**
 * A node of a station. `at` = the id of the network node it is pinned to; without it the node is AUTOMATIC: it is worked out from the nearest lane every time, so it follows the road when the
 * road is moved, until the person changes it.
 */
export interface StationNode {
  id: string;
  at?: string;
  roles: NodeRoles;
  /** the place of this node in the station's list in the file it came from (so an export updates that node, and drops the ones that were taken away) */
  file?: number;
}

/** Robot-specific things a station can ask for. Which robots can do them is robot configuration (see `data/robotTypes.ts`). */
export interface ThreePointTurn {
  startDirection: 'left' | 'right';
  startAction: 'forward' | 'reverse';
  /** the box the turn must finish in (m) */
  aisleWidth: number;
  aisleLength: number;
}
export interface StationFeatures {
  threePointTurn?: ThreePointTurn;
}
