import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { configuratorHits, useConfiguratorNav } from '@/features/configurator/configuratorNav';
import { LIVE_FLOOR_PATH, liveHits, useLiveNav } from '@/features/live-floor/liveNav';
import { AppShell } from '@/shell/AppShell';
import type { NavModel, SearchHit } from '@/shell/types';
import { NotificationItem } from './components/NotificationItem';
import { copy } from './copy';
import { useNotificationStore, useNotifications } from './NotificationsProvider';
import type { Audience, NotificationAction } from './types';

/** The sidebar and search each role already has: the page is shared, only the shell around it differs. */
const SHELL: Record<Audience, { useNavModel: () => NavModel; getHits: (q: string) => SearchHit[]; placeholder: string }> = {
  supervisor: { useNavModel: useLiveNav, getHits: liveHits, placeholder: 'Search robots, stations, zones…' },
  configurator: { useNavModel: useConfiguratorNav, getHits: configuratorHits, placeholder: 'Search live operations, fleets, trips, analytics...' },
};

type Tab = 'all' | 'unread';
/** One page for every user (`/supervisor/notifications`, `/configurator/notifications`). What it lists depends on the signed-in user: each workspace has its own sources (see `sources.ts`). */
export function NotificationsPage() {
  const role: Audience = useLocation().pathname.startsWith('/configurator') ? 'configurator' : 'supervisor'; const navigate = useNavigate();         // the workspace the page is opened in decides the shell around it
  const items = useNotifications((s) => s.items); const [tab, setTab] = useState<Tab>('all'); const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 20_000); return () => window.clearInterval(t); }, []);
  const unread = items.filter((n) => !n.read).length; const shown = tab === 'unread' ? items.filter((n) => !n.read) : items; const shell = SHELL[role]; const st = useNotificationStore().getState();
  const run = (a: NotificationAction) => navigate(LIVE_FLOOR_PATH, a.kind === 'locate' ? { state: { locate: a.robotId } } : undefined);
  return (
    <AppShell useNavModel={shell.useNavModel} getHits={shell.getHits} searchPlaceholder={shell.placeholder}>
      <div className="content">
        <div className="title-block"><div><h1>{copy.title}</h1><p>{copy.subtitle[role]}</p></div>
          <div className="actions items-center"><SegmentedTabs<Tab> value={tab} onChange={setTab} label="Show" items={[{ id: 'all', label: copy.all }, { id: 'unread', label: copy.unread(unread) }]} />
            <Button size="sm" color="secondary" isDisabled={!unread} onPress={() => st.markAllRead()}>{copy.markAll}</Button></div></div>
        <div className="builder md-card"><div className="md-body flex flex-col gap-3 !px-5 !py-5 sm:!px-6">
          {!shown.length ? (
            <div className="grid flex-1 place-items-center py-16 text-center"><div><span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-secondary text-fg-quaternary"><Bell01 className="size-6" /></span>
              <p className="font-medium text-primary">{tab === 'unread' && items.length ? copy.emptyUnread : copy.emptyAll}</p><p className="text-sm text-tertiary">{copy.emptyAllHint[role]}</p></div></div>
          ) : <ul className="flex flex-col gap-3">{shown.map((n) => <NotificationItem key={n.id} n={n} now={now} onOpen={() => st.markRead(n.id)} onAction={(a) => { st.markRead(n.id); run(a); }} />)}</ul>}
        </div></div>
      </div>
    </AppShell>
  );
}
