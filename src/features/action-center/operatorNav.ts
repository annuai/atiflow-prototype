import { useLocation, useNavigate } from 'react-router-dom';
import { ClipboardCheck, ClockRewind, LifeBuoy01, Route, ShoppingCart01 } from '@untitledui/icons';
import bell from '@/ui/icons/bell.svg';
import { useAccess } from '@/features/access/useAccess';
import { useUnreadCount } from '@/features/notifications/NotificationsProvider';
import { canApprove } from '@/features/requests/model/rules';
import { useRequestsRunning } from '@/features/requests/model/bridge';
import { useRequests } from '@/features/requests/model/store';
import { useOperator } from '@/features/requests/model/useOperator';
import type { NavModel, SearchHit } from '@/shell/types';
import { useActionCenterRunning } from './data/store';
import { useCalls } from './data/useCalls';

export const OPERATOR_ACTION_CENTER_PATH = '/operator/action-center', OPERATOR_NOTIFICATIONS_PATH = '/operator/notifications', OPERATOR_REQUEST_PATH = '/operator/request', OPERATOR_APPROVE_PATH = '/operator/approve', OPERATOR_BOOK_PATH = '/operator/book', OPERATOR_HISTORY_PATH = '/operator/history';
/** Sidebar of the operator area: Request, Book trip, Approve, History and the Action Center (each only when the person may open it), and Notifications. */
export function useOperatorNav(): NavModel {
  const navigate = useNavigate(); const path = useLocation().pathname; const unread = useUnreadCount(); const { can } = useAccess();
  useActionCenterRunning(); useRequestsRunning(); const calls = useCalls().open; const me = useOperator();
  const toApprove = useRequests((s) => s.requests).filter((r) => canApprove(r, me)).length;
  const item = (id: string, label: string, icon: NavModel['groups'][number]['items'][number]['icon'], to: string, badge?: number) => ({ id, label, icon, badge: badge || undefined, active: path === to, onSelect: () => navigate(to) });
  return {
    groups: [{ id: 'ops', label: 'Operations', items: [
      ...(can('operator.request') ? [item('request', 'Request', ShoppingCart01, OPERATOR_REQUEST_PATH)] : []),
      ...(can('operator.book-trip') ? [item('book', 'Book trip', Route, OPERATOR_BOOK_PATH)] : []),
      ...(can('operator.approve') ? [item('approve', 'Approve', ClipboardCheck, OPERATOR_APPROVE_PATH, toApprove)] : []),
      ...(can('operator.history') ? [item('history', 'History', ClockRewind, OPERATOR_HISTORY_PATH)] : []),
      ...(can('operator.action-center') ? [item('action-center', 'Action Center', LifeBuoy01, OPERATOR_ACTION_CENTER_PATH, calls)] : []),
    ] }],
    footerItems: [{ id: 'notif', label: 'Notifications', icon: bell, badge: unread || undefined, active: path === OPERATOR_NOTIFICATIONS_PATH, onSelect: () => navigate(OPERATOR_NOTIFICATIONS_PATH) }],
  };
}
export const operatorHits = (_q: string): SearchHit[] => [];
