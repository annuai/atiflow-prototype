import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { services } from '@/services';

/**
 * What onboarding remembers (kept on this device, per workspace, through the `device` service). The SETUP steps themselves are never stored (they are read from the data); only the
 * choices around them are: that the site has no hardware, that the "setup complete" card was shown, and that it was put away.
 */
const KEY = 'onboarding:site';
export interface SiteProgress {
  hardwareSkipped: boolean;
  /** setup was seen unfinished at least once: only then is "Setup complete" worth showing (a site that starts finished never sees it) */
  seenIncomplete: boolean;
  /** the "Setup complete" card was put away */
  dismissed: boolean;
}
const EMPTY: SiteProgress = { hardwareSkipped: false, seenIncomplete: false, dismissed: false };
function read(): SiteProgress {
  try {
    const raw = services().device.get(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<SiteProgress>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}
interface State extends SiteProgress {
  set(p: Partial<SiteProgress>): void;
}
export const progressStore = createStore<State>((set, get) => ({
  ...read(),
  set(p) {
    set(p);
    const { hardwareSkipped, seenIncomplete, dismissed } = get();
    services().device.set(KEY, JSON.stringify({ hardwareSkipped, seenIncomplete, dismissed }));
  },
}));
export const useProgress = <T>(sel: (s: State) => T) => useStore(progressStore, sel);

/**
 * What each PERSON has seen (kept on this device, per workspace): which version of the welcome dialog they have been through, and how each walkthrough ended. A new welcome / tour
 * version (`WELCOME_VERSION`) is offered again.
 */
export const WELCOME_VERSION = '4.0';
export interface PersonProgress {
  welcomed: string | null;
  tours: Record<string, 'done' | 'skipped'>;
}
const personKey = (u: string) => `onboarding:person:${u}`;
function readPerson(u: string): PersonProgress {
  try {
    const raw = services().device.get(personKey(u));
    return { welcomed: null, tours: {}, ...(raw ? (JSON.parse(raw) as Partial<PersonProgress>) : {}) };
  } catch {
    return { welcomed: null, tours: {} };
  }
}
interface PeopleState {
  people: Record<string, PersonProgress>;
  of(u: string): PersonProgress;
  patch(u: string, p: Partial<PersonProgress>): void;
}
export const peopleStore = createStore<PeopleState>((set, get) => ({
  people: {},
  of: (u) => get().people[u] ?? readPerson(u),
  patch(u, p) {
    const next = { ...get().of(u), ...p };
    services().device.set(personKey(u), JSON.stringify(next));
    set({ people: { ...get().people, [u]: next } });
  },
}));
export const usePerson = (u: string | null): PersonProgress =>
  useStore(peopleStore, (s) => (u ? (s.people[u] ?? readPerson(u)) : { welcomed: null, tours: {} }));

/** A request to start a walkthrough from anywhere (a button, a menu item): the host in the shell picks it up. */
export const tourRequests = createStore<{ id: string | null; start(id: string): void; clear(): void }>((set) => ({
  id: null,
  start: (id) => set({ id }),
  clear: () => set({ id: null }),
}));
export const useTourRequest = () => useStore(tourRequests, (s) => s.id);
