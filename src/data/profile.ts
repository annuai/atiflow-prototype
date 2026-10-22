import { clearStoragePrefix, localBackend, sessionBackend, type StorageBackend } from './storage';

/**
 * Data profiles: separate copies of everything the app saves. `demo` is the prototype's starting data (the fleets, robots, maps and workflows it always had, under the keys it
 * always used, so nothing is ever moved or deleted). `blank` is an empty site that starts from nothing: no fleets, robots, hardware, materials, workflows or maps, and none of the
 * built-in demo floor. The two never touch each other: `blank` keeps everything under its own key prefix, so a person can switch back and forth.
 */
export type ProfileId = 'demo' | 'blank';
export interface Profile {
  id: ProfileId;
  label: string;
  /** put in front of every saved key (empty for demo: its keys are the ones the app always had) */
  prefix: string;
  /** put at the end of the IndexedDB names and the broadcast channel */
  idbSuffix: string;
  /** start from the demo data (fleets, robots, materials, workflows, settings). False = start empty. */
  starterData: boolean;
  /** the built-in demo floor: the two ECC maps and the ECC building the Live Floor is drawn on */
  builtInSite: boolean;
  /** made-up feeds that make the demo feel alive (the MES notifications) */
  mockFeeds: boolean;
}
export const PROFILES: Record<ProfileId, Profile> = {
  demo: {
    id: 'demo',
    label: 'Demo data',
    prefix: '',
    idbSuffix: '',
    starterData: true,
    builtInSite: true,
    mockFeeds: true,
  },
  blank: {
    id: 'blank',
    label: 'Blank workspace',
    prefix: 'blank:',
    idbSuffix: '-blank',
    starterData: false,
    builtInSite: false,
    mockFeeds: false,
  },
};
export const PROFILE_IDS = Object.keys(PROFILES) as ProfileId[];
const isProfile = (v: unknown): v is ProfileId => typeof v === 'string' && v in PROFILES;

let active: Profile = PROFILES.demo;
/** The profile in force (the demo one until `setActiveProfile` has run; tests rely on that). */
export const activeProfile = (): Profile => active;
export function setActiveProfile(id: ProfileId): Profile {
  return (active = PROFILES[id]);
}

/** The key that remembers this device's choice. Never prefixed: it decides which prefix is used. */
export const PROFILE_KEY = 'atiflow.profile';
/**
 * Which profile to start in: the one named in the address (`?profile=blank`, remembered afterwards), else this device's saved choice, else the deployment's setting, else demo.
 * `fromUrl` also tells the caller to remember it.
 */
export function chooseProfile(o: { search?: string; saved?: string | null; config?: string }): {
  id: ProfileId;
  fromUrl: boolean;
} {
  const q = new URLSearchParams(o.search ?? '').get('profile');
  if (isProfile(q)) return { id: q, fromUrl: true };
  if (isProfile(o.saved)) return { id: o.saved, fromUrl: false };
  return { id: isProfile(o.config) ? o.config : 'demo', fromUrl: false };
}
const choice = (backend: (k: string) => StorageBackend = localBackend) => backend(PROFILE_KEY);
export const savedProfile = (backend?: (k: string) => StorageBackend) => choice(backend).read();
export const saveProfile = (id: ProfileId, backend?: (k: string) => StorageBackend) => choice(backend).write(id);

/** Storage per key for the active profile: demo uses the keys as they are, every other profile puts its prefix in front. */
export const profileBackend =
  (p: Profile = active) =>
  (key: string): StorageBackend =>
    localBackend(p.prefix + key);

/** Per-tab storage (who is signed in) for the active profile. */
export const profileSessionBackend =
  (p: Profile = active) =>
  (key: string): StorageBackend =>
    sessionBackend(p.prefix + key);

/** Choose a profile and start over in it (the page reloads, so every store reads the other profile's data). */
export function switchProfile(id: ProfileId) {
  saveProfile(id);
  if (typeof location !== 'undefined') {
    const url = new URL(location.href);
    url.searchParams.delete('profile'); // the saved choice decides now
    location.assign(url.toString());
  }
}

/**
 * Delete everything one profile saved and start it over (the page reloads). Only a profile with its own key prefix can be reset: the demo data lives under the app's original keys and
 * is NEVER touched (asking to reset it does nothing). Saved keys, the two IndexedDB databases and the broadcast channel of that profile go; nothing of any other profile does.
 */
export async function resetProfile(id: ProfileId): Promise<boolean> {
  const p = PROFILES[id];
  if (!p.prefix) return false;
  clearStoragePrefix(p.prefix);
  if (typeof indexedDB !== 'undefined')
    await Promise.all(
      ['atiflow-master-data', 'atiflow-map-assets'].map(
        (name) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.deleteDatabase(name + p.idbSuffix);
            r.onsuccess = r.onerror = r.onblocked = () => resolve();
          }),
      ),
    );
  if (typeof location !== 'undefined') location.reload();
  return true;
}
