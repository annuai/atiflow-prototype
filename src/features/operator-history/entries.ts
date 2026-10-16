import { decisions, type RequestStatus, type TripRequest } from '@/features/requests';
import { type BookedTrip } from '@/features/bookings';
import { t } from './text';

export type HistoryKind = 'request' | 'approval' | 'trip';
export interface HistoryEntry {
  key: string;
  kind: HistoryKind;
  /** when it last changed (epoch ms) */ at: number;
  title: string;
  subtitle: string;
  tripId: string;
  /** where the request / trip stands now */ status: RequestStatus;
  /** only for approvals: what the person decided */ outcome?: 'approved' | 'rejected';
  /** a booked trip of the person, with the id to cancel it by */ bookingId?: string;
  /** the request behind the entry (a request, a called saved trip or an approval): opens its details; only the person's own can be cancelled */ requestId?: string;
}
/**
 * The consolidated history of one person (pure): the requests they made, the approvals and rejections they made (or could have made), and the trips they booked, newest first.
 * Everything is read from the stores' own records, so it is as complete as they are. The Approve page keeps its own approval history.
 */
export function historyEntries(
  requests: TripRequest[],
  bookings: BookedTrip[],
  me: { username: string; name: string },
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const r of requests)
    if (r.requestedBy === me.username)
      out.push({
        key: `req:${r.id}`,
        kind: r.kind === 'route' ? 'trip' : 'request', // a saved trip that was called is a booked trip, not a material request
        at: r.history.at(-1)?.at ?? r.createdAt,
        title: r.qty > 0 ? `${r.name} ×${r.qty}` : r.name,
        subtitle: `${r.tripId} · ${r.code ? `${r.code} · ` : ''}${r.workflowName}`,
        tripId: r.tripId,
        status: r.status,
        requestId: r.id,
      });
  for (const d of decisions(requests, me))
    out.push({
      key: `dec:${d.key}`,
      kind: 'approval',
      at: d.at,
      title: t.history.decisionTitle(t.history[d.outcome], d.qty > 0 ? `${d.name} ×${d.qty}` : d.name),
      subtitle: t.history.decisionSubtitle(d.tripId, d.requestedByName, d.step ?? '', d.note ?? ''),
      tripId: d.tripId,
      status: d.status,
      outcome: d.outcome,
      requestId: d.requestId,
    });
  for (const t of bookings)
    if (t.bookedBy === me.username)
      out.push({
        key: `trip:${t.id}`,
        kind: 'trip',
        at: t.history.at(-1)?.at ?? t.createdAt,
        title: `${t.fromName} → ${t.toName}`,
        subtitle: `${t.tripId} · ${t.robotLabel}${t.robotId ? ` · ${t.robotId}` : ''}`,
        tripId: t.tripId,
        status: t.status,
        bookingId: t.id,
      });
  return out.sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
}
