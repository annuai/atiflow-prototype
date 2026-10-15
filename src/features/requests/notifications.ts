import type { NewNotification, NotificationSource } from '@/features/notifications/types';
import type { PublicUser } from '@/features/auth/types';
import { canApprove, currentStep } from './model/rules';
import { requestsStore } from './model/store';
import type { StatusEvent, TripRequest } from './model/types';

/** The words of one status change, for the person who made the request. */
function updateText(r: TripRequest, e: StatusEvent): { title: string; body: string; level: NewNotification['level'] } {
  const what = `${r.name} ×${r.qty}`; const ref = r.tripId ? `${r.tripId} · ${r.id}` : r.id;
  switch (e.status) {
    case 'approved': return e.by === 'Fleet' ? { title: `${what} is waiting for a robot again`, body: `${ref} · ${e.note ?? ''}`, level: 'info' } : { title: `${what} was approved`, body: `${ref}${e.by && r.needsApproval ? ` · by ${e.by}` : ''} · waiting for a robot`, level: 'info' };
    case 'rejected': return { title: `${what} was rejected`, body: `${ref}${e.by ? ` · by ${e.by}` : ''}${e.note ? ` · ${e.note}` : ''}`, level: 'warn' };
    case 'ongoing': return { title: `${what} is on its way`, body: `${ref}${r.robotId ? ` · ${r.robotId}` : ''}`, level: 'info' };
    case 'completed': return { title: `${what} was delivered`, body: `${ref}`, level: 'success' };
    case 'cancelled': return { title: `${what} was cancelled`, body: r.id, level: 'info' };
    case 'failed': return { title: `${what} could not be delivered`, body: `${ref}${e.note ? ` · ${e.note}` : ''}`, level: 'critical' };
    case 'pending': return { title: `${what}: ${e.note ?? 'an approval step is done'}`, body: ref, level: 'info' };
    default: return { title: what, body: r.id, level: 'info' };
  }
}

/** Everything the notifications of an operator are made of (pure): status changes of their own requests, and requests waiting for their approval. */
export function requestNotifications(requests: TripRequest[], user: PublicUser): NewNotification[] {
  const out: NewNotification[] = [];
  for (const r of requests) {
    if (r.requestedBy === user.username) r.history.forEach((e, i) => { if (i === 0) return; const t = updateText(r, e);       // the first event is the request itself
      out.push({ id: `req:${r.id}:${i}`, kind: 'trip', level: t.level, title: t.title, body: t.body, at: e.at, actions: [{ kind: 'requests' }] }); });
    else if (canApprove(r, user)) { const step = currentStep(r)!; const n = r.approvals.indexOf(step) + 1;
      out.push({ id: `appr:${r.id}:${n}`, kind: 'approval', level: 'warn', title: `Approval needed: ${r.name} ×${r.qty}`, body: `${r.tripId} · ${r.id}${r.approvals.length > 1 ? ` (${n} of ${r.approvals.length})` : ''} · requested by ${r.requestedByName}`, at: r.history[r.history.length - 1]?.at ?? r.createdAt, actions: [{ kind: 'approvals' }] }); }
  }
  return out;
}

/** Operators: trip status updates for their requests and requests that wait for them. Past events are delivered when the person signs in; the center never shows one twice. */
export const requestUpdatesSource = (): NotificationSource => ({
  start(emit, user) {
    const sent = new Set<string>();
    const run = (requests: TripRequest[]) => { const fresh = requestNotifications(requests, user).filter((n) => !sent.has(n.id)); fresh.forEach((n) => sent.add(n.id)); if (fresh.length) emit(fresh); };
    run(requestsStore.getState().requests); return requestsStore.subscribe((s, p) => { if (s.requests !== p.requests) run(s.requests); });
  },
});
