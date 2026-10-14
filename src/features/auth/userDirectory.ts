import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { createDocument, localBackend } from '@/data/storage';
import { datasetStore } from '@/data/dataset';
import { ALL_PERMISSIONS, isFleetScoped, presetOf, roleById } from '@/features/access';
import { AVATARS, SEED_REVISION, SEED_SINCE, SEED_USERS } from './users';
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
/** The operator permissions were renamed (Dispatch is now Approve) and Confirm was dropped: saved ticks follow. */
const RENAMED: Record<string, string | null> = { 'operator.dispatch': 'operator.approve', 'operator.confirm': null };
const renamePermissions = (u: UserRecord): UserRecord => !u.custom ? u : { ...u, custom: { add: [...new Set(u.custom.add.flatMap((p) => (p in RENAMED ? (RENAMED[p] ? [RENAMED[p]] : []) : [p])))] as typeof u.custom.add, remove: [...new Set(u.custom.remove.flatMap((p) => (p in RENAMED ? (RENAMED[p] ? [RENAMED[p]] : []) : [p])))] as typeof u.custom.remove } };
export const migrate = (list: UserRecord[]): UserRecord[] => list.map((u0) => {
  let u = u0; if ((u.role as string) === 'line-supervisor') u = { ...u, role: 'supervisor', custom: undefined };         // the Line Supervisor role was removed: those users are supervisors
  u = renamePermissions(u);
  const v: UserRecord = (u.role as string) === 'superuser' ? { ...u, role: 'configurator', custom: { add: ALL_PERMISSIONS.filter((p) => !presetOf('configurator').includes(p)), remove: [] } } : u;
  // a person saved before fleet scope existed keeps seeing everything (they are given every fleet; a configurator can narrow it on the Users page)
  return isFleetScoped(v.role) && !v.fleets?.length ? { ...v, fleets: datasetStore.getState().fleets.map((f) => f.id) } : v;
});

/**
 * A saved directory keeps the access a seed user had when it was saved, so a feature added later never reaches them (Meera, who has every module ticked, would miss it).
 * When `SEED_REVISION` has grown since the list was saved, the seed users' starting extra access is added again, once; everything else they or a configurator changed stays.
 */
export function applySeedRevision(list: UserRecord[], savedRevision: number): UserRecord[] {
  if (savedRevision >= SEED_REVISION) return list;
  const added = SEED_USERS.filter((s) => (SEED_SINCE[s.username] ?? 0) > savedRevision && !list.some((u) => u.username === s.username));          // a starting user introduced after this list was saved
  const stationsOf = (u: UserRecord) => { const s = SEED_USERS.find((x) => x.username === u.username)?.stations; return u.stations || !s ? u : { ...u, stations: s }; };          // a starting operator saved before stations existed gets the starting stations
  return [...list, ...structuredClone(added)].map(stationsOf).map((u) => { const s = SEED_USERS.find((x) => x.username === u.username)?.custom; if (!s?.add.length && !s?.remove.length) return u;
    return { ...u, custom: { add: [...new Set([...(u.custom?.add ?? []), ...s.add])], remove: [...new Set([...(u.custom?.remove ?? []).filter((p) => !s.add.includes(p)), ...s.remove])] } }; });
}
const REVISION_KEY = 'atiflow.users.seedRevision';
function loadUsers(): UserRecord[] {
  const list = migrate(usersDoc.load()); let rev = 0; try { rev = +(localStorage.getItem(REVISION_KEY) ?? 0) || 0; } catch { /* no storage */ }
  if (rev >= SEED_REVISION) return list; const next = applySeedRevision(list, rev);
  try { localStorage.setItem(REVISION_KEY, String(SEED_REVISION)); } catch { /* no storage */ } usersDoc.save(next); return next;
}

const norm = (u: string) => u.trim().toLowerCase();
export const toPublic = ({ password: _pw, ...u }: UserRecord): PublicUser => ({ ...u, name: `${u.firstName} ${u.lastName}`.trim(), avatar: u.avatar ?? AVATARS[u.username] });

export type NewUser = Pick<UserRecord, 'username' | 'password' | 'firstName' | 'lastName' | 'email' | 'role'> & { title?: string; avatar?: string; fleets?: string[]; stations?: string[] };
export interface UserDirectory {
  users: UserRecord[];
  add(input: NewUser): UserRecord;
  update(username: string, patch: Partial<Pick<UserRecord, 'firstName' | 'lastName' | 'email' | 'title' | 'role' | 'custom' | 'fleets' | 'stations'>>): void;
  resetPassword(username: string, password: string): void;
  remove(username: string): void;
  /** Back to the starting users. */
  reset(): void;
}
export const userDirectory = createStore<UserDirectory>((set, get) => ({
  users: loadUsers(),
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
