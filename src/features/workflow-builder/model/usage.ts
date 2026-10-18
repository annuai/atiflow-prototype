import type { WfNode, Workflows } from './types';
import type { FleetId } from '@/data/fleets';

const walk = (nodes: WfNode[], visit: (n: WfNode) => void) =>
  nodes.forEach((n) => {
    visit(n);
    if (n.br) {
      walk(n.br.t, visit);
      walk(n.br.o, visit);
    }
  });

/** Ids of the fleets that have a workflow using a material code (a Material node or an If Logic condition, branches included). */
export function fleetsUsingMaterial(workflows: Workflows, code: string): FleetId[] {
  const out = new Set<FleetId>();
  Object.values(workflows).forEach((w) => {
    if (!w.fleet) return;
    walk(w.nodes, (n) => {
      if ((n.t === 'material' && n.f.code === code) || (n.t === 'logic' && n.f.material === code)) out.add(w.fleet!);
    });
  });
  return [...out];
}
