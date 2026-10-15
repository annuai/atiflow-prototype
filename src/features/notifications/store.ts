import { createStore, type StoreApi } from 'zustand/vanilla';
import { createDocument, localBackend } from '@/data/storage';
import type { PublicUser } from '@/features/auth/types';
import { NotificationCenter, isNotificationList } from './center';
import type { AppNotification, NewNotification, NotificationApi } from './types';

export interface NotificationState {
  owner: PublicUser | null;
  items: AppNotification[];
  /** Switch to a user (null = nobody signed in): shows their saved list, loads their history and listens for new ones. */
  open(user: PublicUser | null): void;
  add(list: NewNotification[]): void;
  markRead(id: string): void;
  markAllRead(): void;
  clear(): void;
}
export type NotificationStore = StoreApi<NotificationState>;

/** A per-user copy kept in this browser so the list is there straight away (and offline); the API stays the source of truth. */
const browserCache = (username: string) =>
  createDocument<AppNotification[]>(localBackend(`atiflow.notifications.v1.${username}`), () => [], isNotificationList);

/** The notification data for one app: it asks `api` for everything and keeps each signed-in user's list apart. Create one per app (the provider does) or per test. */
export function createNotificationStore(
  api: NotificationApi,
  cache: (username: string) => ReturnType<typeof browserCache> = browserCache,
): NotificationStore {
  let center = new NotificationCenter();
  let saved: ReturnType<typeof browserCache> | null = null;
  let stop: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return createStore<NotificationState>((set, get) => {
    const apply = () => {
      set({ items: center.items });
      const d = saved,
        o = get().owner;
      if (!d || !o) return;
      clearTimeout(timer);
      timer = setTimeout(() => d.save(center.items), 200);
    };
    const tell = (user: PublicUser | null, ids: string[]) => {
      if (user && ids.length)
        void api.markRead?.(user, ids).catch(() => {
          /* the read state stays here; it is sent again with the next change */
        });
    };
    return {
      owner: null,
      items: [],
      open(user) {
        const cur = get().owner;
        if (
          cur?.username === user?.username &&
          cur?.role === user?.role &&
          JSON.stringify(cur?.custom) === JSON.stringify(user?.custom)
        )
          return;
        clearTimeout(timer);
        if (saved && cur) saved.save(center.items); // (a save still waiting is done now, so a quick log out loses nothing)
        stop?.();
        stop = null;
        saved = user ? cache(user.username) : null;
        center = new NotificationCenter(saved ? saved.load() : []);
        set({ owner: user, items: center.items });
        if (!user) return;
        stop = api.subscribe(user, (list) => get().add(list));
        void api
          .history?.(user)
          .then((list) => {
            if (get().owner?.username === user.username) get().add(list);
          })
          .catch(() => {
            /* offline: the saved list is shown */
          });
      },
      add(list) {
        if (center.add(list)) apply();
      },
      markRead(id) {
        center.markRead(id);
        apply();
        tell(get().owner, [id]);
      },
      markAllRead() {
        const ids = center.items.filter((n) => !n.read).map((n) => n.id);
        center.markAllRead();
        apply();
        tell(get().owner, ids);
      },
      clear() {
        center.clear();
        apply();
      },
    };
  });
}
