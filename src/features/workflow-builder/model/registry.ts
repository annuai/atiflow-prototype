import { ROBOT_TYPE_LABELS } from '@/data/robotTypes';
import { copy } from '../copy';
import type { IconId, NodeTypeId, NodeTypeSpec } from './types';

/**
 * THE extension point: a node type is one entry here (fields, colours, defaults). Cards, palette, parser and simulator read this registry.
 * Colours are the Figma node accents.
 */
export const NODE_TYPES: Record<NodeTypeId, NodeTypeSpec> = {
  start: {
    get label() {
      return copy.nodes.start;
    },
    accent: '#e1f5ee',
    icon: 'play',
    w: 280,
    fixed: true,
    fields: [
      {
        key: 'trigger',
        get label() {
          return copy.fields.trigger;
        },
        opts: ['Manual', 'Auto', 'Scheduled'],
      },
      {
        key: 'robot',
        get label() {
          return copy.fields.robot;
        },
        opts: [...ROBOT_TYPE_LABELS],
      },
      {
        key: 'request',
        get label() {
          return copy.fields.request;
        },
        opts: ['Tablet', 'MES', 'Call Button'],
      },
      {
        key: 'users',
        get label() {
          return copy.fields.users;
        },
        kind: 'users',
        optsFrom: 'requestUsers',
        showIf: (n) => n.f.request === 'Tablet',
      },
    ],
  },
  material: {
    get label() {
      return copy.nodes.material;
    },
    accent: '#eedcef',
    icon: 'keyframes',
    w: 224,
    defaults: { type: 'Material', code: '', fromTablet: false, qty: '10' },
    fields: [
      {
        key: 'type',
        get label() {
          return copy.fields.type;
        },
        opts: ['Material', 'Kit', 'Spare Part'],
      },
      {
        key: 'code',
        get label() {
          return copy.fields.code;
        },
        optsFrom: 'fleetMaterials',
      },
      {
        key: 'fromTablet',
        get label() {
          return copy.fields.fromTablet;
        },
        kind: 'check',
      },
      {
        key: 'qty',
        get label() {
          return copy.fields.qty;
        },
        kind: 'input',
      },
    ],
  },
  logic: {
    get label() {
      return copy.nodes.logic;
    },
    accent: '#d5dbfd',
    icon: 'keyframes',
    w: 245,
    defaults: { material: '', station: '', cond: 'Greater than', qty: '10' },
    fields: [
      {
        key: 'material',
        get label() {
          return copy.fields.material;
        },
        optsFrom: 'fleetMaterials',
      },
      {
        key: 'station',
        get label() {
          return copy.fields.station;
        },
        optsFrom: 'fleetStations',
      },
      {
        key: 'cond',
        get label() {
          return copy.fields.condition;
        },
        kind: 'cond',
        opts: ['Greater than', 'Less than', 'Equal to', 'Not equal to'],
      },
      {
        key: 'qty',
        get label() {
          return copy.fields.qty;
        },
        row: true,
        opts: ['5', '10', '20', '50', '100'],
      },
    ],
  },
  container: {
    get label() {
      return copy.nodes.container;
    },
    accent: '#d5dbfd',
    icon: 'box',
    w: 165,
    fields: [],
    get note() {
      return copy.notes.container;
    },
  },
  wait: {
    get label() {
      return copy.nodes.wait;
    },
    accent: '#b5def0',
    icon: 'clock',
    w: 155,
    defaults: { time: '00:01:00' },
    fields: [
      {
        key: 'time',
        get label() {
          return copy.fields.time;
        },
        opts: ['00:00:30', '00:01:00', '00:02:00', '00:05:00', '00:10:00'],
      },
    ],
  },
  station: {
    get label() {
      return copy.nodes.station;
    },
    accent: '#fdf4df',
    icon: 'pin',
    w: 155,
    bw: 170,
    defaults: { action: 'Pick Up', station: '' },
    fields: [
      {
        key: 'action',
        get label() {
          return copy.fields.type;
        },
        opts: ['Pick Up', 'Drop Off'],
      },
      {
        key: 'station',
        label: (n) => (n.f.lbl as string) || copy.fields.stationOrArea,
        optsFrom: 'fleetStations',
        branch: {
          get label() {
            return copy.fields.station;
          },
          kind: 'multi',
        },
      },
    ],
  },
  confirm: {
    get label() {
      return copy.nodes.confirm;
    },
    accent: '#dcfce7',
    icon: 'badge',
    w: 224,
    defaults: { op: 'Dispatch Button', users: [] },
    fields: [
      {
        key: 'op',
        get label() {
          return copy.fields.op;
        },
        opts: ['Dispatch Button', 'Tablet', 'Barcode Scan'],
      },
      {
        key: 'users',
        get label() {
          return copy.fields.approvalUser;
        },
        kind: 'users',
        optsFrom: 'approvalUsers',
        showIf: (n) => n.f.op === 'Tablet',
      },
    ],
  },
  end: {
    get label() {
      return copy.nodes.end;
    },
    accent: '#f7e4e4',
    icon: 'square',
    w: 140,
    fixed: true,
    fields: [],
    get note() {
      return copy.notes.end;
    },
  },
};

export interface PaletteEntry {
  type: NodeTypeId | 'aiot';
  label: string;
  accent?: string;
  icon?: IconId | 'antenna';
}
/** Palette order (Figma). `aiot` has only a tile in the design, no node card yet. */
export const PALETTE: PaletteEntry[] = [
  {
    type: 'material',
    get label() {
      return copy.nodes.material;
    },
  },
  {
    type: 'logic',
    get label() {
      return copy.nodes.logic;
    },
  },
  {
    type: 'container',
    get label() {
      return copy.nodes.container;
    },
  },
  {
    type: 'wait',
    get label() {
      return copy.nodes.wait;
    },
  },
  {
    type: 'station',
    get label() {
      return copy.nodes.station;
    },
  },
  {
    type: 'confirm',
    get label() {
      return copy.nodes.confirm;
    },
  },
  {
    type: 'end',
    get label() {
      return copy.nodes.end;
    },
  },
  {
    type: 'aiot',
    get label() {
      return copy.nodes.aiot;
    },
    accent: '#e6e6e6',
    icon: 'antenna',
  },
];
