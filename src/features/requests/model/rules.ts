import { STATUS } from './status';
import type { RequestStatus, TripRequest } from './types';

/** The rules of who may do what with a request (pure). */
export interface Person { username: string; /** fleet ids the person sees */ fleets: string[] }
/** A request is approved by another operator who works on its fleet: never by the person who asked. */
export const canApprove = (r: TripRequest, who: Person, fleetIdOf: (fleetName: string) => string | undefined): boolean => {
  const id = fleetIdOf(r.fleet); return r.status === 'pending' && r.requestedBy !== who.username && !!id && who.fleets.includes(id);
};
/** The requester may cancel their own request until a robot is on its way. */
export const canCancel = (r: TripRequest, who: Person): boolean => r.requestedBy === who.username && STATUS[r.status].cancellable;
export const isAllowedNext = (from: RequestStatus, to: RequestStatus): boolean => {
  if (STATUS[from].terminal) return false;
  return ({ pending: ['approved', 'rejected', 'cancelled'], approved: ['ongoing', 'cancelled', 'failed', 'completed'], ongoing: ['completed', 'failed', 'approved'] } as Record<string, RequestStatus[]>)[from]?.includes(to) ?? false;
};
/** Requests made together, newest order first, each order's requests in the order they were made. */
export function groupRequests(list: TripRequest[]): { groupId: string; createdAt: number; requests: TripRequest[] }[] {
  const by = new Map<string, TripRequest[]>(); for (const r of [...list].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))) by.set(r.groupId, [...(by.get(r.groupId) ?? []), r]);
  return [...by.entries()].map(([groupId, requests]) => ({ groupId, createdAt: requests[0].createdAt, requests })).sort((a, b) => b.createdAt - a.createdAt || b.groupId.localeCompare(a.groupId));
}
