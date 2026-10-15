import type { Workflows } from '@/features/workflow-builder/model/types';
import type { UserRecord } from '@/features/auth/types';
import type { BookingsDocument } from '@/features/bookings/model/schema';
import type { RequestsDocument } from '@/features/requests/model/schema';
import type { DatasetData } from '@/data/datasetTypes';
import type { FleetProfile } from '@/features/fleets/model/types';
import type { Material, MaterialGroup, StagingArea } from '@/features/master-data/model/types';
import type { MapHistory } from '@/features/map-editor/model/types';
import type { SettingsData } from '@/features/settings/model/types';
import type { Preferences } from '@/features/preferences/model/types';
import type { AppNotification } from '@/features/notifications/types';
import type { Call } from '@/features/action-center/model/types';

/**
 * The service ports: the only things the app uses to get and keep data. Each has a DUMMY implementation (src/services/dummy: typed fixtures plus browser storage) and, later, an HTTP
 * one (the Fleet Manager, the Deployment Manager, an identity provider...). A store is a client-side cache on top of a port: it reads `snapshot()` at start, applies changes
 * optimistically, and hands them to `save()`; changes made elsewhere arrive through `subscribe()`.
 *
 * Today the ports are document-shaped (the whole list of users, of workflows...) because that is what the dummy data is. Phase 3 refines each one into the operations of the real
 * API once its contract is known (`create`, `update`, `publish`...); stores and screens will not notice, because they only call the port.
 */
export interface DocumentRepository<T> {
  /** The best-known value, available immediately (dummy: the saved data or the fixtures; HTTP: the last fetched value, or an empty seed before the first `hydrate`). */
  snapshot(): T;
  /** Fetch or re-read the source of truth. Called once at start-up (`hydrateServices`) and whenever a fresh copy is wanted. */
  hydrate(): Promise<T>;
  /** Persist the new value (dummy: browser storage; HTTP: the API). Rejects when it could not be saved. */
  save(value: T): Promise<void>;
  /** Be told about changes made elsewhere (another tab, a server push). Returns the function that stops listening. */
  subscribe(listener: (value: T) => void): () => void;
  /** Dummy-data tool: forget everything saved and go back to the fixtures. Real adapters do not have it. */
  resetToSeed?(): T;
}

/** User profiles (no credentials): who exists, their role and extra access, their fleets. */
export type UserService = DocumentRepository<UserRecord[]>;
/** Signing in and credentials. A real implementation is the identity provider; the dummy keeps plain-text passwords in browser storage. */
export interface AuthService {
  /** Check the credentials. Returns the canonical username when they are right, null otherwise. */
  signIn(username: string, password: string): Promise<string | null>;
  /** Set (or create) a person's password: used by Add user and Reset password. */
  setPassword(username: string, password: string): Promise<void>;
  /** Forget a person's credentials (the user was deleted). */
  removeCredentials(username: string): Promise<void>;
}
/** Which person is signed in on this device. `keep` = stay signed in across browser restarts. */
export interface SessionService {
  read(): string | null;
  write(username: string, keep: boolean): void;
  clear(): void;
}
/** The saved workflows, or null when none were saved yet (the store then starts from the sample workflows). */
export interface WorkflowService extends DocumentRepository<Workflows | null> {
  /** Dummy-data only: workflows saved by an older version of the app under another key, for the store's upgrade steps. A real API has no such thing. */
  readLegacy?(): { version: 2 | 3 | 4 | 5 | 6; data: unknown } | null;
}
export type RequestService = DocumentRepository<RequestsDocument>;
export type BookingService = DocumentRepository<BookingsDocument>;
/** Where the trip-id counter (TRP-001, TRP-002...) is kept. A fleet manager owns it later. */
export interface TripIdCounter {
  read(): number;
  write(n: number): void;
}

/**
 * The saved state of one store, for data whose starting values (fixtures) live with the store that owns it: `read()` is what was saved, or null when nothing valid is saved yet (the
 * store then starts from its fixtures). The dummy adapters keep it in browser storage and check it with a schema; a real adapter is the API that owns the data.
 */
export interface SavedState<T> {
  read(): T | null;
  save(value: T): Promise<void>;
  /** Changes made elsewhere (another tab, a server push). */
  subscribe(listener: (value: T) => void): () => void;
  /** Dummy-data tool: forget what was saved. */
  clear(): void;
}
export type DatasetService = SavedState<DatasetData>;
export type FleetProfileService = SavedState<Record<string, FleetProfile>>;
export interface MasterDataDocument {
  materials: Material[];
  groups: MaterialGroup[];
  areas: StagingArea[];
}
export type MasterDataService = SavedState<MasterDataDocument>;
/** Names chosen for maps in the Map Editor, by map id. */
export type MapNameService = SavedState<Record<string, string>>;
export type MapVersionService = SavedState<Record<string, MapHistory>>;
export type SettingsService = SavedState<SettingsData>;
/** Personal preferences, by username. */
export type PreferenceService = SavedState<Record<string, Partial<Preferences>>>;
/** A per-person copy of the notification list, so it is there at once (the notification API stays the source of truth). */
export interface NotificationCacheService {
  forUser(username: string): SavedState<AppNotification[]>;
}
export type ActionLogService = SavedState<Call[]>;
/** Small per-device interface choices (sidebar collapsed, map key open, the page a person left): not business data, never sent to a server. */
export interface DevicePrefs {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface Services {
  dataset: DatasetService;
  fleetProfiles: FleetProfileService;
  masterData: MasterDataService;
  mapNames: MapNameService;
  mapVersions: MapVersionService;
  settings: SettingsService;
  preferences: PreferenceService;
  notificationCache: NotificationCacheService;
  actionLog: ActionLogService;
  device: DevicePrefs;
  users: UserService;
  auth: AuthService;
  session: SessionService;
  workflows: WorkflowService;
  requests: RequestService;
  bookings: BookingService;
  tripIds: TripIdCounter;
}
