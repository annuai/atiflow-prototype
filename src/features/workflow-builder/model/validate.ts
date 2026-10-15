import { flatten, requestType, TABLET_REQUEST } from '@/features/requests/model/catalog';
import type { Problem } from './tree';
import type { WfNode } from './types';

/**
 * Publish gate. Returns the first problem, or null when the workflow may be published. A workflow started from the Tablet needs users in its Start step (who may request) and users on every
 * Tablet Confirm step (who approve), or nobody could request or approve; and a Confirm step must have someone other than a requester to approve (a requester never approves their own request).
 */
export function publishProblem(nodes: WfNode[]): Problem | null {
  if (nodes.length < 3) return { title: 'Add at least one step before publishing', body: 'Drag a node between Start and End.' };
  if (nodes.some((n) => n.br && (!n.br.t.length || !n.br.o.length))) return { title: 'An If Logic branch is empty', body: 'Give both TRUE and OTHERWISE at least one node before publishing.' };
  if (requestType(nodes) === TABLET_REQUEST) {
    const start = nodes.find((n) => n.t === 'start'); const requesters = (Array.isArray(start?.f.users) ? start!.f.users : []) as string[];
    if (!requesters.length) return { title: 'Add the users who can request', body: 'A workflow started from the Tablet needs at least one user in its Start step.' };
    for (const n of flatten(nodes).filter((x) => x.t === 'confirm' && x.f.op === 'Tablet')) {
      const approvers = (Array.isArray(n.f.users) ? n.f.users : []) as string[];
      if (!approvers.length) return { title: 'A Tablet Confirm step needs an approval user', body: 'Choose who approves the request at this step.' };
      if (approvers.length === 1 && requesters.includes(approvers[0])) return { title: `${approvers[0]} is the only approver and can also request`, body: 'A requester cannot approve their own request. Add another approval user, or remove this user from the Start step.' };
    }
  }
  return null;
}
