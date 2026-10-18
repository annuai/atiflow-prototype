import { createPersistedStore } from '@/data/persistedStore';
import { persistOnce } from '@/data/persist';
import { useStore } from 'zustand';
import { roleById } from '@/features/access';
import { services } from '@/services';
import { AVATARS } from '@/fixtures/users';
import type { PublicUser, UserRecord } from './types';

/**
 * THE user directory: every account, editable (the Users page adds, edits and removes them). It is a client-side cache over the `users` service (the dummy one keeps the list in browser
 * storage; a real one is a user API) and the `auth` service, which alone holds passwords. Login and the session read it through `authService`.
 */
const norm = (u: string) => u.trim().toLowerCase();
export const toPublic = (u: UserRecord): PublicUser => ({
  ...u,
  name: `${u.firstName} ${u.lastName}`.trim(),
  avatar: u.avatar ?? AVATARS[u.username],
});

type NewUser = Pick<UserRecord, 'username' | 'firstName' | 'lastName' | 'email' | 'role'> & {
  /** handed to the sign-in service, never kept on the profile */
  password: string;
  title?: string;
  avatar?: string;
  fleets?: string[];
};
export interface UserDirectory {
  users: UserRecord[];
  add(input: NewUser): UserRecord;
  update(
    username: string,
    patch: Partial<
      Pick<UserRecord, 'firstName' | 'lastName' | 'email' | 'title' | 'role' | 'custom' | 'fleets' | 'avatar'>
    >,
  ): void;
  resetPassword(username: string, password: string): void;
  remove(username: string): void;
  /** Back to the starting users. */
  reset(): void;
}
export const userDirectory = createPersistedStore<UserDirectory, UserRecord[]>(
  {
    name: 'users',
    read: () => services().users.snapshot(),
    save: (v) => services().users.save(v),
    pick: (s) => s.users,
    apply: (users) => ({ users }),
    watch: ['users'],
    // another tab (e.g. a configurator changed this user's access) saved the directory: take it over
    listen: (cb) => services().users.subscribe(cb),
    devHandle: '__users',
  },
  (set, get) => ({
    add({ password, ...input }) {
      const u: UserRecord = {
        ...input,
        username: norm(input.username),
        title: input.title?.trim() || roleById(input.role).label,
      };
      void persistOnce('password', () => services().auth.setPassword(u.username, password));
      set({ users: [...get().users, u] });
      return u;
    },
    update(username, patch) {
      set({ users: get().users.map((u) => (u.username === username ? { ...u, ...patch } : u)) });
    },
    resetPassword(username, password) {
      void persistOnce('password', () => services().auth.setPassword(username, password));
    },
    remove(username) {
      void persistOnce('credentials', () => services().auth.removeCredentials(username));
      set({ users: get().users.filter((u) => u.username !== username) });
    },
    reset() {
      set({ users: services().users.resetToSeed?.() ?? get().users });
    },
  }),
);
export const useUsers = <T>(sel: (s: UserDirectory) => T) => useStore(userDirectory, sel);
export const usernameTaken = (username: string) =>
  userDirectory.getState().users.some((u) => u.username === norm(username));
