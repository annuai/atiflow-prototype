import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useAuth } from '@/features/auth/authStore';
import { createNotificationStore, type NotificationState, type NotificationStore } from './store';
import type { NotificationApi } from './types';

const Context = createContext<NotificationStore | null>(null);

/**
 * The reusable notification data component. Put it once above the routes and hand it an `api` (see `NotificationApi`): it loads the signed-in user's notifications,
 * keeps them up to date, remembers what was read and exposes it all through the hooks below. Anything inside it (the page, the sidebar badge, a bell somewhere else) reads the same data.
 */
export function NotificationsProvider({ api, children }: { api: NotificationApi; children: ReactNode }) {
  const store = useMemo(() => createNotificationStore(api), [api]); const user = useAuth((s) => s.user); const username = user?.username ?? null; const role = user?.role ?? null;
  useEffect(() => { store.getState().open(user); return () => store.getState().open(null); }, [store, username, role]);       // eslint-disable-line react-hooks/exhaustive-deps
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

export function useNotificationStore(): NotificationStore { const s = useContext(Context); if (!s) throw new Error('useNotifications needs <NotificationsProvider> above it'); return s; }
export const useNotifications = <T,>(sel: (s: NotificationState) => T): T => useStore(useNotificationStore(), sel);
export const useUnreadCount = () => useNotifications((s) => s.items.filter((n) => !n.read).length);
