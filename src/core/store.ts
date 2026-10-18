import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { RulesIndex, type TrafficZoneState } from './rules';
import type { CameraMode, FleetDef, LayerKey, NavGraph, RobotTelemetry, SiteLayout } from './types';

interface AppEvent {
  ts: number;
  robotId: string;
  text: string;
  level: 'info' | 'warn' | 'critical';
}
export interface AppState {
  site: SiteLayout | null;
  nav: NavGraph | null;
  rules: RulesIndex | null;
  fleets: FleetDef[];
  fleetId: string | 'all'; // map filter (sidebar fleet items and the in-canvas dropdown both set it)
  navSel: string; // sidebar highlight, independent of the filter: 'live' | 'fleet:all' | 'fleet:<id>'
  robots: Record<string, RobotTelemetry>;
  traffic: Record<string, TrafficZoneState>;
  violations: number;
  events: AppEvent[];
  selectedId: string | null;
  selectedStationId: string | null;
  activeZoneId: string | null;
  /** The big robot window. Closing it only hides the window: the robot stays selected (and followed) and a small window remains to reopen it. */
  robotPanelOpen: boolean;
  cameraMode: CameraMode;
  layers: Record<LayerKey, boolean>;
  query: string;
  paused: boolean;
  setSite(s: SiteLayout, n: NavGraph): void;
  ingest(batch: RobotTelemetry[]): void;
  select(id: string | null): void;
  closeRobotPanel(): void;
  openRobotPanel(): void;
  selectStation(id: string | null): void;
  setZone(id: string | null): void;
  setCameraMode(m: CameraMode): void;
  toggleLayer(k: LayerKey): void;
  setFleet(id: string | 'all'): void;
  setQuery(q: string): void;
  setPaused(p: boolean): void;
  setNav(sel: string): void;
}

const activeRuleAlerts = new Set<string>();

export const store = createStore<AppState>((set, get) => ({
  site: null,
  nav: null,
  rules: null,
  fleets: [],
  fleetId: 'all',
  navSel: 'live',
  robots: {},
  traffic: {},
  violations: 0,
  events: [],
  selectedId: null,
  selectedStationId: null,
  activeZoneId: null,
  robotPanelOpen: true,
  cameraMode: 'orbit',
  query: '',
  paused: false,
  layers: { robots: true, routes: true, stations: true, zones: true, labels: true, equipment: true, alerts: true },
  setSite: (site, nav) => set({ site, nav, rules: new RulesIndex(nav, site), fleets: nav.fleets }),
  ingest: (batch) => {
    const { rules, robots: prev } = get();
    const robots = { ...prev };
    const added: AppEvent[] = [];
    const traffic = rules ? rules.traffic(batch) : {};
    const nowKeys = new Set<string>();
    let violations = 0;
    for (const t0 of batch) {
      const p = prev[t0.id];
      const ruleAlerts = rules ? rules.check(t0).map((a) => ({ code: a.code, severity: a.severity, msg: a.msg })) : [];
      for (const z of Object.values(traffic))
        if (z.over && z.occupants.includes(t0.id))
          ruleAlerts.push({
            code: 'TRAFFIC_VIOLATION',
            severity: 'critical',
            msg: `${z.zone.name} over capacity (${z.occupants.length}/${z.zone.capacity})`,
          });
      for (const a of ruleAlerts) {
        const k = t0.id + '|' + a.code;
        nowKeys.add(k);
        violations++;
        if (!activeRuleAlerts.has(k))
          added.push({ ts: t0.ts, robotId: t0.id, text: `${t0.id}: ${a.msg}`, level: 'critical' });
      }
      if (p && p.state !== t0.state && ['blocked', 'error', 'charging', 'offline'].includes(t0.state))
        added.push({
          ts: t0.ts,
          robotId: t0.id,
          text: `${t0.id} is now ${t0.state}`,
          level: t0.state === 'error' || t0.state === 'blocked' ? 'critical' : 'info',
        });
      robots[t0.id] = { ...t0, alerts: [...(t0.alerts ?? []), ...ruleAlerts] };
    }
    activeRuleAlerts.clear();
    nowKeys.forEach((k) => activeRuleAlerts.add(k));
    set({ robots, traffic, violations, events: [...added, ...get().events].slice(0, 40) });
  },
  select: (selectedId) =>
    set({ selectedId, robotPanelOpen: true, selectedStationId: selectedId ? null : get().selectedStationId }),
  closeRobotPanel: () => set({ robotPanelOpen: false }),
  openRobotPanel: () => set({ robotPanelOpen: true }),
  selectStation: (selectedStationId) =>
    set({ selectedStationId, selectedId: selectedStationId ? null : get().selectedId }),
  setZone: (activeZoneId) => set({ activeZoneId }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  toggleLayer: (k) => set({ layers: { ...get().layers, [k]: !get().layers[k] } }),
  setFleet: (fleetId) => set({ fleetId }),
  setNav: (navSel) => set({ navSel }),
  setQuery: (query) => set({ query }),
  setPaused: (paused) => set({ paused }),
}));
export const useApp = <T>(sel: (s: AppState) => T) => useStore(store, sel);
export type { TrafficZoneState };
