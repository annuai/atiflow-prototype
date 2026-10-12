// Shared contracts. See CLAUDE.md section 5. Units: meters / radians, site frame (X east, Y north).
export type Vec2 = { x: number; y: number };

export interface Wall { a: [number, number]; b: [number, number]; t: number; h: number; layer: string }
export interface Zone { id: string; name: string; kind: string; active: boolean; color: string; polygon: [number, number][] }
export interface Equipment { kind: string; x: number; y: number; w: number; d: number; h: number; layer: string }
export interface SiteLayout {
  schema: 1; siteId: string; name: string; units: 'm';
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  floorPolygons: [number, number][][]; walls: Wall[]; pillars: unknown[]; zones: Zone[];
  equipment: Equipment[]; doors: unknown[]; labels: { text: string; x: number; y: number }[];
}

export type StationType = 'pick' | 'drop' | 'buffer' | 'asrs' | 'charge';
export interface NavNode { id: string; x: number; y: number; kind: 'waypoint' | 'station' }
/** One lane = one direction of travel, always. Opposite directions are separate paired lanes. */
export interface Lane { id: string; from: string; to: string; geom: [number, number][]; fleets: string[]; speed: number; len: number }
export interface Station { id: string; name: string; nodeId: string; type: StationType; zone: string | null; fleets: string[] }
export interface FleetDef { id: string; name: string; color: string; areas: string[] }
/** Robots wait at the entrance until fewer than `capacity` robots are inside. */
export interface TrafficZone { id: string; name: string; capacity: number; fleets: string[]; polygon: [number, number][] }
/** Robots never enter. */
export interface ForbiddenZone { id: string; name: string; reason: string; polygon: [number, number][] }
export interface NavGraph {
  schema: 2; siteId: string; nodes: NavNode[]; lanes: Lane[]; stations: Station[];
  fleets: FleetDef[]; trafficZones: TrafficZone[]; forbiddenZones: ForbiddenZone[];
}

export type RobotState = 'idle' | 'moving' | 'waiting' | 'working' | 'charging' | 'blocked' | 'error' | 'offline' | 'paused';
export interface RobotTelemetry {
  id: string; model: string; fleetId: string; siteId: string;
  pose: { x: number; y: number; theta: number };
  speed: number; state: RobotState; battery: number;
  payload?: { kind: string; qty?: number } | null;
  /** Pose of the trolley the robot is towing (only while it pulls one); renderers draw the trolley there. */
  trailer?: { x: number; y: number; theta: number } | null;
  task?: { id: string; type: string; from?: string; to?: string; progress?: number } | null;
  path?: Vec2[]; currentNode?: string; nextNode?: string;
  laneId?: string | null;                                            // lane currently driven (from localization)
  traffic?: { zoneId: string; status: 'waiting' | 'inside' } | null;  // traffic-zone state reported by the robot
  waitReason?: 'traffic' | 'headway' | null;
  atStation?: string | null;
  alerts?: { code: string; severity: 'info' | 'warn' | 'critical'; msg: string }[];
  ts: number;
}

export interface TelemetryAdapter {
  connect(): void; disconnect(): void;
  onTelemetry(cb: (batch: RobotTelemetry[]) => void): void;
}

export type CameraMode = 'orbit' | 'top' | 'walk' | 'follow';
export type LayerKey = 'robots' | 'routes' | 'stations' | 'zones' | 'labels' | 'equipment' | 'alerts';
