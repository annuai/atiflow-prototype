import { t } from '../text';
import type { RequestStatus } from './types';

/** THE table of request statuses: label, badge colour, what it means to the person, and the rules that hang on it. */
export interface StatusDef {
  readonly label: string;
  color: 'warning' | 'brand' | 'blue' | 'success' | 'gray' | 'error';
  readonly hint: string;
  /** the person may cancel it */ cancellable: boolean;
  /** nothing happens to it any more */ terminal: boolean;
}
const status = (id: RequestStatus, color: StatusDef['color'], cancellable: boolean, terminal: boolean): StatusDef => ({
  get label() {
    return t.requests.status[id].label;
  },
  color,
  get hint() {
    return t.requests.status[id].hint;
  },
  cancellable,
  terminal,
});
export const STATUS: Record<RequestStatus, StatusDef> = {
  pending: status('pending', 'warning', true, false),
  approved: status('approved', 'brand', true, false),
  ongoing: status('ongoing', 'blue', false, false),
  completed: status('completed', 'success', false, true),
  cancelled: status('cancelled', 'gray', false, true),
  rejected: status('rejected', 'error', false, true),
  failed: status('failed', 'error', false, true),
};
export const isActive = (s: RequestStatus) => !STATUS[s].terminal;
