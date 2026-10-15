import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { services } from '@/services';
import { findUser } from './authService';
import { userDirectory } from './userDirectory';
import type { PublicUser } from './types';

/** Only the username is kept (by the session service); the profile is re-resolved on load so avatars/titles stay current. */
function restore(): PublicUser | null {
  const name = services().session.read();
  return name ? findUser(name) : null;
}
function persist(user: PublicUser | null, keep: boolean) {
  if (user) services().session.write(user.username, keep);
  else services().session.clear();
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
    const name = await services().auth.signIn(username, password);
    const user = name ? findUser(name) : null;
    if (!user) return 'invalid';
    persist(user, keep);
    set({ user });
    return 'ok';
  },
  logout() {
    persist(null, false);
    set({ user: null });
  },
}));
export const useAuth = <T>(sel: (s: AuthState) => T) => useStore(authStore, sel);

/** The signed-in user follows the directory: when a configurator changes their role or access (here or in another tab) it applies at once, and a deleted user is signed out. */
userDirectory.subscribe(() => {
  const cur = authStore.getState().user;
  if (!cur) return;
  const fresh = findUser(cur.username);
  if (!fresh) authStore.getState().logout();
  else if (JSON.stringify(fresh) !== JSON.stringify(cur)) authStore.setState({ user: fresh });
});
