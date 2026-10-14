import { useLocation, useNavigate } from 'react-router-dom';
import { LifeBuoy01 } from '@untitledui/icons';
import bell from '@/ui/icons/bell.svg';
import { useUnreadCount } from '@/features/notifications/NotificationsProvider';
import type { NavModel, SearchHit } from '@/shell/types';
import { useActionCenterRunning } from './data/store';
import { useCalls } from './data/useCalls';

export const OPERATOR_ACTION_CENTER_PATH = '/operator/action-center', OPERATOR_NOTIFICATIONS_PATH = '/operator/notifications';
/** Sidebar of the operator area: what an operator can open today (the Action Center; dispatch / request / confirm have no pages yet). */
export function useOperatorNav(): NavModel {
  const navigate = useNavigate(); const path = useLocation().pathname; const unread = useUnreadCount(); useActionCenterRunning(); const open = useCalls().open;
  return {
    groups: [{ id: 'ops', label: 'Operations', items: [{ id: 'action-center', label: 'Action Center', icon: LifeBuoy01, badge: open || undefined, active: path === OPERATOR_ACTION_CENTER_PATH, onSelect: () => navigate(OPERATOR_ACTION_CENTER_PATH) }] }],
    footerItems: [{ id: 'notif', label: 'Notifications', icon: bell, badge: unread || undefined, active: path === OPERATOR_NOTIFICATIONS_PATH, onSelect: () => navigate(OPERATOR_NOTIFICATIONS_PATH) }],
  };
}
export const operatorHits = (_q: string): SearchHit[] => [];
