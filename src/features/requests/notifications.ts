import { can, fleetScope } from '@/features/access';
import { datasetStore } from '@/data/dataset';
import type { NewNotification, NotificationSource } from '@/features/notifications/types';
import type { PublicUser } from '@/features/auth/types';
import { requestsStore } from './model/store';
import { STATUS } from './model/status';
import type { StatusEvent, TripRequest } from './model/types';

/** The words of one status change, for the person who made the request. */
function updateText(r: TripRequest, e: StatusEvent): { title: string; body: string; level: NewNotification['level'] } {
  const what = `${r.name} ×${r.qty}`; const trip = r.tripId ? ` · ${r.tripId}` : '';
  switch (e.status) {
    case 'approved': return e.by === 'Fleet' ? { title: `${what} is waiting for a robot again`, body: `${r.id} · ${e.note ?? ''}`, level: 'info' } : { title: `${what} was approved`, body: `${r.id}${e.by && r.needsApproval ? ` · by ${e.by}` : ''} · waiting for a robot`, level: 'info' };
    case 'rejected': return { title: `${what} was rejected`, body: `${r.id}${e.by ? ` · by ${e.by}` : ''}${e.note ? ` · ${e.note}` : ''}`, level: 'warn' };
    case 'ongoing': return { title: `${what} is on its way`, body: `${r.id}${trip}${r.robotId ? ` · ${r.robotId}` : ''}`, level: 'info' };
    case 'completed': return { title: `${what} was delivered`, body: `${r.id}${trip}`, level: 'success' };
    case 'cancelled': return { title: `${what} was cancelled`, body: r.id, level: 'info' };
    case 'failed': return { title: `${what} could not be delivered`, body: `${r.id}${e.note ? ` · ${e.note}` : ''}`, level: 'critical' };
    default: return { title: `${what}: ${STATUS[e.status].label}`, body: r.id, level: 'info' };
  }
}

/** Everything the notifications of an operator are made of (pure): status changes of their own requests, and requests waiting for their approval. */
export function requestNotifications(requests: TripRequest[], user: PublicUser): NewNotification[] {
  const out: NewNotification[] = []; const all = datasetStore.getState().fleets.map((f) => f.id); const mine = fleetScope(user, all); const approver = can(user, 'operator.approve');
  for (const r of requests) {
    if (r.requestedBy === user.username) r.history.forEach((e, i) => { if (i === 0) return; const t = updateText(r, e);       // the first event is the request itself
      out.push({ id: `req:${r.id}:${i}`, kind: 'trip', level: t.level, title: t.title, body: t.body, at: e.at, actions: [{ kind: 'requests' }] }); });
    else if (approver && r.status === 'pending') { const fleetId = datasetStore.getState().fleets.find((f) => f.name === r.fleet)?.id; if (!fleetId || (mine && !mine.includes(fleetId))) continue;
      out.push({ id: `appr:${r.id}`, kind: 'approval', level: 'warn', title: `Approval needed: ${r.name} ×${r.qty}`, body: `${r.id} · requested by ${r.requestedByName} · ${r.fleet}`, at: r.createdAt, actions: [{ kind: 'approvals' }] }); }
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
