import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from 'zustand';
import { workspaceOfPath } from '@/features/access';
import { useAuth } from '@/features/auth';
import { createNotificationStore, type NotificationState, type NotificationStore } from './store';
import { audienceOf, type Audience, type NotificationApi } from './types';

const Context = createContext<NotificationStore | null>(null);

/**
 * The reusable notification data component. Put it once above the routes and hand it an `api` (see `NotificationApi`): it loads the signed-in user's notifications,
 * keeps them up to date, remembers what was read and exposes it all through the hooks below. Anything inside it (the page, the sidebar badge, a bell somewhere else) reads the same data.
 */
export function NotificationsProvider({ api, children }: { api: NotificationApi; children: ReactNode }) {
  const store = useMemo(() => createNotificationStore(api), [api]);
  const user = useAuth((s) => s.user);
  const username = user?.username ?? null;
  const access = user ? `${user.role}|${JSON.stringify(user.custom ?? null)}` : null;
  useEffect(() => {
    store.getState().open(user);
    return () => store.getState().open(null);
  }, [store, username, access]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

export function useNotificationStore(): NotificationStore {
  const s = useContext(Context);
  if (!s) throw new Error('useNotifications needs <NotificationsProvider> above it');
  return s;
}
export const useNotifications = <T,>(sel: (s: NotificationState) => T): T => useStore(useNotificationStore(), sel);
/** The workspace that is open (from the address); notifications and the unread count show only that workspace's own. */
export const useOpenAudience = (): Audience => {
  const ws = workspaceOfPath(useLocation().pathname);
  return ws === 'configurator' || ws === 'operator' ? ws : 'supervisor';
};
/** The notifications of the open workspace only. */
export const useWorkspaceNotifications = () => {
  const audience = useOpenAudience();
  const all = useNotifications((s) => s.items);
  return useMemo(() => all.filter((n) => audienceOf(n) === audience), [all, audience]);
};
export const useUnreadCount = () => useWorkspaceNotifications().filter((n) => !n.read).length;
