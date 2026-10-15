import seedDataset from '@/data/dataset.json';
import type { DatasetData } from '@/data/datasetTypes';
import type { StorageBackend } from '@/data/storage';
import type { Services } from '../ports';
import { createDummyBookings } from './bookings';
import { createDummyIdentity } from './identity';
import { createDummyRequests } from './requests';
import { createDummyTripIds } from './tripIds';
import { createDummyWorkflows } from './workflows';
import {
  createDummyActionLog,
  createDummyDataset,
  createDummyDevicePrefs,
  createDummyFleetProfiles,
  createDummyMapNames,
  createDummyMapVersions,
  createDummyMasterData,
  createDummyNotificationCache,
  createDummyPreferences,
  createDummySettings,
} from './state';

export interface DummyServicesOptions {
  /** Storage per key (browser storage by default; tests pass an in-memory one). */
  backend?: (key: string) => StorageBackend;
  sessionBackend?: (key: string) => StorageBackend;
  latencyMs?: number;
}

/** Every service with built-in fixtures and browser storage: what runs when `dataMode` is `dummy`. */
export function createDummyServices(opts: DummyServicesOptions = {}): Services {
  const dataset = createDummyDataset(opts.backend);
  return {
    ...createDummyIdentity({
      ...opts,
      fleetIds: () => (dataset.read() ?? (seedDataset as DatasetData)).fleets.map((f) => f.id), // fleets added by someone count too
    }),
    workflows: createDummyWorkflows(opts.backend),
    requests: createDummyRequests(opts.backend),
    bookings: createDummyBookings(opts.backend),
    tripIds: createDummyTripIds(opts.backend),
    dataset,
    fleetProfiles: createDummyFleetProfiles(opts.backend),
    masterData: createDummyMasterData(opts.backend),
    mapNames: createDummyMapNames(opts.backend),
    mapVersions: createDummyMapVersions(opts.backend),
    settings: createDummySettings(opts.backend),
    preferences: createDummyPreferences(opts.backend),
    notificationCache: createDummyNotificationCache(opts.backend),
    actionLog: createDummyActionLog(opts.backend),
    device: createDummyDevicePrefs(opts.backend),
  };
}
