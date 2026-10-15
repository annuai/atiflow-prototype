import { type NewNotification, type NotificationSource } from '@/features/notifications';
import { type PublicUser } from '@/features/auth';
import { t } from './text';
import { canApprove, currentStep } from './model/rules';
import { requestsStore } from './model/store';
import type { StatusEvent, TripRequest } from './model/types';

/** The words of one status change, for the person who made the request. */
function updateText(r: TripRequest, e: StatusEvent): { title: string; body: string; level: NewNotification['level'] } {
  const what = r.qty > 0 ? `${r.name} ×${r.qty}` : r.name;
  const ref = r.tripId ? `${r.tripId} · ${r.id}` : r.id;
  const n = t.requests.notify;
  switch (e.status) {
    case 'approved':
      return e.by === 'Fleet'
        ? { ...n.waitingAgain(what, ref, e.note ?? ''), level: 'info' }
        : { ...n.approved(what, ref, e.by && r.needsApproval ? e.by : ''), level: 'info' };
    case 'rejected':
      return { ...n.rejected(what, ref, e.by ?? '', e.note ?? ''), level: 'warn' };
    case 'ongoing':
      return { ...n.ongoing(what, ref, r.robotId ?? ''), level: 'info' };
    case 'completed':
      return { ...n.completed(what, ref), level: 'success' };
    case 'cancelled':
      return { ...n.cancelled(what, r.id), level: 'info' };
    case 'failed':
      return { ...n.failed(what, ref, e.note ?? ''), level: 'critical' };
    case 'pending':
      return { ...n.stepDone(what, ref, e.note ?? ''), level: 'info' };
    default:
      return { title: what, body: r.id, level: 'info' };
  }
}

/** Everything the notifications of an operator are made of (pure): status changes of their own requests, and requests waiting for their approval. */
export function requestNotifications(requests: TripRequest[], user: PublicUser): NewNotification[] {
  const out: NewNotification[] = [];
  for (const r of requests) {
    if (r.requestedBy === user.username)
      r.history.forEach((e, i) => {
        if (i === 0) return;
        const u = updateText(r, e); // the first event is the request itself
        out.push({
          id: `req:${r.id}:${i}`,
          kind: 'trip',
          level: u.level,
          title: u.title,
          body: u.body,
          at: e.at,
          actions: [{ kind: 'requests' }],
        });
      });
    else if (canApprove(r, user)) {
      const step = currentStep(r)!;
      const n = r.approvals.indexOf(step) + 1;
      out.push({
        id: `appr:${r.id}:${n}`,
        kind: 'approval',
        level: 'warn',
        ...t.requests.notify.approvalNeeded(
          r.qty > 0 ? `${r.name} ×${r.qty}` : r.name,
          r.tripId,
          r.id,
          n,
          r.approvals.length,
          r.requestedByName,
        ),
        at: r.history[r.history.length - 1]?.at ?? r.createdAt,
        actions: [{ kind: 'approvals' }],
      });
    }
  }
  return out;
}

/** Operators: trip status updates for their requests and requests that wait for them. Past events are delivered when the person signs in; the center never shows one twice. */
export const requestUpdatesSource = (): NotificationSource => ({
  start(emit, user) {
    const sent = new Set<string>();
    const run = (requests: TripRequest[]) => {
      const fresh = requestNotifications(requests, user).filter((n) => !sent.has(n.id));
      fresh.forEach((n) => sent.add(n.id));
      if (fresh.length) emit(fresh);
    };
    run(requestsStore.getState().requests);
    return requestsStore.subscribe((s, p) => {
      if (s.requests !== p.requests) run(s.requests);
    });
  },
});
