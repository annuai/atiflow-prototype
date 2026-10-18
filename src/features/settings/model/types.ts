/** Settings: connections to other systems (Fleet Manager, MES) and general settings of the site. Pure data: no React. */
export type ConnectionId = 'fleet-manager' | 'mes';
export type FieldKind = 'host' | 'url' | 'text' | 'secret';
export interface ConnectionField {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder: string;
  /** The connection cannot work without it. */ required: boolean;
  /** Fields with the same group sit under one heading in the edit dialog (e.g. "Fleet Manager Credentials"); none = the main block. */
  group?: string;
  /** Small help text under the field. */
  hint?: string;
}
export interface ConnectionDef {
  id: ConnectionId;
  name: string;
  initials: string;
  /** Avatar colour (hex). */
  color: string;
  fields: ConnectionField[];
  /** A connection that keeps data in step has a "Sync now" and a last-synced time. */
  syncs: boolean;
}
export interface TestResult {
  ok: boolean;
  message: string;
  at: number;
}
export interface ConnectionState {
  values: Record<string, string>;
  lastSynced?: number;
  lastTest?: TestResult;
}
type ConnectionStatus = 'connected' | 'issues';
export interface StatusView {
  status: ConnectionStatus;
  headline: string;
  detail: string;
}

export type Units = 'metric' | 'imperial';
export interface GeneralSettings {
  siteName: string;
  timeZone: string;
  units: Units;
  language: string;
}
export interface SettingsData {
  version: 1;
  connections: Record<ConnectionId, ConnectionState>;
  general: GeneralSettings;
}
