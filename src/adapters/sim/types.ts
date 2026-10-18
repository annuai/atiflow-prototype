import type { PathPlan } from '../../core/lanes';
import type { RobotState, RobotTelemetry, Vec2 } from '../../core/types';
import type { TripIdSource } from '../../data/tripIds';

export type Circle = { x: number; y: number; r: number };
export type Pose = { x: number; y: number; th: number };
/** One permit request along a route: the traffic zones and intersections it passes through, within `GROUP_GAP` of each other, taken all together or not at all. */
export interface Span {
  id: string;
  exitS: number;
  lanes?: string[];
} // lanes: the lanes the route uses inside the intersection (robots on the same lanes may follow each other through)
export interface Entry {
  s: number;
  exitS: number;
  hold: number;
  zones: Span[];
  xings: Span[];
} // each permit is given back when its own span is left
export interface Bot {
  id: string;
  model: string;
  fleetId: string;
  pos: Vec2;
  theta: number;
  battery: number;
  state: RobotState;
  node: string;
  stationId: string | null;
  plan: PathPlan | null;
  s: number;
  entries: Entry[];
  entryIdx: number;
  holds: Map<string, number>;
  locks: Map<string, number>;
  waitingZone: string | null;
  waitReason: 'traffic' | 'headway' | 'intersection' | null;
  timer: number;
  speed: number;
  v: number;
  blockedUntil: number;
  loaded: boolean;
  nextLoaded: boolean;
  attached: boolean;
  trailer: Pose | null;
  prio: number;
  gateAt: number;
  gateOk: boolean;
  stoppedSince: number;
  rerouteAt: number;
  queued: Entry | null;
  ticket: number;
  ticketFor: Entry | null;
  waitsOn: string[];
  waitSince: number;
  gateBlock: string | null;
  resolvedAt: number;
  odoEmpty: number;
  odoLoaded: number;
  energyKWh: number;
  kWh: number;
  faultUntil: number;
  /** how far the robot believes it is from where it really is (a robot moved by hand and not yet relocalized); null = localized */ lostBy: Vec2 | null;
  /** someone asked for this robot to go to a charger: its next trip is a charge trip */ chargeRequested: boolean;
  /** until this time the robot keeps clear of other robots' BODIES only, not of the way they have reserved ahead (breaks two robots that wait for each other's reservation) */
  ignoreClaims: number;
  /** until the robot has driven this far along its plan it is still inside zones it handed over to break a deadlock (reported as a warning, not counted as a second robot in the zone) */
  handedOver: number;
  trip: Trip | null;
  task: RobotTelemetry['task'];
  payload: RobotTelemetry['payload'];
  dest: string | null;
  lane: string | null;
}
/** One piece of work for one robot: from where it stands, past the stops, to the destination (the last of `legs`). `leg` is the one it is driving now. */
export interface Trip {
  assignedAtS: number;
  startedAtS: number | null;
  deadlineS: number | null;
  id: string;
  kind: 'transport' | 'return' | 'charge' | 'park';
  origin?: string;
  legs: string[];
  leg: number;
  loaded: boolean;
  payload: RobotTelemetry['payload'];
  /** A requested trip: its order id, and the leg from which the load is carried (the legs before it are driven empty). Ordinary trips carry from the start. */ orderId?: string;
  loadFrom?: number;
}
/** Stations that work is sent to (not parking spots or chargers). */
export interface Permit {
  occ: Set<string>;
  waiters: Set<string>;
  lanes?: Map<string, Set<string>>;
}

/** Pure, deterministic fleet simulation (no timers). Obeys the same rules a real fleet does: fleet-confined lanes, directed lanes, one direction of travel (robots never reverse),
 *  a permit ("visa") for every intersection and traffic zone (one robot in, the others wait at the hold point until it is clear), no touching, no forbidden zones (lanes avoid them). */
/** A robot to put on the floor: its name, model and the lane-map fleet it belongs to (from the shared dataset). Without a roster the sim makes up `count` robots. */
export interface RosterEntry {
  id: string;
  model: string;
  fleetId: string;
  /** Battery capacity, to turn battery % into energy (kWh). */ batteryKWh?: number;
}
export interface SimOptions {
  /** Rare random faults that need manual help (off in the traffic benchmarks). */ faults?: boolean;
  /** Where trip ids come from (shared with the requests); without it the simulation counts its own. */ tripIds?: TripIdSource;
}
