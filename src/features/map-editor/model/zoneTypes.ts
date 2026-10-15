import type { ZoneProp, ZoneTypeId } from './types';

/**
 * THE list of zone types. A zone type says how it is called, how it is drawn and which settings it has; the editor, the zone list and the publish checks read this table, so a new
 * kind of zone is one more entry here. `code` is the name the fleet manager uses for it. Today every type in the Zones menu has a name, a polygon and one generic value; a type
 * gets its own settings (`fields`) when its properties are defined.
 */
export interface ZoneField {
  key: string;
  label: string;
  kind: 'number' | 'text' | 'select' | 'boolean';
  default: ZoneProp;
  unit?: string;
  options?: string[];
}
export interface ZoneType {
  id: ZoneTypeId;
  code: string;
  label: string;
  description: string;
  color: string;
  /** Which editor module holds it. */ module: 'exclusive' | 'zones';
  fields: ZoneField[];
}
const VALUE: ZoneField[] = [{ key: 'value', label: 'Value', kind: 'text', default: '' }];
const COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#f97316',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#eab308',
  '#14b8a6',
  '#6366f1',
  '#d946ef',
  '#0ea5e9',
  '#f43f5e',
  '#a855f7',
  '#22c55e',
  '#64748b',
  '#fb923c',
  '#2dd4bf',
];
const generic = (code: string, label: string, i: number): ZoneType => ({
  id: code
    .replace(/_ZONES?$/, '')
    .toLowerCase()
    .replace(/_/g, '-'),
  code,
  label,
  description: '',
  color: COLORS[i % COLORS.length],
  module: 'zones',
  fields: VALUE,
});

export const ZONE_TYPES: ZoneType[] = [
  {
    id: 'exclusive',
    code: 'EXCLUSIVE_ZONES',
    label: 'Traffic gate',
    description: 'A robot enters only when there is room; the others wait at the hold point.',
    color: '#f59e0b',
    module: 'exclusive',
    fields: [{ key: 'capacity', label: 'Robots allowed inside', kind: 'number', default: 1 }],
  },
  {
    id: 'area',
    code: 'WORK_AREAS',
    label: 'Work area',
    description: 'A named part of the floor a fleet works in.',
    color: '#14b8a6',
    module: 'zones',
    fields: [],
  },
  {
    id: 'no-go',
    code: 'NO_GO_ZONES',
    label: 'No-go',
    description: 'Robots never enter.',
    color: '#ef4444',
    module: 'zones',
    fields: [{ key: 'reason', label: 'Reason', kind: 'text', default: '' }],
  },
  ...(
    [
      ['LOW_SPEED_ZONES', 'Low speed'],
      ['SPECIAL_CAMERA_ZONES', 'Special camera'],
      ['RAMP_ZONES', 'Ramp'],
      ['VARIABLE_PADDING_ZONES', 'Variable padding'],
      ['OBSTACLE_AVOIDANCE_ZONES', 'Obstacle avoidance'],
      ['TRAFFIC_INTERSECTION_ZONES', 'Traffic intersection'],
      ['3D_COLLISION_DETECTION_ZONES', '3D collision detection'],
      ['STEREO_DEPTH_DENOISING_ZONES', 'Stereo depth denoising'],
      ['NO_PAYLOAD_SAFETY_ZONES', 'No payload safety'],
      ['CONVEYOR_WALL_ZONES', 'Conveyor wall'],
      ['TABLE_PICKUP_ZONES', 'Table pickup'],
      ['WHEEL_POSE_ZONE', 'Wheel pose'],
      ['DOCKING_ZONES', 'Docking'],
      ['ZEBRA_CROSSING_ZONES', 'Zebra crossing'],
      ['SPECIAL_LIDAR_2D_ZONES', 'Special 2D lidar'],
      ['SMART_DOOR_ZONES', 'Smart door'],
      ['VARIABLE_STOP_DIST_ZONES', 'Variable stop distance'],
    ] as const
  ).map(([code, label], i) => generic(code, label, i)),
];
export const zoneType = (id: ZoneTypeId): ZoneType =>
  ZONE_TYPES.find((t) => t.id === id) ?? {
    id,
    code: id,
    label: id,
    description: '',
    color: '#94a3b8',
    module: 'zones',
    fields: VALUE,
  };
/** The types offered by the "Add new zone" menu of a module. */
export const zoneTypesOf = (module: ZoneType['module']) => ZONE_TYPES.filter((t) => t.module === module);
