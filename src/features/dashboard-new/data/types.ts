import type { RobotTelemetry, SiteLayout, Station } from '@/core/types';

/**
 * What the dashboard needs from the outside world, in one object. A `DashboardSource` produces it: today from the live simulator feed (`source.ts`),
 * later from the real fleet API. Nothing below this file knows where the data comes from.
 */
export interface FleetInfo { id: string; name: string; color: string }
export interface DashboardInput { now: number; robots: RobotTelemetry[]; stations: Station[]; fleets: FleetInfo[]; site: SiteLayout | null }
export interface DashboardSource { subscribe(onInput: (input: DashboardInput) => void): () => void }

/** One line of what the robots are doing (every robot is in exactly one group). */
export type StateGroup = 'moving' | 'working' | 'waiting' | 'charging' | 'parked' | 'idle' | 'attention' | 'offline';
export type Level = 'ok' | 'warn' | 'critical';

export interface StatusSummary { level: Level; headline: string; detail: string }
export interface Kpi { id: 'working' | 'trips' | 'utilisation' | 'health' | 'alerts'; label: string; value: number; unit?: '%'; of?: number; series: number[]; trend: number | null; tone: 'neutral' | 'good' | 'warn' | 'bad' }
export interface FleetState { id: string; name: string; color: string; total: number; counts: Record<StateGroup, number> }
export interface AttentionItem { id: string; robotId: string; fleetName: string; level: Exclude<Level, 'ok'>; kind: 'blocked' | 'error' | 'waiting' | 'battery'; title: string; detail: string; seconds: number }
export interface TripRow { id: string; robotId: string; fleetName: string; kind: string; origin?: string; stops: string[]; destination: string; destinationName: string; leg: number; progress: number; state: string; seconds: number; done?: boolean; at?: number }
export interface BatteryView { buckets: { label: string; count: number; low: boolean }[]; low: { id: string; battery: number; charging: boolean }[]; chargers: { id: string; robotId: string | null }[]; parking: { total: number; free: number }; average: number }
export interface Hotspot { place: string; label: string; seconds: number; waitingNow: number }
export interface HistoryPoint { t: number; utilisation: number; trips: number; waiting: number; attention: number }

export interface DashboardSnapshot {
  now: number; site: SiteLayout | null; robots: RobotTelemetry[];
  status: StatusSummary; kpis: Kpi[]; fleets: FleetState[]; attention: AttentionItem[];
  trips: { running: TripRow[]; recent: TripRow[] }; battery: BatteryView; hotspots: Hotspot[];
  history: HistoryPoint[]; /** seconds of history behind the charts (how long the page has been collecting) */ historySeconds: number;
}
