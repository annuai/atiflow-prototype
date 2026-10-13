import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { authenticate, findUser } from './authService';
import { userDirectory } from './userDirectory';
import type { PublicUser } from './types';

const KEY = 'atiflow.session';
/** Only the username is persisted; the profile is re-resolved on load so avatars/titles stay current. */
function restore(): PublicUser | null {
  try { const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY); return raw ? findUser(JSON.parse(raw).username) : null; } catch { return null; }
}
function persist(user: PublicUser | null, keep: boolean) {
  localStorage.removeItem(KEY); sessionStorage.removeItem(KEY);
  if (user) (keep ? localStorage : sessionStorage).setItem(KEY, JSON.stringify({ username: user.username }));
}

export interface AuthState {
  user: PublicUser | null;
  /** Resolves 'ok' or 'invalid'. `keep` = stay signed in across browser restarts. */
  login(username: string, password: string, keep: boolean): Promise<'ok' | 'invalid'>;
  logout(): void;
}

export const authStore = createStore<AuthState>((set) => ({
  user: restore(),
  async login(username, password, keep) {
    await new Promise((r) => setTimeout(r, 450));            // feels like a request; harmless for a prototype
    const user = authenticate(username, password);
    if (!user) return 'invalid';
    persist(user, keep); set({ user }); return 'ok';
  },
  logout() { persist(null, false); set({ user: null }); },
}));
export const useAuth = <T,>(sel: (s: AuthState) => T) => useStore(authStore, sel);

/** The signed-in user follows the directory: when a configurator changes their role or access (here or in another tab) it applies at once, and a deleted user is signed out. */
userDirectory.subscribe(() => {
  const cur = authStore.getState().user; if (!cur) return; const fresh = findUser(cur.username);
  if (!fresh) authStore.getState().logout(); else if (JSON.stringify(fresh) !== JSON.stringify(cur)) authStore.setState({ user: fresh });
});
