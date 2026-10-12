import { store } from '@/core/store';
import { StatsTracker } from '@/core/stats';
import { MockSimulator } from '@/adapters/mock';
import type { NavGraph, RobotTelemetry, SiteLayout, TelemetryAdapter } from '@/core/types';

export const SITE = new URLSearchParams(location.search).get('site') ?? 'ecc';

/**
 * The one live telemetry feed of the supervisor area. The Dashboard and the Live Floor both read the same robots from the store, so
 * moving between them does not restart the simulation. It starts with the first page that needs it and stops shortly after the last one leaves.
 */
let refs = 0, stopTimer: number | undefined, adapter: TelemetryAdapter | null = null, loaded: Promise<{ site: SiteLayout; nav: NavGraph }> | null = null;
const listeners = new Set<(b: RobotTelemetry[]) => void>();
export const liveStats = new StatsTracker();

function load() {
  return (loaded ??= Promise.all([fetch(`/sites/${SITE}/site.json`).then((r) => r.json() as Promise<SiteLayout>), fetch(`/sites/${SITE}/nav.json`).then((r) => r.json() as Promise<NavGraph>)])
    .then(([site, nav]) => { store.getState().setSite(site, nav); return { site, nav }; }));
}
async function start() {
  const { site, nav } = await load(); if (adapter || refs === 0) return;
  adapter = new MockSimulator(nav, site.siteId);
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
