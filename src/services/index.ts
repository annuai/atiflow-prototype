import type { AppConfig } from '@/platform';
import { log, reportError } from '@/platform';
import { reinitStores } from '@/data/storeInit';
import { installTripIdCounter } from '@/data/tripIds';
import type { Services } from './ports';
import { createDummyServices } from './dummy';
import { instrumentServices } from './instrument';

export type { Services } from './ports';
export * from './ports';

/**
 * The composition root's registry. `main.tsx` builds the services once from the runtime config (`createServices`) and installs them (`setServices`) BEFORE the app modules load;
 * stores call `services()` when they start. Tests that touch no service need nothing; tests that do can `setServices(createDummyServices({ backend: memoryBackend }))`.
 */
let current: Services | null = null;
export function setServices(next: Services): Services {
  const replaced = current !== null && current !== next;
  current = next;
  installTripIdCounter(next.tripIds);
  if (replaced) reinitStores(); // services replaced after the app was running: every store reads again
  return next;
}
export function services(): Services {
  return current ?? setServices(createDummyServices());
}

/**
 * Choose each service from the config. `dataMode: 'dummy'` uses the fixtures and browser storage for everything. `api` mode will choose an HTTP adapter per service; until an adapter
 * exists for a service it falls back to the dummy one and says so in the log, so a half-wired deployment is visible rather than silently fake.
 */
export function createServices(config: Pick<AppConfig, 'dataMode' | 'api'>): Services {
  const dummy = instrumentServices(createDummyServices({ latencyMs: 450, workMs: 2500 }));
  if (config.dataMode === 'dummy') return dummy;
  const l = log.child('services');
  for (const name of Object.keys(dummy) as (keyof Services)[])
    l.warn(`dataMode is "api" but "${name}" has no HTTP adapter yet: using the dummy one`);
  return dummy;
}

/** The ports whose data the app needs before it can start (everything the stores read synchronously when they load). */
const HYDRATED: [string, (s: Services) => { hydrate?(): Promise<unknown> }][] = [
  ['users', (s) => s.users],
  ['workflows', (s) => s.workflows],
  ['requests', (s) => s.requests],
  ['bookings', (s) => s.bookings],
  ['trip ids', (s) => s.tripIds],
  ['fleets, robots and hardware', (s) => s.dataset],
  ['fleet profiles', (s) => s.fleetProfiles],
  ['master data', (s) => s.masterData],
  ['map names', (s) => s.mapNames],
  ['map versions', (s) => s.mapVersions],
  ['imported maps', (s) => s.mapCatalog],
  ['settings', (s) => s.settings],
  ['preferences', (s) => s.preferences],
  ['action center log', (s) => s.actionLog],
];
export interface HydrationResult {
  /** names of the data sets that could not be loaded (empty = all good) */
  failed: string[];
}
/**
 * Loads every service's data (in parallel, each with a time limit) BEFORE the app modules load, because the stores start from what the services already hold. If something cannot be
 * loaded the app must not start: its stores would begin from empty or starter data and the first save would overwrite the real data. The caller shows a retry screen instead.
 */
export async function hydrateServices(s: Services, timeoutMs = 15_000): Promise<HydrationResult> {
  const failed: string[] = [];
  await Promise.all(
    HYDRATED.map(async ([name, pick]) => {
      const port = pick(s);
      if (!port.hydrate) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          port.hydrate(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error(`Loading ${name} took longer than ${timeoutMs / 1000} s.`)),
              timeoutMs,
            );
          }),
        ]);
      } catch (e) {
        failed.push(name);
        reportError(e, { where: `hydrate:${name}` });
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return { failed };
}
