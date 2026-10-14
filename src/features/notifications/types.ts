import type { PublicUser } from '@/features/auth/types';

/** Who a notification is for: the workspaces that have notifications. A user receives those of every workspace they can enter (a superuser both). */
export type Audience = 'supervisor' | 'configurator' | 'operator';

export type NotificationLevel = 'critical' | 'warn' | 'info' | 'success';
/** What a button on a notification does. Plain data (not a function) so notifications can be saved and sent by a backend. */
export type NotificationAction = { kind: 'locate'; robotId: string } | { kind: 'live-floor' };
export interface AppNotification {
  /** Unique and stable: a source that emits the same id twice is not shown twice. */
  id: string;
  /** What it is about (a robot problem, new stock, an MES sync...): picks the icon. */
  kind: 'blocked' | 'error' | 'stuck' | 'battery' | 'stock' | 'mes';
  level: NotificationLevel; title: string; body?: string;
  /** epoch ms */
  at: number; read: boolean;
  /** Buttons (none for information only). */
  actions?: NotificationAction[];
}
export type NewNotification = Omit<AppNotification, 'read'>;

/**
 * Where one kind of notification comes from. `start` begins delivering through `emit` and returns a stop function.
 * Today the sources are the live robot feed (supervisors) and a mock MES feed (configurators); a backend or websocket source replaces them without touching the page.
 */
export interface NotificationSource { start(emit: (items: NewNotification[]) => void): () => void }
export type SourcesByAudience = Record<Audience, () => NotificationSource[]>;

/**
 * The one thing the notification feature needs from the outside: where a user's notifications come from and where read state goes.
 * `history` (optional) loads what already exists, `subscribe` delivers new ones as they happen (return the stop function), `markRead` (optional) tells the server.
 * Today `localApi` (sources in this app); later `restApi` or your own implementation, chosen in `index.ts`: nothing else changes.
 */
export interface NotificationApi {
  history?(user: PublicUser): Promise<NewNotification[]>;
  subscribe(user: PublicUser, emit: (items: NewNotification[]) => void): () => void;
  markRead?(user: PublicUser, ids: string[]): Promise<void>;
}
