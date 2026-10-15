import { flatten, requestType, TABLET_REQUEST } from '@/features/requests';
import type { Problem } from './tree';
import type { WfNode } from './types';
import { copy } from '../copy';

/**
 * Publish gate. Returns the first problem, or null when the workflow may be published. A workflow started from the Tablet needs users in its Start step (who may request) and users on every
 * Tablet Confirm step (who approve), or nobody could request or approve; and a Confirm step must have someone other than a requester to approve (a requester never approves their own request).
 */
export function publishProblem(nodes: WfNode[]): Problem | null {
  if (nodes.length < 3) return { title: copy.publishChecks.noStepsTitle, body: copy.publishChecks.noStepsBody };
  if (nodes.some((n) => n.br && (!n.br.t.length || !n.br.o.length)))
    return { title: copy.publishChecks.emptyBranchTitle, body: copy.publishChecks.emptyBranchBody };
  if (requestType(nodes) === TABLET_REQUEST) {
    const start = nodes.find((n) => n.t === 'start');
    const requesters = (Array.isArray(start?.f.users) ? start!.f.users : []) as string[];
    if (!requesters.length)
      return { title: copy.publishChecks.noRequestersTitle, body: copy.publishChecks.noRequestersBody };
    for (const n of flatten(nodes).filter((x) => x.t === 'confirm' && x.f.op === 'Tablet')) {
      const approvers = (Array.isArray(n.f.users) ? n.f.users : []) as string[];
      if (!approvers.length)
        return { title: copy.publishChecks.noApproverTitle, body: copy.publishChecks.noApproverBody };
      if (approvers.length === 1 && requesters.includes(approvers[0]))
        return {
          title: copy.publishChecks.selfApproverTitle(approvers[0]),
          body: copy.publishChecks.selfApproverBody,
        };
    }
  }
  return null;
}
