// Shared contracts. See CLAUDE.md section 5. Units: meters / radians, site frame (X east, Y north).
export type Vec2 = { x: number; y: number };

export interface Wall {
  a: [number, number];
  b: [number, number];
  t: number;
  h: number;
  layer: string;
}
export interface Zone {
  id: string;
  name: string;
  kind: string;
  active: boolean;
  color: string;
  polygon: [number, number][];
}
export interface Equipment {
  kind: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  layer: string;
}
export interface SiteLayout {
  schema: 1;
  siteId: string;
  name: string;
  units: 'm';
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  floorPolygons: [number, number][][];
  walls: Wall[];
  pillars: unknown[];
  zones: Zone[];
  equipment: Equipment[];
  doors: unknown[];
  labels: { text: string; x: number; y: number }[];
}

export type StationType = 'pick' | 'drop' | 'buffer' | 'asrs' | 'charge' | 'park';
export interface NavNode {
  id: string;
  x: number;
  y: number;
  kind: 'waypoint' | 'station';
}
/** One lane = one direction of travel, always. Opposite directions are separate paired lanes. */
export interface Lane {
  id: string;
  from: string;
  to: string;
  geom: [number, number][];
  fleets: string[];
  speed: number;
  len: number;
}
export interface Station {
  id: string;
  name: string;
  nodeId: string;
  type: StationType;
  zone: string | null;
  fleets: string[];
}
export interface FleetDef {
  id: string;
  name: string;
  color: string;
  areas: string[];
}
/** Robots wait at the entrance until fewer than `capacity` robots are inside. */
export interface TrafficZone {
  id: string;
  name: string;
  capacity: number;
  fleets: string[];
  polygon: [number, number][];
  /**
   * A Line gate: robots coming from `side` (+1 = left of a -> b) of the line a -> b wait until the whole area (the line grown `depth` metres to that side = `polygon`) is clear;
   * robots coming from the other side cross freely. Without `gate` the zone is a plain traffic zone (one robot inside at a time, from any direction).
   */
  gate?: { a: [number, number]; b: [number, number]; depth: number; side: 1 | -1 };
}
/** Robots never enter. */
export interface ForbiddenZone {
  id: string;
  name: string;
  reason: string;
  polygon: [number, number][];
}
export interface NavGraph {
  schema: 2;
  siteId: string;
  nodes: NavNode[];
  lanes: Lane[];
  stations: Station[];
  fleets: FleetDef[];
  trafficZones: TrafficZone[];
  forbiddenZones: ForbiddenZone[];
}

export type RobotState =
  'idle' | 'moving' | 'waiting' | 'working' | 'charging' | 'blocked' | 'error' | 'offline' | 'paused';
export interface RobotTelemetry {
  id: string;
  model: string;
  fleetId: string;
  siteId: string;
  pose: { x: number; y: number; theta: number };
  speed: number;
  state: RobotState;
  battery: number;
  payload?: { kind: string; qty?: number } | null;
  /** Pose of the trolley the robot is towing (only while it pulls one); renderers draw the trolley there. */
  trailer?: { x: number; y: number; theta: number } | null;
  task?: {
    id: string;
    type: string;
    from?: string;
    to?: string;
    progress?: number;
    /** the trip: stations it calls at on the way, the one it is driving to now, and which leg that is */ stops?: string[];
    next?: string;
    leg?: number;
    origin?: string;
  } | null;
  path?: Vec2[];
  currentNode?: string;
  nextNode?: string;
  laneId?: string | null; // lane currently driven (from localization)
  traffic?: { zoneId: string; status: 'waiting' | 'inside' } | null; // traffic-zone state reported by the robot
  waitReason?: 'traffic' | 'headway' | 'intersection' | null;
  /** the robots this one is waiting for (first in line first), while it waits */
  waitsOn?: string[];
  atStation?: string | null;
  /** Distance driven since the robot started, in metres, split by whether it towed a load. Cumulative, so any period is a difference of two readings. */
  odometer?: { empty: number; loaded: number };
  /** Energy used for driving since the robot started (kWh, cumulative). */
  energyKWh?: number;
  alerts?: { code: string; severity: 'info' | 'warn' | 'critical'; msg: string }[];
  ts: number;
}

/**
 * Things that happen at a moment (as opposed to the state a robot is in): the fleet manager / traffic controller report them next to the telemetry.
 * `at` fields are epoch ms. Work trips (transport / return) carry the three trip times the KPIs need: assigned, started (first movement) and the SLA deadline.
 */
export type FleetEvent =
  | {
      type: 'trip-completed';
      ts: number;
      robotId: string;
      fleetId: string;
      tripId: string;
      kind: 'transport' | 'return' | 'charge' | 'park';
      assignedAt: number;
      startedAt: number;
      deadlineAt: number | null;
    }
  | {
      type: 'deadlock';
      ts: number;
      robotIds: string[];
      fleetIds: string[];
      /** how long the longest-waiting robot of the ring had been waiting when the ring was found (s) */ waitedS: number;
    }
  | { type: 'fault'; ts: number; robotId: string; fleetId: string; code: string; needsIntervention: boolean }
  | { type: 'fault-cleared'; ts: number; robotId: string; fleetId: string };

/**
 * A request for one transport trip, handed to the fleet (the simulator today, the fleet manager's API later): a robot of `fleetId` drives to each station of `legs`
 * in order and carries `payload` from leg `loadFrom` on (earlier legs are empty). `id` is the request's own id; the trip gets its own id (TRP-xxx).
 */
export interface TransportOrder {
  id: string;
  /** the trip's id, given when the request was made (before approval) */ tripId?: string;
  fleetId: string;
  legs: string[];
  loadFrom: number;
  payload: { kind: string; qty: number };
  /** Only a robot of this type (the telemetry `model`, e.g. 'sherpa-xt-lite') may take the order; any robot of the fleet when not set. */ robotModel?: string;
}
/** What happened to an order: a robot took it and is on its way, it finished, or it cannot be done. */
export interface OrderUpdate {
  id: string;
  status: 'ongoing' | 'completed' | 'failed';
  tripId?: string;
  robotId?: string;
  reason?: string;
}

export interface TelemetryAdapter {
  connect(): void;
  disconnect(): void;
  onTelemetry(cb: (batch: RobotTelemetry[]) => void): void;
  /** Optional: moments reported by the fleet manager (trip completed, deadlock, fault). */
  onEvent?(cb: (e: FleetEvent) => void): void;
  /** Optional: transport orders (requests from people). `submitOrder` returns false when the order cannot be accepted; `cancelOrder` is false once a robot is on its way. */
  submitOrder?(o: TransportOrder): boolean;
  /** Optional: send a robot to the nearest free charger of its fleet. Refused (with the reason) while it is on a work trip, offline, in error or already charging; a robot driving an empty return or parking trip goes when that ends. */
  sendToCharger?(robotId: string): ChargeResult;
  /** Optional: tell a robot that was moved by hand to find its place on the map again. Refused while it is driving, offline or unknown. The robot's own localization sets the pose; the dashboard only asks. */
  relocalize?(robotId: string): RelocalizeResult;
  cancelOrder?(id: string): boolean;
  onOrderUpdate?(cb: (u: OrderUpdate) => void): void;
}

export type CameraMode = 'orbit' | 'top' | 'walk' | 'follow';
export type LayerKey = 'robots' | 'routes' | 'stations' | 'zones' | 'labels' | 'equipment' | 'alerts';

/** The answer to "relocalize this robot". */
export type RelocalizeResult = { ok: true } | { ok: false; reason: 'not-found' | 'offline' | 'moving' | 'not-running' };

/** The answer to "send this robot to a charger". */
export type ChargeResult =
  | { ok: true; when: 'now' | 'after-trip' }
  | {
      ok: false;
      reason: 'not-found' | 'offline' | 'error' | 'already-charging' | 'work-trip' | 'no-charger' | 'not-running';
      tripId?: string;
    };
