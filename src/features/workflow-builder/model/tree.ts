import { NODE_TYPES } from './registry';
import type { ListKey, NodeTypeId, WfNode } from './types';
import { copy } from '../copy';

export interface Located {
  list: WfNode[];
  i: number;
  key: ListKey;
  node: WfNode;
}
export interface Problem {
  title: string;
  body: string;
}

export const listByKey = (nodes: WfNode[], key: ListKey): WfNode[] | null => {
  if (key === 'main') return nodes;
  const [id, b] = key.split(':');
  const n = nodes.find((x) => x.id === id);
  return n?.br ? n.br[b as 't' | 'o'] : null;
};
export function locate(nodes: WfNode[], id: string): Located | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { list: nodes, i, key: 'main', node: nodes[i] };
    const br = nodes[i].br;
    if (br)
      for (const b of ['t', 'o'] as const) {
        const j = br[b].findIndex((x) => x.id === id);
        if (j >= 0) return { list: br[b], i: j, key: `${nodes[i].id}:${b}`, node: br[b][j] };
      }
  }
  return null;
}
/** Insert position in the main flow: after Start, before End. */
export function clampMain(nodes: WfNode[], i: number) {
  const hasEnd = nodes.length > 0 && nodes[nodes.length - 1].t === 'end';
  return Math.max(1, Math.min(i, hasEnd ? nodes.length - 1 : nodes.length));
}

/** Placement rules shared by click-to-add, drag-to-add and reorder. Returns a user-facing problem or null. */
export function placementProblem(nodes: WfNode[], t: NodeTypeId | 'aiot', key: ListKey): Problem | null {
  if (t === 'aiot') return { title: copy.problems.aiotTitle, body: copy.problems.aiotBody };
  if (t === 'end' && key !== 'main') return { title: copy.problems.endMain, body: '' };
  if (t === 'logic' && key !== 'main') return { title: copy.problems.noNestTitle, body: copy.problems.noNestBody };
  if (t === 'end' && nodes.some((n) => n.t === 'end'))
    return { title: copy.problems.endExistsTitle, body: copy.problems.endExistsBody };
  return null;
}

const clone = (nodes: WfNode[]) => structuredClone(nodes);
export interface EditResult {
  nodes: WfNode[];
  problem?: Problem;
}

export function insertNode(nodes: WfNode[], node: WfNode, key: ListKey, at?: number): EditResult {
  const bad = placementProblem(nodes, node.t, key);
  if (bad) return { nodes, problem: bad };
  const next = clone(nodes);
  const list = listByKey(next, key);
  if (!list) return { nodes };
  const idx =
    key === 'main'
      ? node.t === 'end'
        ? list.length
        : clampMain(next, at ?? list.length)
      : Math.max(0, Math.min(at ?? list.length, list.length));
  list.splice(idx, 0, structuredClone(node));
  return { nodes: next };
}
export function removeNode(nodes: WfNode[], id: string): EditResult {
  const loc = locate(nodes, id);
  if (!loc) return { nodes };
  if (NODE_TYPES[loc.node.t].fixed)
    return {
      nodes,
      problem: {
        title: copy.problems.fixedTitle(NODE_TYPES[loc.node.t].label),
        body: copy.problems.fixedBody,
      },
    };
  const next = clone(nodes);
  const l = locate(next, id)!;
  l.list.splice(l.i, 1);
  return { nodes: next };
}
export function moveNode(nodes: WfNode[], id: string, key: ListKey, at: number): EditResult {
  const loc = locate(nodes, id);
  if (!loc) return { nodes };
  if (NODE_TYPES[loc.node.t].fixed) return { nodes };
  const bad = placementProblem(
    nodes.filter((n) => n.id !== id || n.t !== 'end'),
    loc.node.t,
    key,
  );
  if (bad) return { nodes, problem: bad };
  const next = clone(nodes);
  const l = locate(next, id)!;
  const [n] = l.list.splice(l.i, 1);
  const list = listByKey(next, key);
  if (!list) return { nodes };
  let to = l.key === key && at > l.i ? at - 1 : at;
  to = key === 'main' ? clampMain(next, to) : Math.max(0, Math.min(to, list.length));
  list.splice(to, 0, n);
  return { nodes: next };
}
export function updateField(
  nodes: WfNode[],
  id: string,
  key: string,
  value: WfNode['f'][string],
  idx?: number,
): WfNode[] {
  const next = clone(nodes);
  const l = locate(next, id);
  if (!l) return nodes;
  if (idx != null) {
    const cur = l.node.f[key];
    const arr = Array.isArray(cur) ? [...cur] : [cur as string];
    arr[idx] = value as string;
    l.node.f[key] = arr;
  } else l.node.f[key] = value;
  return next;
}
/** Total node count shown in the header badge (main flow + branch nodes). */
export const countNodes = (nodes: WfNode[]): number =>
  nodes.reduce((a, n) => a + 1 + (n.br ? n.br.t.length + n.br.o.length : 0), 0);
