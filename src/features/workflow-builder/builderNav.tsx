import { NODE_TYPES } from './model/registry';
import { wfStore } from './model/store';
import type { SearchHit } from '@/shell/types';
import type { WfNode } from './model/types';

const flat = (nodes: WfNode[]): WfNode[] =>
  nodes.flatMap((n) => [n, ...(n.br ? [...flat(n.br.t), ...flat(n.br.o)] : [])]);
const summary = (n: WfNode) =>
  Object.values(n.f)
    .filter((v) => typeof v !== 'boolean')
    .map((v) => (Array.isArray(v) ? v.join(', ') : String(v)))
    .slice(0, 2)
    .join(' · ');

/** Search hits for the nodes of the open workflow (only meaningful on the Workflow Builder page). */
export function builderNodeHits(q: string): SearchHit[] {
  const ql = q.toLowerCase();
  return flat(wfStore.getState().nodes())
    .filter((n) => (NODE_TYPES[n.t].label + ' ' + summary(n)).toLowerCase().includes(ql))
    .slice(0, 6)
    .map((n) => ({
      kind: 'Node',
      title: NODE_TYPES[n.t].label,
      sub: summary(n),
      go: () => window.dispatchEvent(new CustomEvent('wf:reveal', { detail: n.id })),
    }));
}
