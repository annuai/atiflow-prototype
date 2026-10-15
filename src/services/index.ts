import type { AppConfig } from '@/platform';
import { log } from '@/platform';
import type { Services } from './ports';
import { createDummyServices } from './dummy';

export type { Services } from './ports';
export * from './ports';

/**
 * The composition root's registry. `main.tsx` builds the services once from the runtime config (`createServices`) and installs them (`setServices`) BEFORE the app modules load;
 * stores call `services()` when they start. Tests that touch no service need nothing; tests that do can `setServices(createDummyServices({ backend: memoryBackend }))`.
 */
let current: Services | null = null;
export function setServices(next: Services): Services {
  current = next;
  return next;
}
export function services(): Services {
  return (current ??= createDummyServices());
}

/**
 * Choose each service from the config. `dataMode: 'dummy'` uses the fixtures and browser storage for everything. `api` mode will choose an HTTP adapter per service; until an adapter
 * exists for a service it falls back to the dummy one and says so in the log, so a half-wired deployment is visible rather than silently fake.
 */
export function createServices(config: Pick<AppConfig, 'dataMode' | 'api'>): Services {
  const dummy = createDummyServices({ latencyMs: 450 });
  if (config.dataMode === 'dummy') return dummy;
  const l = log.child('services');
  for (const name of Object.keys(dummy) as (keyof Services)[])
    l.warn(`dataMode is "api" but "${name}" has no HTTP adapter yet: using the dummy one`);
  return dummy;
}
