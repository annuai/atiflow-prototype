import type { RequestStatus, TripRequest } from './types';

/** One approval decision: a Confirm step approved, or the request rejected at the step it was waiting at. */
export interface Decision {
  key: string; requestId: string; tripId: string; name: string; code: string; qty: number; requestedByName: string;
  stationId: string; outcome: 'approved' | 'rejected'; by: string; at: number; note?: string;
  /** Where the request stands now (it may have been delivered or cancelled since). */
  status: RequestStatus; /** "2 of 3" for a request with several Confirm steps */ step?: string;
}
/**
 * The approval history (pure): every approved step and every rejection, newest first, kept for decisions taken at one of `stations` or by `by` (a name).
 * It is read from the requests themselves, so it is always as complete as the requests are.
 */
export function decisions(requests: TripRequest[], who: { stations: string[]; name: string }): Decision[] {
  const out: Decision[] = []; const mine = (station: string, by: string) => who.stations.includes(station) || by === who.name;
  for (const r of requests) {
    const base = { requestId: r.id, tripId: r.tripId, name: r.name, code: r.code, qty: r.qty, requestedByName: r.requestedByName, status: r.status };
    r.approvals.forEach((a, i) => { if (a.by && a.at !== undefined && mine(a.stationId, a.by)) out.push({ ...base, key: `${r.id}:${i}`, stationId: a.stationId, outcome: 'approved', by: a.by, at: a.at, step: r.approvals.length > 1 ? `${i + 1} of ${r.approvals.length}` : undefined }); });
    const rej = r.history.find((e) => e.status === 'rejected' && e.by && e.by !== 'Fleet'); const waitedAt = r.approvals.find((a) => !a.by)?.stationId ?? r.legs[0] ?? '';
    if (rej && mine(waitedAt, rej.by!)) out.push({ ...base, key: `${r.id}:rejected`, stationId: waitedAt, outcome: 'rejected', by: rej.by!, at: rej.at, note: rej.note, step: undefined });
  }
  return out.sort((a, b) => b.at - a.at);
}
