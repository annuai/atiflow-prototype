import { createNode, createStart } from './factory';
import { defaultWorkflowName } from './names';
import type { Workflow, Workflows } from './types';
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
  return Object.fromEntries(list.map((w) => [w.id, w]));
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
