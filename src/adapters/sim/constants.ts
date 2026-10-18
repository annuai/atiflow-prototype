import type { NavGraph } from '../../core/types';

/** The simulator's tunables (distances in metres, times in seconds), and the random number generator it is seeded with. */
export const rng = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
export const HOLD = 2.4,
  V = 1.1,
  ACC = 1.2,
  DEC = 3,
  TD = 1.3; // hold distance before an intersection / traffic zone, cruise speed, accel / brake (m/s^2), robot centre -> trolley centre
export const REJOIN_M = 1.3,
  REJOIN_MAX = 15; // a robot farther than this from every lane of its fleet is off the road (same limit as the OFF_LANE check); it can rejoin from up to REJOIN_MAX away
export const REROUTE_AFTER = 6; // seconds stopped by an obstacle before the robot looks for another road
export const TURN_RATE = 2.5; // rad/s: the robot turns at most this fast, and slows down while its heading lags behind the route
export const CLEAR = 0.01,
  CLAIM = 3.2,
  SAMPLE = 0.35; // gap kept between footprints; how far ahead a robot reserves its way; spacing of the checked positions
export const GROUP_GAP = 1.5,
  EXIT_SPACE = 1.5; // intersections closer than this along a route are permitted together; free road needed beyond an intersection before entering it
export const FAULT_RATE = 0.00008; // per second of driving: about one fault per 3.5 h of driving per robot (only when faults are switched on)
export const SLA_FACTOR = 3,
  SLA_BASE = 90,
  SLA_PER_STOP = 15; // a work trip is due 90 s + 3 x the drive time at cruise speed + 15 s per stop after it was assigned (PLACEHOLDER: replace with the customer's SLA)
export const STUCK_ALERT = 90,
  CYCLE_AFTER = 3; // seconds waiting before a robot asks for help; seconds a wait cycle may last before it is broken
/** Footprints are chains of circles: the robot (1.2 x 0.85 m) and the trolley it tows (1.1 x 0.7 m). Opposite lanes are about 0.95 m apart, so neighbours in parallel lanes pass each other. */
export const WORK = (s: NavGraph['stations'][number]) => s.type !== 'charge' && s.type !== 'park';
export const LEAVE_CLEAR = 3; // m: until a robot has driven this far from its station the station still counts as taken by it
export const FAR = 30; // m: a trip's destination is at least this far from where it starts (when the fleet has such a station)
