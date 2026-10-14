import { flatten, requestType, TABLET_REQUEST } from '@/features/requests/model/catalog';
import type { Problem } from './tree';
import type { WfNode } from './types';

/**
 * Publish gate. Returns the first problem, or null when the workflow may be published. `approversAt(station)` = the usernames of the operators mapped to a station:
 * a workflow started from the Tablet needs a station on every Confirm step and an operator mapped to each of them, or its requests would wait for nobody.
 */
export function publishProblem(nodes: WfNode[], approversAt?: (stationId: string) => string[]): Problem | null {
  if (nodes.length < 3) return { title: 'Add at least one step before publishing', body: 'Drag a node between Start and End.' };
  if (nodes.some((n) => n.br && (!n.br.t.length || !n.br.o.length))) return { title: 'An If Logic branch is empty', body: 'Give both TRUE and OTHERWISE at least one node before publishing.' };
  if (requestType(nodes) === TABLET_REQUEST) {
    const confirms = flatten(nodes).filter((n) => n.t === 'confirm');
    if (confirms.some((n) => !n.f.station)) return { title: 'A Confirm step needs an approval station', body: 'Choose the station where the request is approved: the operators mapped to it approve.' };
    if (approversAt) for (const n of confirms) { const st = n.f.station as string; if (!approversAt(st).length) return { title: `Nobody is mapped to ${st}`, body: 'Map an operator to this station on the Users page, or move the Confirm step to a station that has one.' }; }
  }
  return null;
}
