import { createNode, createStart } from './factory';
import { defaultWorkflowName } from './names';
import type { WfNode, Workflow, Workflows } from './types';
import { FLEET_NAME } from '@/data/fleets';
import { DEFAULT_ROBOT_TYPE, ROBOT_TYPE_LABELS } from '@/data/robotTypes';

/** Starting workflows: one per seed fleet. */
export function seedWorkflows(): Workflows {
  const list: Workflow[] = [
    { id: 'w-line-side-1', name: defaultWorkflowName(FLEET_NAME.lineSide), fleet: FLEET_NAME.lineSide, saved: true, nodes: [
      createStart({ users: ['rohan'] }),
      createNode('material', { type: 'Material', code: 'DCP-1003', fromTablet: false, qty: '10' }),
      createNode('logic', { material: 'DCP-1003', station: 'STA-102', cond: 'Greater than', qty: '10' }),
      createNode('confirm', { op: 'Dispatch Button' }), createNode('station', { action: 'Drop Off', station: 'STA-102' }), createNode('station', { action: 'Pick Up', station: 'STA-103' }),
      createNode('container'), createNode('confirm', { op: 'Dispatch Button' }), createNode('station', { action: 'Drop Off', station: 'STA-104', lbl: 'Station' }),
      createNode('confirm', { op: 'Dispatch Button' }), createNode('end')] },
    { id: 'w-assembly-1', name: defaultWorkflowName(FLEET_NAME.assembly), fleet: FLEET_NAME.assembly, saved: true, nodes: [
      createStart({ trigger: 'Auto', request: 'MES' }),
      createNode('material', { type: 'Material', code: 'DCP-1005', qty: '10' }), createNode('confirm', { op: 'Dispatch Button' }), createNode('station', { action: 'Pick Up', station: 'STA-116' }),
      createNode('confirm', { op: 'Dispatch Button' }), createNode('station', { action: 'Drop Off', station: 'STA-113' }), createNode('confirm', { op: 'Dispatch Button' }), createNode('end')] },
  ];
  return upgradeToV7(upgradeToV6(Object.fromEntries(list.map((w) => [w.id, w]))));          // (the samples are added)
}

/**
 * Published sample workflows, one per material of Master Data, started from the operator Tablet. The Start step lists who may request; a Tablet Confirm step lists who approves.
 * Some have a Confirm step (their requests wait for approval), the others do not. Stations are real stations of the ECC map.
 */
const SAMPLES: { id: string; name: string; fleet: string; code: string; qty: string; fromTablet: boolean; pick: string; drop: string; requesters: string[]; approvers?: string[] }[] = [
  { id: 'w-sample-1001', name: 'Chain Pin to Workstation 1', fleet: FLEET_NAME.lineSide, code: 'DCP-1001', qty: '20', fromTablet: true, pick: 'STA-116', drop: 'STA-107', requesters: ['rohan'], approvers: ['vikram'] },
  { id: 'w-sample-1002', name: 'Chain Plate to Workstation 6', fleet: FLEET_NAME.lineSide, code: 'DCP-1002', qty: '10', fromTablet: false, pick: 'STA-117', drop: 'STA-108', requesters: ['rohan'] },
  { id: 'w-sample-1003', name: 'Sprocket to Workstation 4', fleet: FLEET_NAME.lineSide, code: 'DCP-1003', qty: '5', fromTablet: true, pick: 'STA-119', drop: 'STA-110', requesters: ['rohan'], approvers: ['vikram'] },
  { id: 'w-sample-1004', name: 'Power Cable to Workstation 3', fleet: FLEET_NAME.lineSide, code: 'DCP-1004', qty: '15', fromTablet: true, pick: 'STA-121', drop: 'STA-105', requesters: ['rohan'] },
  { id: 'w-sample-1005', name: 'Coupling Pad to Preparation 1', fleet: FLEET_NAME.assembly, code: 'DCP-1005', qty: '30', fromTablet: true, pick: 'STA-116', drop: 'STA-113', requesters: ['sneha'], approvers: ['vikram'] },
  { id: 'w-sample-1006', name: 'Dust Cover to Preparation 2', fleet: FLEET_NAME.assembly, code: 'DCP-1006', qty: '8', fromTablet: false, pick: 'STA-117', drop: 'STA-114', requesters: ['sneha'] },
];
export function sampleWorkflows(): Workflow[] {
  return SAMPLES.map((s) => ({ id: s.id, name: s.name, fleet: s.fleet, published: true, saved: true, nodes: [
    createStart({ trigger: 'Manual', request: 'Tablet', users: s.requesters }),
    createNode('material', { type: 'Material', code: s.code, fromTablet: s.fromTablet, qty: s.qty }),
    createNode('station', { action: 'Pick Up', station: s.pick }),
    ...(s.approvers ? [createNode('confirm', { op: 'Tablet', users: s.approvers })] : []),
    createNode('station', { action: 'Drop Off', station: s.drop }),
    createNode('end')] }));
}
/**
 * Published sample workflows with NO material: a robot just runs from station to station (saved routes for the operator tablet). One needs a Tablet approval (vikram), the others none.
 * They also show that Empty Container and other nodes can sit in such a workflow.
 */
const ROUTES: { id: string; name: string; fleet: string; robot: string; stations: string[]; requesters: string[]; approvers?: string[]; container?: boolean }[] = [
  { id: 'w-route-1', name: 'Store run to Workstations', fleet: FLEET_NAME.lineSide, robot: 'Sherpa XT Lite', stations: ['STA-116', 'STA-107', 'STA-110'], requesters: ['rohan'] },
  { id: 'w-route-2', name: 'Pallet Mover shuttle: Store to Workstation 3', fleet: FLEET_NAME.lineSide, robot: 'Pallet Mover', stations: ['STA-117', 'STA-105'], requesters: ['rohan'], approvers: ['vikram'], container: true },
  { id: 'w-route-3', name: 'Preparation round', fleet: FLEET_NAME.assembly, robot: 'Sherpa XT Lite', stations: ['STA-116', 'STA-113', 'STA-114'], requesters: ['sneha'] },
];
export function routeSampleWorkflows(): Workflow[] {
  return ROUTES.map((r) => ({ id: r.id, name: r.name, fleet: r.fleet, published: true, saved: true, nodes: [
    createStart({ trigger: 'Manual', request: 'Tablet', robot: r.robot, users: r.requesters }),
    ...(r.container ? [createNode('container')] : []),
    ...r.stations.map((st, i) => createNode('station', { action: i === 0 ? 'Pick Up' : 'Drop Off', station: st })),
    ...(r.approvers ? [createNode('confirm', { op: 'Tablet', users: r.approvers })] : []),
    createNode('end')] }));
}
/**
 * The Start step's Robot Type is a robot of the catalog. A value saved earlier that is not one (the old list had names such as "Sherpa Hitch" that match no robot) becomes the default robot,
 * so a trip never waits for a robot type that does not exist.
 */
export function normaliseRobots(workflows: Workflows): Workflows {
  const fix = (n: WfNode): WfNode => (n.t === 'start' && !ROBOT_TYPE_LABELS.includes(n.f.robot as string) ? { ...n, f: { ...n.f, robot: DEFAULT_ROBOT_TYPE.label } } : n);
  const out: Workflows = {}; for (const [id, w] of Object.entries(workflows)) out[id] = w.nodes.some((n) => fix(n) !== n) ? { ...w, nodes: w.nodes.map(fix) } : w; return out;
}
/** Adds the sample routes that are missing (a list saved before they existed). */
export function withRouteSamples(workflows: Workflows): Workflows {
  const out = { ...workflows }; for (const w of routeSampleWorkflows()) if (!out[w.id]) out[w.id] = w; return out;
}
/** Workflows saved before requests existed: "Request from Tablet" became "Tablet". The sample workflows are added when missing. */
export function upgradeToV5(workflows: Workflows): Workflows {
  const out: Workflows = {};
  for (const [id, w] of Object.entries(workflows)) out[id] = { ...w, nodes: w.nodes.map((n) => n.t !== 'start' ? n : { ...n, f: { ...n.f, request: n.f.request === 'Request from Tablet' ? 'Tablet' : n.f.request } }) };
  for (const s of sampleWorkflows()) if (!out[s.id]) out[s.id] = s;
  return out;
}
/** The Start step no longer lists User IDs (the operators mapped to the drop-off station request) and every Confirm step has a station (the one just before it). The sample workflows are replaced by the current ones. */
export function upgradeToV6(workflows: Workflows): Workflows {
  const stationOf = (n: WfNode) => (Array.isArray(n.f.station) ? n.f.station[0] : (n.f.station as string)) ?? '';
  const fix = (list: WfNode[]): WfNode[] => { let last = ''; return list.map((n, i) => {
    if (n.t === 'station') last = stationOf(n);
    const next = list.slice(i + 1).find((x) => x.t === 'station'); const at = last || (next ? stationOf(next) : '');          // the station before it, else the one after it
    const base = n.t === 'start' ? { ...n, f: Object.fromEntries(Object.entries(n.f).filter(([k]) => k !== 'user')) } : n.t === 'confirm' && !n.f.station ? { ...n, f: { ...n.f, station: at } } : n;
    return base.br ? { ...base, br: { t: fix(base.br.t), o: fix(base.br.o) } } : base; }); };
  const out: Workflows = {}; for (const [id, w] of Object.entries(workflows)) out[id] = { ...w, nodes: fix(w.nodes) };
  for (const s of sampleWorkflows()) out[s.id] = s;
  return out;
}
/**
 * Requests are no longer tied to stations: the Start step lists the users who may request (Tablet requests) and a Tablet Confirm step lists the users who approve. Confirm steps lose their
 * station, the Weight Sensor operation (not available) becomes Dispatch Button, and the sample workflows are replaced by the current ones.
 */
export function upgradeToV7(workflows: Workflows): Workflows {
  const fix = (list: WfNode[]): WfNode[] => list.map((n) => {
    const base = n.t === 'start' ? { ...n, f: { ...n.f, users: Array.isArray(n.f.users) ? n.f.users : [] } }
      : n.t === 'confirm' ? { ...n, f: { ...Object.fromEntries(Object.entries(n.f).filter(([k]) => k !== 'station')), op: n.f.op === 'Weight Sensor' ? 'Dispatch Button' : n.f.op, users: Array.isArray(n.f.users) ? n.f.users : [] } } : n;
    return base.br ? { ...base, br: { t: fix(base.br.t), o: fix(base.br.o) } } : base;
  });
  const out: Workflows = {}; for (const [id, w] of Object.entries(workflows)) out[id] = { ...w, nodes: fix(w.nodes) };
  for (const s of sampleWorkflows()) out[s.id] = s;
  return withRouteSamples(out);
}

let counter = 1;
/** A new workflow with only Start and End. Without a fleet it has no name yet (it gets one when a fleet is chosen). */
export function blankWorkflow(fleet: string | null = null, takenNames: string[] = []): Workflow {
  return { id: `w-${Date.now().toString(36)}-${counter++}`, name: fleet ? defaultWorkflowName(fleet, takenNames) : '', fleet, nodes: [createStart(), createNode('end')] };
}
/** Kept workflows are the ones the user published or saved as a draft; everything else is thrown away when left. */
export const isKept = (w: Workflow) => !!(w.published || w.saved);
/** A workflow that has no fleet and nothing built yet can be reused instead of creating another blank one. */
export const isBlankDraft = (w: Workflow) => w.fleet === null && w.nodes.length === 2;
