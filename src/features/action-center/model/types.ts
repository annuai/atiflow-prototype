/** What a robot can call for help about. */
export type CallKind = 'blocked' | 'fault' | 'deadlock' | 'stuck' | 'battery' | 'rule';
export type CallStatus = 'open' | 'acknowledged' | 'resolved';
export type Severity = 'warn' | 'critical';

/** One call for help. A deadlock ring is ONE call that lists all its robots. */
export interface Call {
  id: string; // CALL-001 ...
  /** The condition behind it (stable while the condition lasts): one open call per key. */
  key: string;
  kind: CallKind;
  severity: Severity;
  robots: string[];
  fleetId: string; // fleetId = the lane-map id telemetry carries
  title: string;
  reason: string;
  suggestion: string;
  /** Where: the station, traffic zone or lane the robot is at (when known). */
  place?: string;
  /** epoch ms */
  openedAt: number;
  status: CallStatus;
  claimedBy?: string;
  claimedAt?: number;
  resolvedAt?: number;
  resolvedBy?: string;
  resolution?: string;
  /** How many calls of the same kind at the same place came before it (the last 12 hours): 2+ points at the map, not the robot. */
  repeats: number;
}
/** What `detect` finds in one look at the floor; the engine turns candidates into calls. */
export type Candidate = Pick<
  Call,
  'key' | 'kind' | 'severity' | 'robots' | 'fleetId' | 'title' | 'reason' | 'suggestion' | 'place'
>;
export interface Thresholds {
  waitCallS: number;
  waitUrgentS: number;
  batteryLow: number;
}
