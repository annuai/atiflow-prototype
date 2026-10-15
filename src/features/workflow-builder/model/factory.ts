import { NODE_TYPES } from './registry';
import type { FieldValue, NodeTypeId, WfNode } from './types';

let uid = 1;
export const newId = () => 'n' + uid++;
/** After loading saved workflows, continue numbering above every existing id. */
export function syncIds(nodes: WfNode[]) {
  const walk = (list: WfNode[]) =>
    list.forEach((n) => {
      const k = +n.id.slice(1);
      if (k >= uid) uid = k + 1;
      if (n.br) {
        walk(n.br.t);
        walk(n.br.o);
      }
    });
  walk(nodes);
}

/** Create a node with the registry defaults. If Logic always starts with one station in each branch. */
export function createNode(t: NodeTypeId, f?: Record<string, FieldValue>): WfNode {
  const n: WfNode = { id: newId(), t, f: { ...(NODE_TYPES[t].defaults ?? {}), ...(f ?? {}) } };
  if (t === 'logic')
    n.br = {
      t: [createNode('station', { action: 'Pick Up', station: ['STA-103'] })],
      o: [createNode('station', { action: 'Pick Up', station: ['STA-102'] })],
    };
  return n;
}
export const createStart = (f?: Record<string, FieldValue>) =>
  createNode('start', { trigger: 'Manual', robot: 'Sherpa XT Lite', request: 'Tablet', users: [], ...f });
