import { store } from '@/core/store';
import { handle } from '@/ui/engineHandle';
import { StatsTracker } from '@/core/stats';
import { MeasurementLog } from '@/core/measurements';
import { services } from '@/services';
import { datasetStore } from '@/data/dataset';
import { fleetDirectory } from '@/data/fleetDirectory';
import { robotRecords, robotsOnFloor } from '@/data/robots';
import { scopeKey } from '@/features/access';
import { visibleLiveIds } from '@/features/auth';
import { authStore } from '@/features/auth';
import type { RosterEntry } from '@/adapters/sim';
import type {
  ChargeResult,
  FleetEvent,
  NavGraph,
  OrderUpdate,
  RobotTelemetry,
  SiteLayout,
  TelemetryAdapter,
  TransportOrder,
} from '@/core/types';

export const SITE =
  (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('site')) ?? 'ecc';

/**
 * The one live telemetry feed of the supervisor area. The Dashboard and the Live Floor both read the same robots from the store, so
 * moving between them does not restart the simulation. It starts with the first page that needs it and stops shortly after the last one leaves.
 */
let refs = 0,
  stopTimer: number | undefined,
  adapter: TelemetryAdapter | null = null,
  loaded: Promise<{ site: SiteLayout; nav: NavGraph }> | null = null;
const listeners = new Set<(b: RobotTelemetry[]) => void>(),
  resetListeners = new Set<() => void>();
const orderUpdateListeners = new Set<(u: OrderUpdate) => void>(),
  orderStartListeners = new Set<() => void>();
let rosterKey = '';
export const liveStats = new StatsTracker();
/** KPI building blocks measured from the live telemetry and events (read by the Reports page). It keeps collecting while the feed runs. */
export const measurements = new MeasurementLog();

function load() {
  return (loaded ??= Promise.all([
    fetch(`/sites/${SITE}/site.json`).then((r) => r.json() as Promise<SiteLayout>),
    fetch(`/sites/${SITE}/nav.json`).then((r) => r.json() as Promise<NavGraph>),
  ]).then(([site, nav]) => {
    nav.fleets = nav.fleets.map((f) => {
      const r = fleetDirectory.byLiveId(f.id);
      return r ? { ...f, name: r.name, color: r.color } : f;
    }); // one name per fleet across the whole app
    store.getState().setSite(site, nav);
    syncFleets();
    return { site, nav };
  }));
}
/** The robots on the floor: the shared dataset's robots that `robotsOnFloor` lets through (assigned to a fleet with a map here, not offline). */
export function rosterFrom(nav: NavGraph): RosterEntry[] {
  const d = datasetStore.getState();
  const list = robotsOnFloor(
    robotRecords(d),
    nav.fleets.map((f) => f.id),
  ).map((r): RosterEntry => ({
    id: r.id,
    model: r.type.id,
    fleetId: r.fleet!.liveId ?? r.fleet!.id,
    batteryKWh: r.type.batteryKWh,
  }));
  // robots are placed one fleet after the other so every fleet's start positions are spread over its area (all of one fleet first crowds the start)
  const by = new Map<string, RosterEntry[]>();
  list.forEach((e) => by.set(e.fleetId, [...(by.get(e.fleetId) ?? []), e]));
  const lanes = [...by.values()];
  return Array.from({ length: Math.max(0, ...lanes.map((l) => l.length)) }, (_, i) =>
    lanes.flatMap((l) => (l[i] ? [l[i]] : [])),
  ).flat();
}
/** Same robots, types and fleets = same signature. */
export const rosterSignature = (r: RosterEntry[]) =>
  r
    .map((e) => `${e.id}|${e.model}|${e.fleetId}`)
    .sort()
    .join(',');
/**
 * Fleet scope: a supervisor or operator only receives the robots of the fleets they were given (see features/access/fleetScope.ts). The whole app reads the feed
 * through the store, so filtering here is the one place that hides the other fleets from the Live Floor, Dashboard, Reports, alerts and the Action Center.
 * (The simulation itself still runs every fleet, because robots of different fleets meet in shared areas.)
 */
const scoped = (b: RobotTelemetry[]): RobotTelemetry[] => {
  const ids = visibleLiveIds();
  return ids ? b.filter((r) => ids.has(r.fleetId)) : b;
};
const fleetsOf = (e: FleetEvent): string[] => (e.type === 'deadlock' ? e.fleetIds : [e.fleetId]);
const scopeNow = () => {
  const u = authStore.getState().user;
  return u
    ? scopeKey(
        u,
        datasetStore.getState().fleets.map((f) => f.id),
      )
    : '';
};
let scopeSeen = scopeNow();
/** The fleet list shown on the Live Floor (legend, fleet list) holds only the visible fleets. */
function syncFleets() {
  const nav = store.getState().nav;
  if (!nav) return;
  const ids = visibleLiveIds();
  store.setState({ fleets: ids ? nav.fleets.filter((f) => ids.has(f.id)) : nav.fleets });
}
/** A different person or a changed fleet list: drop what the previous scope had collected so nothing from a fleet they no longer see stays on screen. */
function onScopeChange() {
  const k = scopeNow();
  if (k === scopeSeen) return;
  scopeSeen = k;
  store.setState({ robots: {}, traffic: {}, events: [], violations: 0 });
  store.getState().setFleet('all');
  store.getState().setNav('live');
  liveStats.reset();
  measurements.reset();
  syncFleets();
  resetListeners.forEach((cb) => cb());
}
authStore.subscribe(onScopeChange);
datasetStore.subscribe(onScopeChange);
async function start() {
  const { site, nav } = await load();
  if (adapter || refs === 0) return;
  const roster = rosterFrom(nav);
  rosterKey = rosterSignature(roster);
  adapter = services().fleetFeed.connect({ siteId: site.siteId, nav, roster });
  adapter.onEvent?.((e) => {
    const ids = visibleLiveIds();
    if (!ids || fleetsOf(e).some((f) => ids.has(f))) measurements.event(e);
  });
  adapter.onTelemetry((all) => {
    const b = scoped(all);
    store.getState().ingest(b);
    liveStats.ingest(b);
    measurements.ingest(b);
    listeners.forEach((cb) => cb(b));
  });
  adapter.onOrderUpdate?.((u) => orderUpdateListeners.forEach((cb) => cb(u)));
  adapter.connect();
  orderStartListeners.forEach((cb) => cb()); // (people's requests that were waiting for the floor are handed over now)
  if (import.meta.env.DEV) Object.assign(window, { __adapter: adapter, __measurements: measurements }); // dev-only: lets tests inject faults
}
/** The shared dataset changed what runs on the floor (a robot added, removed, moved to another fleet or type): restart the simulation with the new roster. */
datasetStore.subscribe(() => {
  if (!adapter || !loaded) return;
  void loaded.then(({ nav }) => {
    if (!adapter || rosterSignature(rosterFrom(nav)) === rosterKey) return;
    stop();
    resetListeners.forEach((cb) => cb());
    void start();
  });
});
function stop() {
  adapter?.disconnect();
  adapter = null;
  liveStats.reset();
  store.setState({ robots: {}, traffic: {}, events: [], violations: 0 });
}

/** Commands to robots on the floor. */
const robotCommands = {
  /** Send a robot to the nearest free charger (the fleet refuses a robot that is on a work trip, offline, in error or already charging). */
  sendToCharger(id: string): ChargeResult {
    return adapter?.sendToCharger?.(id) ?? { ok: false, reason: 'not-running' };
  },
};
handle.sendToCharger = robotCommands.sendToCharger; // the robot window (ui layer) reaches it through the handle

export const feed = {
  robots: robotCommands,
  /** Requests for transport trips (see `TransportOrder`): handed to the running fleet; updates come back as robots take them and finish. */
  orders: {
    /** false when the floor is not running yet (it is handed over when it starts, see `onStart`) or the fleet refused the order. */
    submit(o: TransportOrder): boolean {
      return adapter?.submitOrder?.(o) ?? false;
    },
    /** true when the order was taken back; false once a robot is on its way with it (or the floor is not running). */
    cancel(id: string): boolean {
      return adapter?.cancelOrder?.(id) ?? false;
    },
    onUpdate(cb: (u: OrderUpdate) => void) {
      orderUpdateListeners.add(cb);
      return () => {
        orderUpdateListeners.delete(cb);
      };
    },
    /** The floor (re)started: orders that were not finished must be handed over again. */
    onStart(cb: () => void) {
      orderStartListeners.add(cb);
      return () => {
        orderStartListeners.delete(cb);
      };
    },
    get running() {
      return adapter !== null;
    },
  },
  /** Use the feed until the returned function is called. */
  acquire(): () => void {
    refs++;
    window.clearTimeout(stopTimer);
    void start();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      if (--refs === 0) stopTimer = window.setTimeout(stop, 1500);
    };
  },
  /** The site and its navigation graph, once loaded. */
  ready: load,
  /** Called when the simulation restarts with a different set of robots (the views drop the old ones). */
  onReset(cb: () => void) {
    resetListeners.add(cb);
    return () => {
      resetListeners.delete(cb);
    };
  },
  /** Called with every telemetry batch. Returns an unsubscribe function. */
  onBatch(cb: (b: RobotTelemetry[]) => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
