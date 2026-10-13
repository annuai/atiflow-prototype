import { store } from '@/core/store';
import { StatsTracker } from '@/core/stats';
import { MeasurementLog } from '@/core/measurements';
import { MockSimulator } from '@/adapters/mock';
import { datasetStore } from '@/data/dataset';
import { fleetDirectory } from '@/data/fleetDirectory';
import { robotRecords, robotsOnFloor } from '@/data/robots';
import type { RosterEntry } from '@/adapters/sim';
import type { NavGraph, RobotTelemetry, SiteLayout, TelemetryAdapter } from '@/core/types';

export const SITE = (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('site')) ?? 'ecc';

/**
 * The one live telemetry feed of the supervisor area. The Dashboard and the Live Floor both read the same robots from the store, so
 * moving between them does not restart the simulation. It starts with the first page that needs it and stops shortly after the last one leaves.
 */
let refs = 0, stopTimer: number | undefined, adapter: TelemetryAdapter | null = null, loaded: Promise<{ site: SiteLayout; nav: NavGraph }> | null = null;
const listeners = new Set<(b: RobotTelemetry[]) => void>(), resetListeners = new Set<() => void>();
let rosterKey = '';
export const liveStats = new StatsTracker();
/** KPI building blocks measured from the live telemetry and events (read by the Reports page). It keeps collecting while the feed runs. */
export const measurements = new MeasurementLog();

function load() {
  return (loaded ??= Promise.all([fetch(`/sites/${SITE}/site.json`).then((r) => r.json() as Promise<SiteLayout>), fetch(`/sites/${SITE}/nav.json`).then((r) => r.json() as Promise<NavGraph>)])
    .then(([site, nav]) => {
      nav.fleets = nav.fleets.map((f) => { const r = fleetDirectory.byLiveId(f.id); return r ? { ...f, name: r.name, color: r.color } : f; });      // one name per fleet across the whole app
      store.getState().setSite(site, nav); return { site, nav };
    }));
}
/** The robots on the floor: the shared dataset's robots that `robotsOnFloor` lets through (assigned to a fleet with a map here, not offline). */
export function rosterFrom(nav: NavGraph): RosterEntry[] {
  const d = datasetStore.getState();
  const list = robotsOnFloor(robotRecords(d), nav.fleets.map((f) => f.id)).map((r): RosterEntry => ({ id: r.id, model: r.type.id, fleetId: r.fleet!.liveId ?? r.fleet!.id, batteryKWh: r.type.batteryKWh }));
  // robots are placed one fleet after the other so every fleet's start positions are spread over its area (all of one fleet first crowds the start)
  const by = new Map<string, RosterEntry[]>(); list.forEach((e) => by.set(e.fleetId, [...(by.get(e.fleetId) ?? []), e]));
  const lanes = [...by.values()]; return Array.from({ length: Math.max(0, ...lanes.map((l) => l.length)) }, (_, i) => lanes.flatMap((l) => (l[i] ? [l[i]] : []))).flat();
}
/** Same robots, types and fleets = same signature. */
export const rosterSignature = (r: RosterEntry[]) => r.map((e) => `${e.id}|${e.model}|${e.fleetId}`).sort().join(',');
async function start() {
  const { site, nav } = await load(); if (adapter || refs === 0) return;
  const roster = rosterFrom(nav); rosterKey = rosterSignature(roster);
  adapter = new MockSimulator(nav, site.siteId, 14, 7, roster);
  adapter.onEvent?.((e) => measurements.event(e));
  adapter.onTelemetry((b) => { store.getState().ingest(b); liveStats.ingest(b); measurements.ingest(b); listeners.forEach((cb) => cb(b)); });
  adapter.connect(); if (import.meta.env.DEV) Object.assign(window, { __adapter: adapter, __measurements: measurements });  // dev-only: lets tests inject faults
}
/** The shared dataset changed what runs on the floor (a robot added, removed, moved to another fleet or type): restart the simulation with the new roster. */
datasetStore.subscribe(() => {
  if (!adapter || !loaded) return; void loaded.then(({ nav }) => {
    if (!adapter || rosterSignature(rosterFrom(nav)) === rosterKey) return;
    stop(); resetListeners.forEach((cb) => cb()); void start();
  });
});
function stop() { adapter?.disconnect(); adapter = null; liveStats.reset(); store.setState({ robots: {}, traffic: {}, events: [], violations: 0 }); }

export const feed = {
  /** Use the feed until the returned function is called. */
  acquire(): () => void { refs++; window.clearTimeout(stopTimer); void start(); let done = false; return () => { if (done) return; done = true; if (--refs === 0) stopTimer = window.setTimeout(stop, 1500); }; },
  /** The site and its navigation graph, once loaded. */
  ready: load,
  /** Called when the simulation restarts with a different set of robots (the views drop the old ones). */
  onReset(cb: () => void) { resetListeners.add(cb); return () => { resetListeners.delete(cb); }; },
  /** Called with every telemetry batch. Returns an unsubscribe function. */
  onBatch(cb: (b: RobotTelemetry[]) => void) { listeners.add(cb); return () => { listeners.delete(cb); }; },
};
