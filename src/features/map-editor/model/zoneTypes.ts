import { text } from '../text';
import type { ZoneProp, ZoneTypeId } from './types';

/**
 * THE list of zone types. A zone type says how it is called, how it is drawn and which settings it has; the editor, the zone list and the publish checks read this table, so a new
 * kind of zone is one more entry here. `code` is the name the fleet manager uses for it. Today every type in the Zones menu has a name, a polygon and one generic value; a type
 * gets its own settings (`fields`) when its properties are defined.
 */
interface ZoneField {
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
const VALUE: ZoneField[] = [
  {
    key: 'value',
    get label() {
      return text.zoneFields.value;
    },
    kind: 'text',
    default: '',
  },
];
/** The name of a zone type in the language in use (the id when a type has no text). */
const labelOf = (id: string): string => (text.zoneTypes as Record<string, string | undefined>)[id] ?? id;
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
const generic = (code: string, i: number): ZoneType => {
  const id = code
    .replace(/_ZONES?$/, '')
    .toLowerCase()
    .replace(/_/g, '-');
  return {
    id,
    code,
    get label() {
      return labelOf(id);
    },
    description: '',
    color: COLORS[i % COLORS.length],
    module: 'zones',
    fields: VALUE,
  };
};

export const ZONE_TYPES: ZoneType[] = [
  {
    id: 'exclusive',
    code: 'EXCLUSIVE_ZONES',
    get label() {
      return labelOf('exclusive');
    },
    get description() {
      return text.zoneDescriptions.exclusive;
    },
    color: '#f59e0b',
    module: 'exclusive',
    fields: [
      {
        key: 'capacity',
        get label() {
          return text.zoneFields.capacity;
        },
        kind: 'number',
        default: 1,
      },
    ],
  },
  {
    id: 'area',
    code: 'WORK_AREAS',
    get label() {
      return labelOf('area');
    },
    get description() {
      return text.zoneDescriptions.area;
    },
    color: '#14b8a6',
    module: 'zones',
    fields: [],
  },
  {
    id: 'no-go',
    code: 'NO_GO_ZONES',
    get label() {
      return labelOf('no-go');
    },
    get description() {
      return text.zoneDescriptions.noGo;
    },
    color: '#ef4444',
    module: 'zones',
    fields: [
      {
        key: 'reason',
        get label() {
          return text.zoneFields.reason;
        },
        kind: 'text',
        default: '',
      },
    ],
  },
  ...(
    [
      'LOW_SPEED_ZONES',
      'SPECIAL_CAMERA_ZONES',
      'RAMP_ZONES',
      'VARIABLE_PADDING_ZONES',
      'OBSTACLE_AVOIDANCE_ZONES',
      'TRAFFIC_INTERSECTION_ZONES',
      '3D_COLLISION_DETECTION_ZONES',
      'STEREO_DEPTH_DENOISING_ZONES',
      'NO_PAYLOAD_SAFETY_ZONES',
      'CONVEYOR_WALL_ZONES',
      'TABLE_PICKUP_ZONES',
      'WHEEL_POSE_ZONE',
      'DOCKING_ZONES',
      'ZEBRA_CROSSING_ZONES',
      'SPECIAL_LIDAR_2D_ZONES',
      'SMART_DOOR_ZONES',
      'VARIABLE_STOP_DIST_ZONES',
    ] as const
  ).map((code, i) => generic(code, i)),
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
