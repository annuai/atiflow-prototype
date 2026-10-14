import { STATUS } from './status';
import type { ApprovalStep, RequestStatus, TripRequest } from './types';

/** The rules of who may do what with a request (pure). */
export interface Person { username: string }
/** Usernames of the operators who may approve at a station (mapped to it, with the Approve permission). */
export type ApproversAt = (stationId: string) => string[];
/** The approval the request waits for now: the first Confirm step not yet approved (they are done in turn). */
export const currentStep = (r: TripRequest): ApprovalStep | undefined => (r.status === 'pending' ? r.approvals.find((a) => !a.by) : undefined);
/** An operator mapped to the current step's station approves; never the person who asked, unless they are the only one mapped to that station (a one-person line). */
export function canApprove(r: TripRequest, who: Person, approversAt: ApproversAt): boolean {
  const step = currentStep(r); if (!step) return false; const at = approversAt(step.stationId);
  return at.includes(who.username) && (r.requestedBy !== who.username || at.every((u) => u === who.username));
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
