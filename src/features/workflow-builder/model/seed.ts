import { createNode, createStart } from './factory';
import { defaultWorkflowName } from './names';
import type { WfNode, Workflow, Workflows } from './types';
import { FLEET_NAME } from '@/data/fleets';

/** Starting workflows: one per seed fleet. */
export function seedWorkflows(): Workflows {
  const list: Workflow[] = [
    { id: 'w-line-side-1', name: defaultWorkflowName(FLEET_NAME.lineSide), fleet: FLEET_NAME.lineSide, saved: true, nodes: [
      createStart(),
      createNode('material', { type: 'Material', code: 'DCP-1003', fromTablet: false, qty: '10' }),
      createNode('logic', { material: 'DCP-1003', station: 'STA-102', cond: 'Greater than', qty: '10' }),
      createNode('confirm', { op: 'Dispatch Button' }), createNode('station', { action: 'Drop Off', station: 'STA-102' }), createNode('station', { action: 'Pick Up', station: 'STA-103' }),
      createNode('container'), createNode('confirm', { op: 'Dispatch Button' }), createNode('station', { action: 'Drop Off', station: 'STA-104', lbl: 'Station' }),
      createNode('confirm', { op: 'Dispatch Button' }), createNode('end')] },
    { id: 'w-assembly-1', name: defaultWorkflowName(FLEET_NAME.assembly), fleet: FLEET_NAME.assembly, saved: true, nodes: [
      createStart({ trigger: 'Auto', request: 'MES' }),
      createNode('material', { type: 'Material', code: 'DCP-1005', qty: '10' }), createNode('confirm', { op: 'Tablet' }), createNode('station', { action: 'Pick Up', station: 'STA-116' }),
      createNode('confirm', { op: 'Dispatch Button' }), createNode('station', { action: 'Drop Off', station: 'STA-113' }), createNode('confirm', { op: 'Dispatch Button' }), createNode('end')] },
  ];
  return upgradeToV6(Object.fromEntries(list.map((w) => [w.id, w])));          // (Confirm steps get their station; the samples are added)
}

/**
 * Published sample workflows, one per material of Master Data, started from the operator Tablet. Who may request is decided by the operators mapped to the DROP-OFF station
 * (Users page); a Confirm step is an approval by the operators mapped to ITS station. Some have a Confirm step (their requests wait for approval), the others do not.
 * Stations are real stations of the ECC map.
 */
const SAMPLES: { id: string; name: string; fleet: string; code: string; qty: string; fromTablet: boolean; pick: string; drop: string; confirm?: { op: 'Dispatch Button' | 'Tablet'; at: string } }[] = [
  { id: 'w-sample-1001', name: 'Chain Pin to Workstation 1', fleet: FLEET_NAME.lineSide, code: 'DCP-1001', qty: '20', fromTablet: true, pick: 'STA-116', drop: 'STA-107', confirm: { op: 'Dispatch Button', at: 'STA-116' } },
  { id: 'w-sample-1002', name: 'Chain Plate to Workstation 6', fleet: FLEET_NAME.lineSide, code: 'DCP-1002', qty: '10', fromTablet: false, pick: 'STA-117', drop: 'STA-108' },
  { id: 'w-sample-1003', name: 'Sprocket to Workstation 4', fleet: FLEET_NAME.lineSide, code: 'DCP-1003', qty: '5', fromTablet: true, pick: 'STA-119', drop: 'STA-110', confirm: { op: 'Dispatch Button', at: 'STA-119' } },
  { id: 'w-sample-1004', name: 'Power Cable to Workstation 3', fleet: FLEET_NAME.lineSide, code: 'DCP-1004', qty: '15', fromTablet: true, pick: 'STA-121', drop: 'STA-105' },
  { id: 'w-sample-1005', name: 'Coupling Pad to Preparation 1', fleet: FLEET_NAME.assembly, code: 'DCP-1005', qty: '30', fromTablet: true, pick: 'STA-116', drop: 'STA-113', confirm: { op: 'Tablet', at: 'STA-116' } },
  { id: 'w-sample-1006', name: 'Dust Cover to Preparation 2', fleet: FLEET_NAME.assembly, code: 'DCP-1006', qty: '8', fromTablet: false, pick: 'STA-117', drop: 'STA-114' },
];
export function sampleWorkflows(): Workflow[] {
  return SAMPLES.map((s) => ({ id: s.id, name: s.name, fleet: s.fleet, published: true, saved: true, nodes: [
    createStart({ trigger: 'Manual', request: 'Tablet' }),
    createNode('material', { type: 'Material', code: s.code, fromTablet: s.fromTablet, qty: s.qty }),
    createNode('station', { action: 'Pick Up', station: s.pick }),
    ...(s.confirm ? [createNode('confirm', { op: s.confirm.op, station: s.confirm.at })] : []),
    createNode('station', { action: 'Drop Off', station: s.drop }),
    createNode('end')] }));
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

let counter = 1;
/** A new workflow with only Start and End. Without a fleet it has no name yet (it gets one when a fleet is chosen). */
export function blankWorkflow(fleet: string | null = null, takenNames: string[] = []): Workflow {
  return { id: `w-${Date.now().toString(36)}-${counter++}`, name: fleet ? defaultWorkflowName(fleet, takenNames) : '', fleet, nodes: [createStart(), createNode('end')] };
}
/** Kept workflows are the ones the user published or saved as a draft; everything else is thrown away when left. */
export const isKept = (w: Workflow) => !!(w.published || w.saved);
/** A workflow that has no fleet and nothing built yet can be reused instead of creating another blank one. */
export const isBlankDraft = (w: Workflow) => w.fleet === null && w.nodes.length === 2;
