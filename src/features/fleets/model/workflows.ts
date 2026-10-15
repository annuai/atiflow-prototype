import { type WfNode, type Workflow } from '@/features/workflow-builder';

export interface WorkflowRow {
  id: string;
  name: string;
  nodes: number;
  materials: string[];
  trigger: string;
  published: boolean;
}

const walk = (nodes: WfNode[], visit: (n: WfNode) => void) =>
  nodes.forEach((n) => {
    visit(n);
    if (n.br) {
      walk(n.br.t, visit);
      walk(n.br.o, visit);
    }
  });

/** One row of the fleet's Workflows tab, derived from a builder workflow (name, size, materials used, start trigger, published?). */
export function workflowSummary(w: Workflow): WorkflowRow {
  const materials = new Set<string>();
  let trigger = '';
  let count = 0;
  walk(w.nodes, (n) => {
    count++;
    if (n.t === 'material' && n.f.code) materials.add(String(n.f.code));
    if (n.t === 'logic' && n.f.material) materials.add(String(n.f.material));
    if (n.t === 'start') trigger = String(n.f.request ?? n.f.trigger ?? '');
  });
  return {
    id: w.id,
    name: w.name,
    nodes: count,
    materials: [...materials],
    trigger: trigger || '—',
    published: !!w.published,
  };
}
