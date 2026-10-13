import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { createDocument, localBackend } from '@/data/storage';
import { ALL_PERMISSIONS, presetOf, roleById } from '@/features/access';
import { AVATARS, SEED_USERS } from './users';
import type { PublicUser, UserRecord } from './types';

/**
 * THE user directory: every account, editable (the Users page adds, edits and removes them) and saved in the browser (`StorageBackend`: a server later means
 * writing another backend, the rest stays). Login and the session read it through `authService`; nothing else touches the passwords.
 */
const KEY = 'atiflow.users.v1';
const seed = (): UserRecord[] => structuredClone(SEED_USERS);
const isDirectory = (v: unknown): v is UserRecord[] => Array.isArray(v) && v.every((u) => u && typeof u.username === 'string' && typeof u.password === 'string' && typeof u.role === 'string');
export const usersDoc = createDocument<UserRecord[]>(localBackend(KEY), seed, isDirectory);
/** A saved directory from before the superuser role was dropped: such a user is a configurator with every other module ticked. */
export const migrate = (list: UserRecord[]): UserRecord[] => list.map((u) => ((u.role as string) === 'superuser' ? { ...u, role: 'configurator', custom: { add: ALL_PERMISSIONS.filter((p) => !presetOf('configurator').includes(p)), remove: [] } } : u));

const norm = (u: string) => u.trim().toLowerCase();
export const toPublic = ({ password: _pw, ...u }: UserRecord): PublicUser => ({ ...u, name: `${u.firstName} ${u.lastName}`.trim(), avatar: u.avatar ?? AVATARS[u.username] });

export type NewUser = Pick<UserRecord, 'username' | 'password' | 'firstName' | 'lastName' | 'email' | 'role'> & { title?: string; avatar?: string };
export interface UserDirectory {
  users: UserRecord[];
  add(input: NewUser): UserRecord;
  update(username: string, patch: Partial<Pick<UserRecord, 'firstName' | 'lastName' | 'email' | 'title' | 'role' | 'custom'>>): void;
  resetPassword(username: string, password: string): void;
  remove(username: string): void;
  /** Back to the starting users. */
  reset(): void;
}
export const userDirectory = createStore<UserDirectory>((set, get) => ({
  users: migrate(usersDoc.load()),
  add(input) { const u: UserRecord = { ...input, username: norm(input.username), title: input.title?.trim() || roleById(input.role).label }; set({ users: [...get().users, u] }); return u; },
  update(username, patch) { set({ users: get().users.map((u) => (u.username === username ? { ...u, ...patch } : u)) }); },
  resetPassword(username, password) { set({ users: get().users.map((u) => (u.username === username ? { ...u, password } : u)) }); },
  remove(username) { set({ users: get().users.filter((u) => u.username !== username) }); },
  reset() { set({ users: usersDoc.reset() }); },
}));
export const useUsers = <T,>(sel: (s: UserDirectory) => T) => useStore(userDirectory, sel);
export const usernameTaken = (username: string) => userDirectory.getState().users.some((u) => u.username === norm(username));

userDirectory.subscribe((s, p) => { if (s.users !== p.users) usersDoc.save(s.users); });
// another tab (e.g. a configurator changed this user's access) saved the directory: take it over
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return; const r = usersDoc.parse(e.newValue); if ('value' in r) userDirectory.setState({ users: migrate(r.value) });
});
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __users: userDirectory });
