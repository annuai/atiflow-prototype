import { createNode, createStart } from '@/features/workflow-builder/model/factory';
import { defaultWorkflowName } from '@/features/workflow-builder/model/names';
import type { Workflow, Workflows } from '@/features/workflow-builder/model/types';
import { FLEET_ID, FLEET_NAME, type FleetId } from '@/data/fleets';

/**
 * Starting data of the DUMMY workflow service: one workflow per seed fleet, the sample request workflows (one per material) and the sample trips. Real workflows come from the API;
 * nothing but the dummy adapter reads this file. (The functions that bring SAVED workflows up to date stay with the builder: `features/workflow-builder/model/seed.ts`.)
 */
/** Starting workflows: one per seed fleet. */
/** The starting workflows in their ORIGINAL shape; `seedWorkflows` (builder `model/seed.ts`) brings them up to date and adds the samples. */
export function baseSeedWorkflows(): Workflows {
  const list: Workflow[] = [
    {
      id: 'w-line-side-1',
      name: defaultWorkflowName(FLEET_NAME.lineSide),
      fleet: FLEET_ID.lineSide,
      saved: true,
      nodes: [
        createStart({ users: ['rohan'] }),
        createNode('material', { type: 'Material', code: 'DCP-1003', fromTablet: false, qty: '10' }),
        createNode('logic', { material: 'DCP-1003', station: 'STA-102', cond: 'Greater than', qty: '10' }),
        createNode('confirm', { op: 'Dispatch Button' }),
        createNode('station', { action: 'Drop Off', station: 'STA-102' }),
        createNode('station', { action: 'Pick Up', station: 'STA-103' }),
        createNode('container'),
        createNode('confirm', { op: 'Dispatch Button' }),
        createNode('station', { action: 'Drop Off', station: 'STA-104', lbl: 'Station' }),
        createNode('confirm', { op: 'Dispatch Button' }),
        createNode('end'),
      ],
    },
    {
      id: 'w-assembly-1',
      name: defaultWorkflowName(FLEET_NAME.assembly),
      fleet: FLEET_ID.assembly,
      saved: true,
      nodes: [
        createStart({ trigger: 'Auto', request: 'MES' }),
        createNode('material', { type: 'Material', code: 'DCP-1005', qty: '10' }),
        createNode('confirm', { op: 'Dispatch Button' }),
        createNode('station', { action: 'Pick Up', station: 'STA-116' }),
        createNode('confirm', { op: 'Dispatch Button' }),
        createNode('station', { action: 'Drop Off', station: 'STA-113' }),
        createNode('confirm', { op: 'Dispatch Button' }),
        createNode('end'),
      ],
    },
  ];
  return Object.fromEntries(list.map((w) => [w.id, w]));
}

/**
 * Published sample workflows, one per material of Master Data, started from the operator Tablet. The Start step lists who may request; a Tablet Confirm step lists who approves.
 * Some have a Confirm step (their requests wait for approval), the others do not. Stations are real stations of the ECC map.
 */
const SAMPLES: {
  id: string;
  name: string;
  fleet: FleetId;
  code: string;
  qty: string;
  fromTablet: boolean;
  pick: string;
  drop: string;
  requesters: string[];
  approvers?: string[];
}[] = [
  {
    id: 'w-sample-1001',
    name: 'Chain Pin to Workstation 1',
    fleet: FLEET_ID.lineSide,
    code: 'DCP-1001',
    qty: '20',
    fromTablet: true,
    pick: 'STA-116',
    drop: 'STA-107',
    requesters: ['rohan'],
    approvers: ['vikram'],
  },
  {
    id: 'w-sample-1002',
    name: 'Chain Plate to Workstation 6',
    fleet: FLEET_ID.lineSide,
    code: 'DCP-1002',
    qty: '10',
    fromTablet: false,
    pick: 'STA-117',
    drop: 'STA-108',
    requesters: ['rohan'],
  },
  {
    id: 'w-sample-1003',
    name: 'Sprocket to Workstation 4',
    fleet: FLEET_ID.lineSide,
    code: 'DCP-1003',
    qty: '5',
    fromTablet: true,
    pick: 'STA-119',
    drop: 'STA-110',
    requesters: ['rohan'],
    approvers: ['vikram'],
  },
  {
    id: 'w-sample-1004',
    name: 'Power Cable to Workstation 3',
    fleet: FLEET_ID.lineSide,
    code: 'DCP-1004',
    qty: '15',
    fromTablet: true,
    pick: 'STA-121',
    drop: 'STA-105',
    requesters: ['rohan'],
  },
  {
    id: 'w-sample-1005',
    name: 'Coupling Pad to Preparation 1',
    fleet: FLEET_ID.assembly,
    code: 'DCP-1005',
    qty: '30',
    fromTablet: true,
    pick: 'STA-116',
    drop: 'STA-113',
    requesters: ['sneha'],
    approvers: ['vikram'],
  },
  {
    id: 'w-sample-1006',
    name: 'Dust Cover to Preparation 2',
    fleet: FLEET_ID.assembly,
    code: 'DCP-1006',
    qty: '8',
    fromTablet: false,
    pick: 'STA-117',
    drop: 'STA-114',
    requesters: ['sneha'],
  },
];
export function sampleWorkflows(): Workflow[] {
  return SAMPLES.map((s) => ({
    id: s.id,
    name: s.name,
    fleet: s.fleet,
    published: true,
    saved: true,
    nodes: [
      createStart({ trigger: 'Manual', request: 'Tablet', users: s.requesters }),
      createNode('material', { type: 'Material', code: s.code, fromTablet: s.fromTablet, qty: s.qty }),
      createNode('station', { action: 'Pick Up', station: s.pick }),
      ...(s.approvers ? [createNode('confirm', { op: 'Tablet', users: s.approvers })] : []),
      createNode('station', { action: 'Drop Off', station: s.drop }),
      createNode('end'),
    ],
  }));
}
/**
 * Published sample workflows with NO material: a robot just runs from station to station (saved routes for the operator tablet). One needs a Tablet approval (vikram), the others none.
 * They also show that Empty Container and other nodes can sit in such a workflow.
 */
const ROUTES: {
  id: string;
  name: string;
  fleet: FleetId;
  robot: string;
  stations: string[];
  requesters: string[];
  approvers?: string[];
  container?: boolean;
}[] = [
  {
    id: 'w-route-1',
    name: 'Store run to Workstations',
    fleet: FLEET_ID.lineSide,
    robot: 'Sherpa XT Lite',
    stations: ['STA-116', 'STA-107', 'STA-110'],
    requesters: ['rohan'],
  },
  {
    id: 'w-route-2',
    name: 'Pallet Mover shuttle: Store to Workstation 3',
    fleet: FLEET_ID.lineSide,
    robot: 'Pallet Mover',
    stations: ['STA-117', 'STA-105'],
    requesters: ['rohan'],
    approvers: ['vikram'],
    container: true,
  },
  {
    id: 'w-route-3',
    name: 'Preparation round',
    fleet: FLEET_ID.assembly,
    robot: 'Sherpa XT Lite',
    stations: ['STA-116', 'STA-113', 'STA-114'],
    requesters: ['sneha'],
  },
  {
    id: 'w-route-4',
    name: 'Full Line Side replenishment round: store to every workstation',
    fleet: FLEET_ID.lineSide,
    robot: 'Sherpa XT Lite',
    stations: ['STA-116', 'STA-117', 'STA-107', 'STA-105', 'STA-110', 'STA-108'],
    requesters: ['rohan'],
  },
];
export function routeSampleWorkflows(): Workflow[] {
  return ROUTES.map((r) => ({
    id: r.id,
    name: r.name,
    fleet: r.fleet,
    published: true,
    saved: true,
    nodes: [
      createStart({ trigger: 'Manual', request: 'Tablet', robot: r.robot, users: r.requesters }),
      ...(r.container ? [createNode('container')] : []),
      ...r.stations.map((st, i) => createNode('station', { action: i === 0 ? 'Pick Up' : 'Drop Off', station: st })),
      ...(r.approvers ? [createNode('confirm', { op: 'Tablet', users: r.approvers })] : []),
      createNode('end'),
    ],
  }));
}
