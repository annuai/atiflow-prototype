import type { Material, MaterialGroup } from '@/features/master-data/model/types';
import type { WfNode, Workflow } from '@/features/workflow-builder/model/types';
import type { RequestableItem } from './types';

/** The request type a workflow must have to be started from the operator tablet. */
export const TABLET_REQUEST = 'Tablet';

/** Every node of a flow, branches included, in reading order. */
export function flatten(nodes: WfNode[]): WfNode[] { return nodes.flatMap((n) => [n, ...(n.br ? [...flatten(n.br.t), ...flatten(n.br.o)] : [])]); }
/** A workflow with a Confirm step makes a request wait for approval. */
export const needsApproval = (nodes: WfNode[]): boolean => flatten(nodes).some((n) => n.t === 'confirm');

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

/** Who a workflow is for: the Start step's User IDs and its request type. */
export function startOf(nodes: WfNode[]): { users: string[]; request: string } {
  const s = nodes.find((n) => n.t === 'start'); const u = s?.f.user;
  return { users: (Array.isArray(u) ? u : [u as string]).filter(Boolean), request: (s?.f.request as string) ?? '' };
}

export interface Operator { username: string; /** fleet ids the person sees */ fleets: string[] }
/**
 * Workflows an operator can request from: published, started from a Tablet, in a fleet assigned to the operator AND listing the operator's username.
 * `fleetIdOf` turns the workflow's fleet name into the fleet id the assignment uses.
 */
export function visibleWorkflows(workflows: Workflow[], who: Operator, fleetIdOf: (fleetName: string) => string | undefined): Workflow[] {
  return workflows.filter((w) => {
    if (!w.published || !w.fleet) return false; const id = fleetIdOf(w.fleet); if (!id || !who.fleets.includes(id)) return false;
    const s = startOf(w.nodes); return s.request === TABLET_REQUEST && s.users.includes(who.username);
  });
}

/** The materials an operator can request: every Material step of a visible workflow, with the name and group from Master Data. A code that is not in Master Data any more is left out. */
export function requestableItems(workflows: Workflow[], who: Operator, fleetIdOf: (n: string) => string | undefined, fleetLiveOf: (n: string) => string, materials: Material[], groups: MaterialGroup[]): RequestableItem[] {
  const out: RequestableItem[] = [];
  for (const w of visibleWorkflows(workflows, who, fleetIdOf)) {
    const { legs, loadFrom } = workflowLegs(w.nodes); if (!legs.length) continue;
    const approval = needsApproval(w.nodes);
    for (const n of w.nodes) {
      if (n.t !== 'material') continue; const code = n.f.code as string; const m = materials.find((x) => x.code === code); if (!code || !m) continue;
      const qty = Math.max(1, parseInt(String(n.f.qty), 10) || 1);
      out.push({ key: `${w.id}:${n.id}`, workflowId: w.id, workflowName: w.name, fleet: w.fleet!, fleetLive: fleetLiveOf(w.fleet!), code, name: m.name, group: groups.find((g) => g.id === m.group)?.name ?? '', qty, qtyEditable: !!n.f.fromTablet, needsApproval: approval, legs, loadFrom });
    }
  }
  return out;
}
