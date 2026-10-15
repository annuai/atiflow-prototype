import { STATUS } from './status';
import type { ApprovalStep, RequestStatus, TripRequest } from './types';

/** The rules of who may do what with a request (pure). */
export interface Person { username: string }
/** The approval the request waits for now: the first Confirm step not yet approved (they are done in turn). */
export const currentStep = (r: TripRequest): ApprovalStep | undefined => (r.status === 'pending' ? r.approvals.find((a) => !a.by) : undefined);
/** One of the current step's approval users approves, never the person who asked. */
export function canApprove(r: TripRequest, who: Person): boolean {
  const step = currentStep(r); return !!step && step.users.includes(who.username) && r.requestedBy !== who.username;
}
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
