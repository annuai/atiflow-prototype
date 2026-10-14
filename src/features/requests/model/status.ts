import type { RequestStatus } from './types';

/** THE table of request statuses: label, badge colour, what it means to the person, and the rules that hang on it. */
export interface StatusDef { label: string; color: 'warning' | 'brand' | 'blue' | 'success' | 'gray' | 'error'; hint: string; /** the person may cancel it */ cancellable: boolean; /** nothing happens to it any more */ terminal: boolean }
export const STATUS: Record<RequestStatus, StatusDef> = {
  pending: { label: 'Pending approval', color: 'warning', hint: 'Waiting for another operator to approve', cancellable: true, terminal: false },
  approved: { label: 'Approved', color: 'brand', hint: 'Approved, waiting for a robot', cancellable: true, terminal: false },
  ongoing: { label: 'Ongoing', color: 'blue', hint: 'A robot is on its way', cancellable: false, terminal: false },
  completed: { label: 'Completed', color: 'success', hint: 'Delivered', cancellable: false, terminal: true },
  cancelled: { label: 'Cancelled', color: 'gray', hint: 'Cancelled by the requester', cancellable: false, terminal: true },
  rejected: { label: 'Rejected', color: 'error', hint: 'Not approved', cancellable: false, terminal: true },
  failed: { label: 'Failed', color: 'error', hint: 'The trip could not be done', cancellable: false, terminal: true },
};
export const STATUS_ORDER: RequestStatus[] = ['pending', 'approved', 'ongoing', 'completed', 'cancelled', 'rejected', 'failed'];
export const isActive = (s: RequestStatus) => !STATUS[s].terminal;
