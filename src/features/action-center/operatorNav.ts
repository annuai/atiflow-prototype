import { useLocation, useNavigate } from 'react-router-dom';
import { ClipboardCheck, ClockRewind, LifeBuoy01, Route, ShoppingCart01 } from '@untitledui/icons';
import bell from '@/ui/icons/bell.svg';
import gear from '@/ui/icons/settings.svg';
import { localized } from '@/i18n';

const names = localized('nav');
import { useAccess } from '@/features/auth';
import { useUnreadCount } from '@/features/notifications';
import { canApprove, useRequestsRunning, useRequests, useOperator } from '@/features/requests';
import type { NavModel, SearchHit } from '@/shell/types';
import { useActionCenterRunning } from './data/store';
import { useCalls } from './data/useCalls';

import {
  OPERATOR_ACTION_CENTER_PATH,
  OPERATOR_NOTIFICATIONS_PATH,
  OPERATOR_REQUEST_PATH,
  OPERATOR_APPROVE_PATH,
  OPERATOR_BOOK_PATH,
  OPERATOR_HISTORY_PATH,
  OPERATOR_SETTINGS_PATH,
} from './paths';
export {
  OPERATOR_SETTINGS_PATH,
  OPERATOR_ACTION_CENTER_PATH,
  OPERATOR_NOTIFICATIONS_PATH,
  OPERATOR_REQUEST_PATH,
  OPERATOR_APPROVE_PATH,
  OPERATOR_BOOK_PATH,
  OPERATOR_HISTORY_PATH,
};
/** Sidebar of the operator area: Request, Book trip, Approve, History and the Action Center (each only when the person may open it), and Notifications. */
export function useOperatorNav(): NavModel {
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const unread = useUnreadCount();
  const { can } = useAccess();
  useActionCenterRunning();
  useRequestsRunning();
  const calls = useCalls().open;
  const me = useOperator();
  const toApprove = useRequests((s) => s.requests).filter((r) => canApprove(r, me)).length;
  const item = (
    id: string,
    label: string,
    icon: NavModel['groups'][number]['items'][number]['icon'],
    to: string,
    badge?: number,
  ) => ({ id, label, icon, badge: badge || undefined, active: path === to, onSelect: () => navigate(to) });
  return {
    groups: [
      {
        id: 'ops',
        label: names.groups.operations,
        items: [
          ...(can('operator.request')
            ? [item('request', names.features['operator.request'], ShoppingCart01, OPERATOR_REQUEST_PATH)]
            : []),
          ...(can('operator.book-trip')
            ? [item('book', names.features['operator.book-trip'], Route, OPERATOR_BOOK_PATH)]
            : []),
          ...(can('operator.approve')
            ? [item('approve', names.features['operator.approve'], ClipboardCheck, OPERATOR_APPROVE_PATH, toApprove)]
            : []),
          ...(can('operator.history')
            ? [item('history', names.features['operator.history'], ClockRewind, OPERATOR_HISTORY_PATH)]
            : []),
          ...(can('operator.action-center')
            ? [
                item(
                  'action-center',
                  names.features['operator.action-center'],
                  LifeBuoy01,
                  OPERATOR_ACTION_CENTER_PATH,
                  calls,
                ),
              ]
            : []),
        ],
      },
    ],
    footerItems: [
      {
        id: 'notif',
        label: names.items.notifications,
        icon: bell,
        badge: unread || undefined,
        active: path === OPERATOR_NOTIFICATIONS_PATH,
        onSelect: () => navigate(OPERATOR_NOTIFICATIONS_PATH),
      },
      ...(can('operator.settings')
        ? [
            {
              id: 'settings',
              label: names.features['operator.settings'],
              icon: gear,
              active: path.startsWith(OPERATOR_SETTINGS_PATH),
              onSelect: () => navigate(OPERATOR_SETTINGS_PATH),
            },
          ]
        : []),
    ],
  };
}
export const operatorHits = (_q: string): SearchHit[] => [];
