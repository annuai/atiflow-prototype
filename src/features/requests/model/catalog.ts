import { ROBOT_TYPES } from '@/data/robotTypes';
import type { Material, MaterialGroup } from '@/features/master-data/model/types';
import type { WfNode, Workflow } from '@/features/workflow-builder/model/types';
import type { RequestableItem } from './types';

/** The request type a workflow must have to be started from the operator tablet. */
export const TABLET_REQUEST = 'Tablet';

/** Every node of a flow, branches included, in reading order. */
export function flatten(nodes: WfNode[]): WfNode[] { return nodes.flatMap((n) => [n, ...(n.br ? [...flatten(n.br.t), ...flatten(n.br.o)] : [])]); }
/** The approval users of each Tablet Confirm step, in order: each step is one approval, given by any one of its users. (Other operations are confirmed by the robot or its button, not in the app.) */
export const confirmApprovers = (nodes: WfNode[]): string[][] => flatten(nodes).filter((n) => n.t === 'confirm' && n.f.op === 'Tablet').map((n) => (Array.isArray(n.f.users) ? (n.f.users as string[]) : []));
/** A workflow with a Tablet Confirm step makes a request wait for approval. */
export const needsApproval = (nodes: WfNode[]): boolean => confirmApprovers(nodes).length > 0;
/** The users the Start step lists: they may request from this workflow. */
export const requesters = (nodes: WfNode[]): string[] => { const u = nodes.find((n) => n.t === 'start')?.f.users; return Array.isArray(u) ? (u as string[]) : []; };

/**
 * The stations a trip of this workflow drives to (the Station steps of the main flow, in order) and the leg from which the load is carried:
 * after the first Pick Up the robot is loaded; with no Pick Up the load is carried from the start. Branch stations (If Logic) are not part of a request.
 */
export function workflowLegs(nodes: WfNode[]): { legs: string[]; loadFrom: number } {
  const legs: string[] = []; let loadFrom = -1;
  for (const n of nodes) {
    if (n.t !== 'station') continue; const st = Array.isArray(n.f.station) ? n.f.station[0] : (n.f.station as string); if (!st) continue;
    if (legs[legs.length - 1] === st) continue;                       // the same station twice in a row is one stop
    legs.push(st); if (loadFrom < 0 && n.f.action === 'Pick Up') loadFrom = legs.length;
  }
  return { legs, loadFrom: loadFrom < 0 ? 0 : Math.min(loadFrom, Math.max(0, legs.length - 1)) };
}

/** How a workflow is started (the Start step's Request Type). */
export const requestType = (nodes: WfNode[]): string => (nodes.find((n) => n.t === 'start')?.f.request as string) ?? '';

export interface Operator { username: string; /** fleet ids the person sees */ fleets: string[] }
/**
 * Workflows an operator can request from: published, started from a Tablet, in a fleet assigned to the operator, and listing the operator in its Start step.
 * `fleetIdOf` turns the workflow's fleet name into the fleet id the assignment uses.
 */
export function visibleWorkflows(workflows: Workflow[], who: Operator, fleetIdOf: (fleetName: string) => string | undefined): Workflow[] {
  return workflows.filter((w) => {
    if (!w.published || !w.fleet) return false; const id = fleetIdOf(w.fleet); if (!id || !who.fleets.includes(id)) return false;
    return requestType(w.nodes) === TABLET_REQUEST && requesters(w.nodes).includes(who.username);
  });
}

/** A saved route (Ati's "Tier 0" operation, a word operators never see): a workflow with no Material step, only a robot visiting stations. */
export const isRouteWorkflow = (nodes: WfNode[]): boolean => !flatten(nodes).some((n) => n.t === 'material');
/** The catalog id of a robot type named on the Start step (undefined for a name that is not in the catalog: any robot of the fleet may do it). */
export const robotTypeIdOf = (label: unknown): string | undefined => ROBOT_TYPES.find((t) => t.label === label)?.id;

/**
 * The simple trips an operator can run: the visible workflows (same rules as materials: published, Tablet, their fleet, listed in Start) that have no Material step and visit at least one station; every other node is allowed.
 * Each is an item like a material but without quantity; its approvals are the Tablet Confirm steps, as for materials.
 */
export function routeItems(workflows: Workflow[], who: Operator, fleetIdOf: (n: string) => string | undefined, fleetLiveOf: (n: string) => string): RequestableItem[] {
  const out: RequestableItem[] = [];
  for (const w of visibleWorkflows(workflows, who, fleetIdOf)) {
    if (!isRouteWorkflow(w.nodes)) continue; const { legs } = workflowLegs(w.nodes); if (legs.length < 1) continue;
    const approvalUsers = confirmApprovers(w.nodes); const robot = w.nodes.find((n) => n.t === 'start')?.f.robot;
    out.push({ key: `route:${w.id}`, workflowId: w.id, workflowName: w.name, fleet: w.fleet!, fleetLive: fleetLiveOf(w.fleet!), code: '', name: w.name, group: '', qty: 1, qtyEditable: false, approvalUsers, needsApproval: approvalUsers.length > 0, legs, loadFrom: legs.length, kind: 'route', robotType: robotTypeIdOf(robot) });
  }
  return out;
}

/** The materials an operator can request: every Material step of a visible workflow, with the name and group from Master Data. A code that is not in Master Data any more is left out. */
export function requestableItems(workflows: Workflow[], who: Operator, fleetIdOf: (n: string) => string | undefined, fleetLiveOf: (n: string) => string, materials: Material[], groups: MaterialGroup[]): RequestableItem[] {
  const out: RequestableItem[] = [];
  for (const w of visibleWorkflows(workflows, who, fleetIdOf)) {
    const { legs, loadFrom } = workflowLegs(w.nodes); if (!legs.length) continue;
    const approvalUsers = confirmApprovers(w.nodes);
    for (const n of w.nodes) {
      if (n.t !== 'material') continue; const code = n.f.code as string; const m = materials.find((x) => x.code === code); if (!code || !m) continue;
      const qty = Math.max(1, parseInt(String(n.f.qty), 10) || 1);
      out.push({ key: `${w.id}:${n.id}`, workflowId: w.id, workflowName: w.name, fleet: w.fleet!, fleetLive: fleetLiveOf(w.fleet!), code, name: m.name, group: groups.find((g) => g.id === m.group)?.name ?? '', qty, qtyEditable: !!n.f.fromTablet, approvalUsers, needsApproval: approvalUsers.length > 0, legs, loadFrom });
    }
  }
  return out;
}
