import { store } from '@/core/store';
import { handle } from '@/ui/engineHandle';
import { StatsTracker } from '@/core/stats';
import { MeasurementLog } from '@/core/measurements';
import { services } from '@/services';
import { datasetStore } from '@/data/dataset';
import { fleetDirectory } from '@/data/fleetDirectory';
import { robotRecords, robotsOnFloor } from '@/data/robots';
import { scopeKey } from '@/features/access';
import { fleetsStore } from '@/features/fleets';
import { latestOf, mapVersionsStore } from '@/features/map-editor';
import { mapsStore } from '@/data/maps';
import { layoutOf } from '@/features/map-import';
import { visibleLiveIds } from '@/features/auth';
import { buildWorld, type World } from './world/buildWorld';
import { authStore } from '@/features/auth';
import type { RosterEntry } from '@/adapters/sim';
import type {
  ChargeResult,
  RelocalizeResult,
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
  adapter: TelemetryAdapter | null = null;
const listeners = new Set<(b: RobotTelemetry[]) => void>(),
  resetListeners = new Set<() => void>();
const orderUpdateListeners = new Set<(u: OrderUpdate) => void>(),
  orderStartListeners = new Set<() => void>();
let rosterKey = '';
export const liveStats = new StatsTracker();
/** KPI building blocks measured from the live telemetry and events (read by the Reports page). It keeps collecting while the feed runs. */
export const measurements = new MeasurementLog();

/** The latest PUBLISHED version of a map somebody has edited (a map nobody edited is only a copy of the base lane map: the base is used for it). */
function publishedOf(mapId: string) {
  const h = mapVersionsStore.getState().byMap[mapId];
  const v = latestOf(h);
  return v && !(h!.versions.length === 1 && v.createdBy === 'System') ? v.data : null;
}

/** The base site and lane map (fetched once) and the WORLD built from them and from the fleets, their maps and the published versions (rebuilt whenever one of those changes). */
let base: Promise<{ site: SiteLayout; nav: NavGraph }> | null = null;
let world: World | null = null;
const worldListeners = new Set<() => void>();
function refreshWorld(b: { site: SiteLayout; nav: NavGraph }): World {
  b.nav.fleets = b.nav.fleets.map((f) => {
    const r = fleetDirectory.byLiveId(f.id);
    return r ? { ...f, name: r.name, color: r.color } : f;
  }); // one name per fleet across the whole app
  const next = buildWorld({
    baseSite: b.site,
    baseNav: b.nav,
    fleets: datasetStore.getState().fleets,
    profiles: fleetsStore.getState().profiles,
    maps: mapsStore.getState().maps,
    published: publishedOf,
    structure: (d) => layoutOf(d, 'dwg') ?? null,
  });
  if (world?.signature === next.signature) return world;
  world = next;
  store.getState().setSite(next.site, next.nav);
  syncFleets();
  worldListeners.forEach((cb) => cb());
  return next;
}
function load() {
  return (base ??= Promise.all([
    fetch(`/sites/${SITE}/site.json`).then((r) => r.json() as Promise<SiteLayout>),
    fetch(`/sites/${SITE}/nav.json`).then((r) => r.json() as Promise<NavGraph>),
  ]).then(([site, nav]) => ({ site, nav }))).then((b) => {
    const w = refreshWorld(b);
    // `site` / `nav` are the BASE (what the Map Editor seeds a first map version from); `live` and `world` are what the floor runs on
    return { site: b.site, nav: b.nav, live: w.nav, world: w };
  });
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
  const { world: w } = await load();
  if (adapter || refs === 0) return;
  const nav = w.nav;
  const roster = rosterFrom(nav);
  rosterKey = rosterSignature(roster);
  adapter = services().fleetFeed.connect({ siteId: w.site.siteId, nav, roster });
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
/**
 * Something that decides what is on the floor changed (a fleet created or renamed, a map assigned or published, a robot added or moved): rebuild the world and, when the floor is running
 * and the world or its robots really are different, restart the simulation with them. A short pause lets a burst of changes (one click can touch three stores) count once.
 */
let reconcileTimer: ReturnType<typeof setTimeout> | undefined;
function reconcile() {
  if (!base) return; // nobody has looked at the floor yet: it is built when somebody does
  clearTimeout(reconcileTimer);
  reconcileTimer = setTimeout(() => {
    void base?.then((b) => {
      const before = world?.signature;
      const w = refreshWorld(b);
      if (!adapter || (w.signature === before && rosterSignature(rosterFrom(w.nav)) === rosterKey)) return;
      stop();
      resetListeners.forEach((cb) => cb());
      void start();
    });
  }, 60);
}
datasetStore.subscribe(reconcile);
fleetsStore.subscribe(reconcile);
mapsStore.subscribe(reconcile);
mapVersionsStore.subscribe(reconcile);
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
  /** Ask a robot that was moved by hand to find its place on the map again (refused while it drives or is offline). */
  relocalize(id: string): RelocalizeResult {
    return adapter?.relocalize?.(id) ?? { ok: false, reason: 'not-running' };
  },
};
handle.relocalize = robotCommands.relocalize;
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
  /** The base site and lane map plus the world the floor runs on (`live`, `world`), once loaded. */
  ready: load,
  /** The world as it is now (null before the first load). */
  world: () => world,
  /** Called when the world was rebuilt and is different (a fleet got a map, a map was published...): the 3D scene must be built again. */
  onWorld(cb: () => void) {
    worldListeners.add(cb);
    return () => {
      worldListeners.delete(cb);
    };
  },
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
