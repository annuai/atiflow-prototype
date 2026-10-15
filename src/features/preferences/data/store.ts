import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { authStore, useAuth } from '@/features/auth/authStore';
import { DEFAULT_PREFERENCES, withDefaults } from '../model/defaults';
import type { Preferences } from '../model/types';

/** Preferences per person, saved in the browser (one document, keyed by username; a server later means another place to read and write them). */
const KEY = 'atiflow.preferences.v1';
function load(): Record<string, Partial<Preferences>> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
export interface PreferencesState {
  byUser: Record<string, Partial<Preferences>>;
  save(username: string, p: Preferences): void;
  reset(username: string): void;
}
export const preferencesStore = createStore<PreferencesState>((set, get) => ({
  byUser: load(),
  save: (username, p) => set({ byUser: { ...get().byUser, [username]: p } }),
  reset: (username) => {
    const { [username]: _gone, ...rest } = get().byUser;
    set({ byUser: rest });
  },
}));
preferencesStore.subscribe((s, p) => {
  if (s.byUser !== p.byUser) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s.byUser));
    } catch {
      /* not saved */
    }
  }
});

export const prefsOf = (username: string | null | undefined): Preferences =>
  username ? withDefaults(preferencesStore.getState().byUser[username]) : DEFAULT_PREFERENCES;
/** The signed-in user's preferences, outside React (alerts, the start page). */
export const myPrefsNow = () => prefsOf(authStore.getState().user?.username);
export function useMyPreferences(): Preferences {
  const u = useAuth((s) => s.user?.username);
  const saved = useStore(preferencesStore, (s) => (u ? s.byUser[u] : undefined));
  return withDefaults(saved);
}
