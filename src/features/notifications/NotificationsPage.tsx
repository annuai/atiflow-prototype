import { useEffect, useState } from 'react';
import { TabPanelMotion } from '@/components/motion/TabPanelMotion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { OPERATOR_ACTION_CENTER_PATH, OPERATOR_APPROVE_PATH, OPERATOR_HISTORY_PATH } from '@/features/action-center';
import { LIVE_FLOOR_PATH } from '@/features/live-floor';
import { localized } from '@/i18n';
import { NotificationItem } from './components/NotificationItem';
import { copy } from './copy';
import { useNotificationStore, useWorkspaceNotifications } from './NotificationsProvider';
import type { Audience, NotificationAction } from './types';
import { Page, PageCard, PageCardBody, PageHeader } from '@/components/page';

type Tab = 'all' | 'unread';
/** One page for every user (`/supervisor/notifications`, `/configurator/notifications`). What it lists depends on the signed-in user: each workspace has its own sources (see `sources.ts`). */
export function NotificationsPage() {
  const path = useLocation().pathname;
  const role: Audience = path.startsWith('/configurator')
    ? 'configurator'
    : path.startsWith('/operator')
      ? 'operator'
      : 'supervisor';
  const navigate = useNavigate(); // the workspace the page is opened in decides the shell around it
  const items = useWorkspaceNotifications(); // only what is meant for the workspace that is open
  const [tab, setTab] = useState<Tab>('all');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => window.clearInterval(t);
  }, []);
  const unread = items.filter((n) => !n.read).length;
  const shown = tab === 'unread' ? items.filter((n) => !n.read) : items;
  const st = useNotificationStore().getState();
  const run = (a: NotificationAction) =>
    a.kind === 'requests'
      ? navigate(OPERATOR_HISTORY_PATH)
      : a.kind === 'approvals'
        ? navigate(OPERATOR_APPROVE_PATH)
        : role === 'operator'
          ? navigate(OPERATOR_ACTION_CENTER_PATH)
          : navigate(LIVE_FLOOR_PATH, a.kind === 'locate' ? { state: { locate: a.robotId } } : undefined); // operators have no Live Floor: their alerts open the Action Center
  return (
    <>
      <Page>
        <PageHeader
          title={copy.title}
          subtitle={copy.subtitle[role]}
          actions={
            <>
              <SegmentedTabs<Tab>
                value={tab}
                onChange={setTab}
                label={localized('insights').notifications.ui.show}
                items={[
                  { id: 'all', label: copy.all },
                  { id: 'unread', label: copy.unread(unread) },
                ]}
              />
              <Button size="sm" color="secondary" isDisabled={!unread} onPress={() => st.markAllRead(role)}>
                {copy.markAll}
              </Button>
            </>
          }
          actionsClassName="items-center"
        />
        <PageCard>
          <PageCardBody spacious className="gap-3">
            <TabPanelMotion tabKey={tab} className="flex flex-col gap-3">
              {!shown.length ? (
                <EmptyState
                  icon={Bell01}
                  title={tab === 'unread' && items.length ? copy.emptyUnread : copy.emptyAll}
                  subtext={copy.emptyAllHint[role]}
                  size="lg"
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {shown.map((n) => (
                    <NotificationItem
                      key={n.id}
                      n={n}
                      now={now}
                      onOpen={() => st.markRead(n.id)}
                      onAction={(a) => {
                        st.markRead(n.id);
                        run(a);
                      }}
                    />
                  ))}
                </ul>
              )}
            </TabPanelMotion>
          </PageCardBody>
        </PageCard>
      </Page>
    </>
  );
}
