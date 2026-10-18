import { createPersistedStore } from '@/data/persistedStore';
import { useStore } from 'zustand';
import { services } from '@/services';
import { authStore, useAuth } from '@/features/auth';
import { DEFAULT_PREFERENCES, withDefaults } from '../model/defaults';
import type { Preferences } from '../model/types';

/** Preferences per person: a client-side cache over the `preferences` service (one document keyed by username; the dummy one lives in browser storage). */
const load = (): Record<string, Partial<Preferences>> => services().preferences.read() ?? {};
export interface PreferencesState {
  byUser: Record<string, Partial<Preferences>>;
  save(username: string, p: Preferences): void;
  reset(username: string): void;
}
export const preferencesStore = createPersistedStore<PreferencesState, Record<string, Partial<Preferences>>>(
  {
    name: 'preferences',
    read: load,
    save: (v) => services().preferences.save(v),
    pick: (s) => s.byUser,
    apply: (d) => ({ byUser: d }),
    watch: ['byUser'],
  },
  (set, get) => ({
    save: (username, p) => set({ byUser: { ...get().byUser, [username]: p } }),
    reset: (username) => {
      const { [username]: _gone, ...rest } = get().byUser;
      set({ byUser: rest });
    },
  }),
);

export const prefsOf = (username: string | null | undefined): Preferences =>
  username ? withDefaults(preferencesStore.getState().byUser[username]) : DEFAULT_PREFERENCES;
/** The signed-in user's preferences, outside React (alerts, the start page). */
export const myPrefsNow = () => prefsOf(authStore.getState().user?.username);
export function useMyPreferences(): Preferences {
  const u = useAuth((s) => s.user?.username);
  const saved = useStore(preferencesStore, (s) => (u ? s.byUser[u] : undefined));
  return withDefaults(saved);
}
