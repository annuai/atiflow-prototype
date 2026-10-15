import { z } from 'zod';
import { localBackend, type StorageBackend } from '@/data/storage';
import type {
  ActionLogService,
  DatasetService,
  DevicePrefs,
  FleetProfileService,
  MapNameService,
  MapVersionService,
  MasterDataService,
  NotificationCacheService,
  PreferenceService,
  SettingsService,
} from '../ports';
import { createSavedState } from './savedState';

/**
 * The saved-state adapters (dummy: browser storage, same keys the app has always used). The schemas check the ENVELOPE of each document (the fields every reader depends on); the finer
 * shape of items is the owning feature's business (its store repairs and upgrades what it reads). Starting values are the owning stores' fixtures (a null `read()` = use them).
 */
type Backend = (key: string) => StorageBackend;
const rec = z.record(z.string(), z.unknown());
const item = z.object({}).passthrough();
const device = z.object({ status: z.string(), values: rec });

export const DATASET_KEY = 'atiflow.dataset.v1';
export const FLEETS_KEY = 'atiflow.fleets.v1';
export const MASTERDATA_KEY = 'atiflow.masterdata.v1';
export const MAPNAMES_KEY = 'atiflow.mapnames.v1';
export const MAPVERSIONS_KEY = 'atiflow.mapversions.v1';
export const SETTINGS_KEY = 'atiflow.settings.v1';
export const PREFERENCES_KEY = 'atiflow.preferences.v1';
export const ACTIONLOG_KEY = 'atiflow.actioncenter.v1';
export const notificationsKey = (username: string) => `atiflow.notifications.v1.${username}`;

export const createDummyDataset = (backend?: Backend): DatasetService =>
  createSavedState({
    key: DATASET_KEY,
    backend,
    schema: z.object({
      version: z.literal(1),
      fleets: z.array(z.object({ id: z.string(), name: z.string(), color: z.string() }).passthrough()),
      robot: z.array(device),
      hardware: z.array(device),
    }),
  }) as unknown as DatasetService;

export const createDummyFleetProfiles = (backend?: Backend): FleetProfileService =>
  createSavedState({
    key: FLEETS_KEY,
    backend,
    schema: z.record(z.string(), z.object({ mapId: z.string().nullable(), groups: z.array(item) }).passthrough()),
  }) as unknown as FleetProfileService;

export const createDummyMasterData = (backend?: Backend): MasterDataService =>
  createSavedState({
    key: MASTERDATA_KEY,
    backend,
    schema: z.object({ materials: z.array(item), groups: z.array(item), areas: z.array(item) }),
  }) as unknown as MasterDataService;

export const createDummyMapNames = (backend?: Backend): MapNameService =>
  createSavedState({ key: MAPNAMES_KEY, backend, schema: z.record(z.string(), z.string()) });

export const createDummyMapVersions = (backend?: Backend): MapVersionService =>
  createSavedState({
    key: MAPVERSIONS_KEY,
    backend,
    schema: z.record(
      z.string(),
      z.object({
        versions: z.array(z.object({ id: z.string(), mapId: z.string(), status: z.string() }).passthrough()),
      }),
    ),
  }) as unknown as MapVersionService;

export const createDummySettings = (backend?: Backend): SettingsService =>
  createSavedState({
    key: SETTINGS_KEY,
    backend,
    schema: z.object({
      version: z.literal(1),
      connections: z.object({ 'fleet-manager': item, mes: item }).passthrough(),
      general: item,
    }),
  }) as unknown as SettingsService;

export const createDummyPreferences = (backend?: Backend): PreferenceService =>
  createSavedState({
    key: PREFERENCES_KEY,
    backend,
    schema: z.record(z.string(), rec),
  }) as unknown as PreferenceService;

export const createDummyNotificationCache = (backend?: Backend): NotificationCacheService => ({
  forUser: (username) =>
    createSavedState({
      key: notificationsKey(username),
      backend,
      schema: z.array(z.object({ id: z.string(), title: z.string(), at: z.number() }).passthrough()),
    }) as never,
});

export const createDummyActionLog = (backend?: Backend): ActionLogService =>
  createSavedState({
    key: ACTIONLOG_KEY,
    backend,
    schema: z.array(z.object({ id: z.string() }).passthrough()),
  }) as unknown as never;

/** Per-device interface choices under their own keys. */
export const createDummyDevicePrefs = (backend: Backend = localBackend): DevicePrefs => ({
  get: (key) => backend(key).read(),
  set: (key, value) => backend(key).write(value),
});
