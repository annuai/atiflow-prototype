import { store } from '@/core/store';
import { StatsTracker } from '@/core/stats';
import { MockSimulator } from '@/adapters/mock';
import { datasetStore } from '@/data/dataset';
import { fleetDirectory } from '@/data/fleetDirectory';
import type { RosterEntry } from '@/adapters/sim';
import type { NavGraph, RobotTelemetry, SiteLayout, TelemetryAdapter } from '@/core/types';

export const SITE = (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('site')) ?? 'ecc';

/**
 * The one live telemetry feed of the supervisor area. The Dashboard and the Live Floor both read the same robots from the store, so
 * moving between them does not restart the simulation. It starts with the first page that needs it and stops shortly after the last one leaves.
 */
let refs = 0, stopTimer: number | undefined, adapter: TelemetryAdapter | null = null, loaded: Promise<{ site: SiteLayout; nav: NavGraph }> | null = null;
const listeners = new Set<(b: RobotTelemetry[]) => void>();
export const liveStats = new StatsTracker();

function load() {
  return (loaded ??= Promise.all([fetch(`/sites/${SITE}/site.json`).then((r) => r.json() as Promise<SiteLayout>), fetch(`/sites/${SITE}/nav.json`).then((r) => r.json() as Promise<NavGraph>)])
    .then(([site, nav]) => {
      nav.fleets = nav.fleets.map((f) => { const r = fleetDirectory.byLiveId(f.id); return r ? { ...f, name: r.name, color: r.color } : f; });      // one name per fleet across the whole app
      store.getState().setSite(site, nav); return { site, nav };
    }));
}
/** The robots on the floor: the dataset's robots that are assigned to a fleet with a map here and are not offline. */
export function rosterFrom(nav: NavGraph): RosterEntry[] {
  const d = datasetStore.getState();
  const list = d.robot.flatMap((r) => {
    const fleet = d.fleets.find((f) => f.name === r.values.fleet); const fleetId = fleet && (fleet.liveId ?? fleet.id);
    if (!fleetId || r.status === 'offline' || !nav.fleets.some((f) => f.id === fleetId)) return [];
    return [{ id: String(r.values.name), model: r.values.sherpaType === 'Tug 3T' ? 'sherpa-tug' : 'sherpa-xt-lite', fleetId }];
  });
  // robots are placed one fleet after the other so every fleet's start positions are spread over its area (all of one fleet first crowds the start)
  const by = new Map<string, RosterEntry[]>(); list.forEach((e) => by.set(e.fleetId, [...(by.get(e.fleetId) ?? []), e]));
  const lanes = [...by.values()]; return Array.from({ length: Math.max(0, ...lanes.map((l) => l.length)) }, (_, i) => lanes.flatMap((l) => (l[i] ? [l[i]] : []))).flat();
}
async function start() {
  const { site, nav } = await load(); if (adapter || refs === 0) return;
  adapter = new MockSimulator(nav, site.siteId, 14, 7, rosterFrom(nav));
  adapter.onTelemetry((b) => { store.getState().ingest(b); liveStats.ingest(b); listeners.forEach((cb) => cb(b)); });
  adapter.connect(); if (import.meta.env.DEV) Object.assign(window, { __adapter: adapter });  // dev-only: lets tests inject faults
}
function stop() { adapter?.disconnect(); adapter = null; liveStats.reset(); store.setState({ robots: {}, traffic: {}, events: [], violations: 0 }); }

export const feed = {
  /** Use the feed until the returned function is called. */
  acquire(): () => void { refs++; window.clearTimeout(stopTimer); void start(); let done = false; return () => { if (done) return; done = true; if (--refs === 0) stopTimer = window.setTimeout(stop, 1500); }; },
  /** The site and its navigation graph, once loaded. */
  ready: load,
  /** Called with every telemetry batch. Returns an unsubscribe function. */
  onBatch(cb: (b: RobotTelemetry[]) => void) { listeners.add(cb); return () => { listeners.delete(cb); }; },
};
