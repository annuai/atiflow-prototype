import { LaneGraph, pointAt, type PathPlan } from '../core/lanes';
import { angleDiff, pointInPoly } from '../core/geom';
import type { TripIdSource } from '../data/tripIds';
import type {
  ChargeResult,
  FleetEvent,
  NavGraph,
  OrderUpdate,
  RobotState,
  RobotTelemetry,
  TransportOrder,
  Vec2,
} from '../core/types';

const rng = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const HOLD = 2.4,
  V = 1.1,
  ACC = 1.2,
  DEC = 3,
  TD = 1.3; // hold distance before an intersection / traffic zone, cruise speed, accel / brake (m/s^2), robot centre -> trolley centre
const REROUTE_AFTER = 6; // seconds stopped by an obstacle before the robot looks for another road
const TURN_RATE = 2.5; // rad/s: the robot turns at most this fast, and slows down while its heading lags behind the route
const CLEAR = 0.01,
  CLAIM = 3.2,
  SAMPLE = 0.35; // gap kept between footprints; how far ahead a robot reserves its way; spacing of the checked positions
const GROUP_GAP = 1.5,
  EXIT_SPACE = 1.5; // intersections closer than this along a route are permitted together; free road needed beyond an intersection before entering it
const FAULT_RATE = 0.00008; // per second of driving: about one fault per 3.5 h of driving per robot (only when faults are switched on)
const SLA_FACTOR = 3,
  SLA_BASE = 90,
  SLA_PER_STOP = 15; // a work trip is due 90 s + 3 x the drive time at cruise speed + 15 s per stop after it was assigned (PLACEHOLDER: replace with the customer's SLA)
const STUCK_ALERT = 90,
  CYCLE_AFTER = 3; // seconds waiting before a robot asks for help; seconds a wait cycle may last before it is broken
/** Footprints are chains of circles: the robot (1.2 x 0.85 m) and the trolley it tows (1.1 x 0.7 m). Opposite lanes are about 0.95 m apart, so neighbours in parallel lanes pass each other. */
type Circle = { x: number; y: number; r: number };
type Pose = { x: number; y: number; th: number };
const ROBOT_R = 0.435,
  TROLLEY_R = 0.375; // the circle chains cover the 1.2 x 0.85 m body with about 1 cm to spare
const TURN_R = 0.47; // turning on the spot swings the corners of the 1.2 x 0.85 m body out past the circle chain, so that check uses wider circles
export const robotCircles = (p: Pose, r = ROBOT_R): Circle[] =>
  [-0.45, -0.15, 0.15, 0.45].map((o) => ({ x: p.x + Math.cos(p.th) * o, y: p.y + Math.sin(p.th) * o, r }));
export const trolleyCircles = (p: Pose, r = TROLLEY_R): Circle[] =>
  [-0.4, -0.13, 0.13, 0.4].map((o) => ({ x: p.x + Math.cos(p.th) * o, y: p.y + Math.sin(p.th) * o, r }));
const hit = (a: Circle[], b: Circle[]) =>
  a.some((p) => b.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r + CLEAR));

/** One permit request along a route: the traffic zones and intersections it passes through, within `GROUP_GAP` of each other, taken all together or not at all. */
interface Span {
  id: string;
  exitS: number;
  lanes?: string[];
} // lanes: the lanes the route uses inside the intersection (robots on the same lanes may follow each other through)
interface Entry {
  s: number;
  exitS: number;
  hold: number;
  zones: Span[];
  xings: Span[];
} // each permit is given back when its own span is left
interface Bot {
  id: string;
  model: string;
  fleetId: string;
  pos: Vec2;
  theta: number;
  battery: number;
  state: RobotState;
  node: string;
  stationId: string | null;
  plan: PathPlan | null;
  s: number;
  entries: Entry[];
  entryIdx: number;
  holds: Map<string, number>;
  locks: Map<string, number>;
  waitingZone: string | null;
  waitReason: 'traffic' | 'headway' | 'intersection' | null;
  timer: number;
  speed: number;
  v: number;
  blockedUntil: number;
  loaded: boolean;
  nextLoaded: boolean;
  attached: boolean;
  trailer: Pose | null;
  prio: number;
  gateAt: number;
  gateOk: boolean;
  stoppedSince: number;
  rerouteAt: number;
  queued: Entry | null;
  ticket: number;
  ticketFor: Entry | null;
  waitsOn: string[];
  waitSince: number;
  gateBlock: string | null;
  resolvedAt: number;
  odoEmpty: number;
  odoLoaded: number;
  energyKWh: number;
  kWh: number;
  faultUntil: number;
  /** someone asked for this robot to go to a charger: its next trip is a charge trip */ chargeRequested: boolean;
  trip: Trip | null;
  task: RobotTelemetry['task'];
  payload: RobotTelemetry['payload'];
  dest: string | null;
  lane: string | null;
}
/** One piece of work for one robot: from where it stands, past the stops, to the destination (the last of `legs`). `leg` is the one it is driving now. */
interface Trip {
  assignedAtS: number;
  startedAtS: number | null;
  deadlineS: number | null;
  id: string;
  kind: 'transport' | 'return' | 'charge' | 'park';
  origin?: string;
  legs: string[];
  leg: number;
  loaded: boolean;
  payload: RobotTelemetry['payload'];
  /** A requested trip: its order id, and the leg from which the load is carried (the legs before it are driven empty). Ordinary trips carry from the start. */ orderId?: string;
  loadFrom?: number;
}
/** Stations that work is sent to (not parking spots or chargers). */
const WORK = (s: NavGraph['stations'][number]) => s.type !== 'charge' && s.type !== 'park';
const LEAVE_CLEAR = 3; // m: until a robot has driven this far from its station the station still counts as taken by it
const FAR = 30; // m: a trip's destination is at least this far from where it starts (when the fleet has such a station)
interface Permit {
  occ: Set<string>;
  waiters: Set<string>;
  lanes?: Map<string, Set<string>>;
}

/** Pure, deterministic fleet simulation (no timers). Obeys the same rules a real fleet does: fleet-confined lanes, directed lanes, one direction of travel (robots never reverse),
 *  a permit ("visa") for every intersection and traffic zone (one robot in, the others wait at the hold point until it is clear), no touching, no forbidden zones (lanes avoid them). */
/** A robot to put on the floor: its name, model and the lane-map fleet it belongs to (from the shared dataset). Without a roster the sim makes up `count` robots. */
export interface RosterEntry {
  id: string;
  model: string;
  fleetId: string;
  /** Battery capacity, to turn battery % into energy (kWh). */ batteryKWh?: number;
}
export interface SimOptions {
  /** Rare random faults that need manual help (off in the traffic benchmarks). */ faults?: boolean;
  /** Where trip ids come from (shared with the requests); without it the simulation counts its own. */ tripIds?: TripIdSource;
}
export class FleetSim {
  readonly graph: LaneGraph;
  bots: Bot[] = [];
  time = 0;
  private rand: () => number;
  tripSeq = 0;
  zones = new Map<string, Permit>();
  private xings = new Map<string, Permit>();
  /** Moments since the last `drainEvents()`. */
  private events: FleetEvent[] = [];
  private t0 = Date.now();
  private faultRand: () => number;
  private at(s: number) {
    return Math.round(this.t0 + s * 1000);
  }
  /** Hand over (and forget) the events that happened since the last call. */
  drainEvents(): FleetEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
  constructor(
    nav: NavGraph,
    private siteId: string,
    count = 14,
    seed = 7,
    roster?: RosterEntry[],
    private opts: SimOptions = {},
  ) {
    this.graph = new LaneGraph(nav);
    this.rand = rng(seed);
    this.faultRand = rng(seed ^ 0x9e3779b9);
    nav.trafficZones.forEach((z) => this.zones.set(z.id, { occ: new Set(), waiters: new Set() }));
    const used = new Set<string>();
    for (let i = 0; i < (roster ? roster.length : count); i++) {
      const fleet = roster ? roster[i].fleetId : nav.fleets[i % nav.fleets.length].id;
      const spot = (s: NavGraph['stations'][number]) => this.graph.nodes.get(s.nodeId)!;
      const apart = (s: NavGraph['stations'][number]) =>
        this.bots.every((o) => Math.hypot(o.pos.x - spot(s).x, o.pos.y - spot(s).y) > 4); // parked robots start well apart
      let own = nav.stations.filter((s) => s.fleets.includes(fleet) && WORK(s) && !used.has(s.id) && apart(s));
      if (!own.length) own = nav.stations.filter((s) => s.fleets.includes(fleet) && !used.has(s.id));
      const st = own[Math.floor(this.rand() * own.length)];
      used.add(st.id);
      const n = this.graph.nodes.get(st.nodeId)!;
      const bot: Bot = {
        id: roster ? roster[i].id : `AMR-${String(i + 1).padStart(3, '0')}`,
        model: roster ? roster[i].model : i % 5 === 4 ? 'pallet-mover' : 'sherpa-xt-lite',
        fleetId: fleet,
        pos: { x: n.x, y: n.y },
        theta: 0,
        battery: 45 + this.rand() * 55,
        state: 'idle',
        node: n.id,
        stationId: st.id,
        plan: null,
        s: 0,
        entries: [],
        entryIdx: 0,
        holds: new Map(),
        locks: new Map(),
        waitingZone: null,
        waitReason: null,
        timer: this.rand() * 4,
        speed: 0,
        v: 0,
        blockedUntil: 0,
        loaded: false,
        nextLoaded: i % 2 === 0,
        attached: false,
        trailer: null,
        prio: 0,
        gateAt: -9,
        gateOk: true,
        stoppedSince: -1,
        rerouteAt: -99,
        queued: null,
        ticket: 0,
        ticketFor: null,
        waitsOn: [],
        waitSince: -1,
        gateBlock: null,
        resolvedAt: -99,
        odoEmpty: 0,
        odoLoaded: 0,
        energyKWh: 0,
        kWh: roster?.[i].batteryKWh ?? 3,
        faultUntil: 0,
        chargeRequested: false,
        trip: null,
        task: null,
        payload: null,
        dest: null,
        lane: null,
      };
      this.bots.push(bot);
    }
  }
  private newTripId(): string {
    return this.opts.tripIds?.next() ?? `TRP-${String(++this.tripSeq).padStart(3, '0')}`;
  }
  private undoTripId() {
    if (this.opts.tripIds) this.opts.tripIds.undo();
    else this.tripSeq--;
  }
  private incoming(id: string) {
    return this.bots.filter((b) => b.dest === id).length;
  }
  private parked(b: Bot) {
    return b.state === 'idle' || b.state === 'working' || b.state === 'charging';
  }
  /** Nodes where a robot stands still: other robots are never routed through them. */
  /** The station a robot is physically at: the one it is parked at, or, until it has driven clear of it, the one its trip started from (it still stands there while it waits to leave). */
  private standsAt(o: Bot): string | null {
    return o.stationId ?? (o.plan && o.s < LEAVE_CLEAR ? (o.task?.from ?? null) : null);
  }
  private occupiedNodes(except: Bot) {
    return new Set(
      this.bots
        .filter((o) => o !== except && ((o.stationId && this.parked(o)) || (o.plan && o.s < 0.5)))
        .map((o) => o.node),
    );
  }
  private planRoute(b: Bot): boolean {
    return b.trip ? this.startLeg(b) : this.startTrip(b);
  }
  /** Task shown to the supervisor: the trip's id, its stops and destination, which leg is being driven. */
  private syncTask(b: Bot, frac = 0) {
    const t = b.trip;
    if (!t || !b.task) return;
    Object.assign(b.task, {
      id: t.id,
      type: t.kind,
      to: t.legs[t.legs.length - 1],
      next: t.legs[t.leg],
      stops: t.legs.slice(0, -1),
      leg: t.leg,
      origin: t.origin,
      progress: Math.min(1, (t.leg + frac) / t.legs.length),
    });
  }
  /** Drive the next leg of the robot's trip: a stop that is taken or cannot be reached is skipped, an unreachable destination ends the trip. */
  private startLeg(b: Bot): boolean {
    const t = b.trip!;
    const g = this.graph;
    const avoid = this.occupiedNodes(b);
    const stationNodes = new Set(g.nav.stations.map((q) => q.nodeId));
    while (t.leg < t.legs.length) {
      const id = t.legs[t.leg];
      const st = g.station(id)!;
      const spoken = this.bots.some((o) => o !== b && (this.standsAt(o) === id || o.dest === id));
      const lanes = spoken
        ? null
        : (g.route(b.node, st.nodeId, b.fleetId, stationNodes) ??
          g.route(b.node, st.nodeId, b.fleetId, avoid) ??
          g.route(b.node, st.nodeId, b.fleetId)); // when the only way out leads past a parked robot, the robot goes anyway and waits for it to leave (it will: it is only parked between jobs)      // keep to roads without other stations on them when there is one: a parked robot must not block through traffic
      if (lanes && lanes.length) {
        const from = b.stationId ?? undefined;
        const plan = g.plan(lanes, b.pos);
        const carrying = t.loaded && t.leg >= (t.loadFrom ?? 0);
        Object.assign(b, {
          prio: this.time,
          plan,
          s: 0,
          entries: this.entriesOf(plan),
          entryIdx: 0,
          state: 'moving',
          dest: id,
          stationId: null,
          timer: 0,
          v: 0,
          loaded: carrying,
          payload: carrying ? t.payload : null,
          attached: false,
          trailer: null,
          gateAt: -9,
          task: { id: t.id, type: t.kind, from },
        });
        if (t.orderId && t.startedAtS === null)
          this.orderUpdates.push({ id: t.orderId, status: 'ongoing', tripId: t.id, robotId: b.id });
        t.startedAtS ??= this.time;
        this.syncTask(b);
        return true;
      }
      if (t.leg === t.legs.length - 1 || t.orderId) return false; // the destination is never changed: the robot waits and asks again (a requested trip never skips a station: it is the pick-up or drop-off the person asked for)
      t.legs.splice(t.leg, 1);
      this.syncTask(b); // a stop that is taken or cannot be reached is skipped
    }
    return false;
  }
  /** Stations to call at on the way: near the planned route, away from its ends and from each other. */
  private pickStops(
    b: Bot,
    dest: string,
    plan: PathPlan,
    spoken: Set<string>,
    crowded: (s: NavGraph['stations'][number]) => boolean,
  ): string[] {
    const k = Math.min(plan.total > 60 ? 2 : plan.total > 30 ? 1 : 0, Math.floor(this.rand() * 3));
    if (!k) return [];
    const near: { id: string; at: number }[] = [];
    for (const s of this.graph.nav.stations) {
      if (
        !WORK(s) ||
        s.id === dest ||
        s.id === b.stationId ||
        spoken.has(s.id) ||
        !s.fleets.includes(b.fleetId) ||
        crowded(s)
      )
        continue;
      const n = this.graph.nodes.get(s.nodeId)!;
      let best = 1e9,
        at = 0;
      for (let i = 0; i < plan.pts.length; i += 2) {
        const d = Math.hypot(plan.pts[i].x - n.x, plan.pts[i].y - n.y);
        if (d < best) {
          best = d;
          at = plan.cum[i];
        }
      }
      if (best <= 5 && at > 0.2 * plan.total && at < 0.85 * plan.total) near.push({ id: s.id, at });
    }
    const out: { id: string; at: number }[] = [];
    for (const c of near.sort(() => this.rand() - 0.5))
      if (out.length < k && out.every((o) => Math.abs(o.at - c.at) > 12)) out.push(c);
    return out.sort((p, q) => p.at - q.at).map((o) => o.id);
  }
  /** A new trip: loaded out, empty back, or to a charger when the battery is low. Destinations are far from where the robot starts, with stops on the way. */
  private startTrip(b: Bot): boolean {
    if (!b.chargeRequested && this.takeOrder(b)) return true;
    const low = b.battery < 25 || b.chargeRequested;
    const g = this.graph.nav;
    const park =
      !low &&
      b.nextLoaded &&
      g.stations.some((q) => q.type === 'park' && q.fleets.includes(b.fleetId)) &&
      this.rand() < 0.15; // now and then a robot with no work goes to a parking spot and waits
    const kind: 'charge' | 'park' | null = low ? 'charge' : park ? 'park' : null;
    const loaded = !kind && b.nextLoaded;
    const avoid = this.occupiedNodes(b);
    const stationNodes = new Set(g.stations.map((q) => q.nodeId));
    const spoken = new Set(
      this.bots
        .filter((o) => o !== b)
        .flatMap((o) => [this.standsAt(o), o.dest, o.trip?.legs[o.trip.legs.length - 1]])
        .filter((id): id is string => !!id),
    ); // one robot per station: never send two to the same spot
    const busy = this.bots
      .filter((o) => o !== b)
      .flatMap((o) => [this.standsAt(o), o.dest])
      .filter((id): id is string => !!id)
      .map((id) => this.graph.stationNode(id)!); // stations of other robots (parked or heading there)
    const wanted = g.stations.filter(
      (s) =>
        s.fleets.includes(b.fleetId) && s.id !== b.stationId && !spoken.has(s.id) && (kind ? s.type === kind : WORK(s)),
    );
    const crowded = (s: NavGraph['stations'][number]) =>
      busy.some((n) => {
        const q = this.graph.nodes.get(s.nodeId)!;
        return Math.hypot(n.x - q.x, n.y - q.y) < 4;
      });
    const order = (list: typeof wanted) =>
      list
        .map((st) => {
          const n = this.graph.nodes.get(st.nodeId)!;
          const d = Math.hypot(n.x - b.pos.x, n.y - b.pos.y);
          return { st, cost: kind ? d / 12 + this.rand() * 3 : (d >= FAR ? 0 : 1000 - d) + this.rand() * 10 };
        })
        .sort((p, q) => p.cost - q.cost)
        .map((c) => c.st); // a charger: the nearest; work: far away, else the farthest there is
    const cands = [...order(wanted.filter((s) => !crowded(s))), ...order(wanted.filter(crowded))]; // stations away from other robots first; a crowded one is better than leaving the robot idle in someone's way
    for (const st of cands) {
      const lanes =
        this.graph.route(b.node, st.nodeId, b.fleetId, stationNodes) ??
        this.graph.route(b.node, st.nodeId, b.fleetId, avoid) ??
        this.graph.route(b.node, st.nodeId, b.fleetId);
      if (!lanes || !lanes.length) continue;
      const stops = kind ? [] : this.pickStops(b, st.id, this.graph.plan(lanes, b.pos), spoken, crowded);
      const work = !kind;
      const due = work
        ? this.time + SLA_BASE + (SLA_FACTOR * this.graph.plan(lanes, b.pos).total) / V + SLA_PER_STOP * stops.length
        : null;
      b.trip = {
        assignedAtS: this.time,
        startedAtS: null,
        deadlineS: due,
        id: this.newTripId(),
        kind: kind ?? (loaded ? 'transport' : 'return'),
        origin: b.stationId ?? undefined,
        legs: [...stops, st.id],
        leg: 0,
        loaded,
        payload: loaded
          ? {
              kind: ['PCBA tray', 'Reel box', 'Material'][Math.floor(this.rand() * 3)],
              qty: 1 + Math.floor(this.rand() * 9),
            }
          : null,
      };
      if (this.startLeg(b)) {
        if (!kind) b.nextLoaded = !b.nextLoaded;
        if (kind === 'charge') b.chargeRequested = false;
        return true;
      } // loaded trip out, empty trip back
      this.undoTripId();
    }
    b.trip = null;
    if (b.chargeRequested && kind === 'charge') b.chargeRequested = false; // no charger could be reached: the request ends, work goes on
    return false;
  }
  /** "Send to charger": a trip that has started is never re-planned, so a robot on a work trip is refused; one on an empty return or parking trip goes when it ends; an idle one goes now. */
  sendToCharger(id: string): ChargeResult {
    const b = this.bots.find((x) => x.id === id);
    if (!b) return { ok: false, reason: 'not-found' };
    if (b.state === 'offline') return { ok: false, reason: 'offline' };
    if (b.state === 'error' || this.time < b.faultUntil) return { ok: false, reason: 'error' };
    if (b.state === 'charging' || b.trip?.kind === 'charge') return { ok: false, reason: 'already-charging' };
    if (b.trip?.kind === 'transport') return { ok: false, reason: 'work-trip', tripId: b.trip.id };
    if (!this.graph.nav.stations.some((q) => q.type === 'charge' && q.fleets.includes(b.fleetId)))
      return { ok: false, reason: 'no-charger' };
    b.chargeRequested = true;
    if (!b.trip && (b.state === 'idle' || b.state === 'working')) {
      b.timer = 0; // parked: plan the charge trip on the next step
      return { ok: true, when: 'now' };
    }
    return { ok: true, when: 'after-trip' };
  }
  // ---- requested trips (orders): people ask for a material to be moved; a free robot of the fleet takes the oldest order
  /** Orders waiting for a robot (oldest first). */
  orders: TransportOrder[] = [];
  private orderUpdates: OrderUpdate[] = [];
  drainOrderUpdates(): OrderUpdate[] {
    const u = this.orderUpdates;
    this.orderUpdates = [];
    return u;
  }
  /** Accept an order: false (and a `failed` update) when the fleet has no robot here or a station is not on the map. */
  submitOrder(o: TransportOrder): boolean {
    const known = o.legs.length > 0 && o.legs.every((id) => this.graph.station(id)?.fleets.includes(o.fleetId));
    const robots = this.bots.filter((b) => b.fleetId === o.fleetId && (!o.robotModel || b.model === o.robotModel));
    if (!known || !robots.length) {
      this.orderUpdates.push({
        id: o.id,
        status: 'failed',
        reason: !known
          ? "A station of the request is not on the fleet's map"
          : o.robotModel
            ? 'No robot of this type is on the floor'
            : 'No robot of this fleet is on the floor',
      });
      return false;
    }
    if (!this.orders.some((q) => q.id === o.id)) this.orders.push(o);
    return true;
  }
  /** Take the order back while no robot is on its way with it. */
  cancelOrder(id: string): boolean {
    const n = this.orders.length;
    this.orders = this.orders.filter((o) => o.id !== id);
    return this.orders.length < n;
  }
  /** A parked robot with enough battery takes the oldest order of its fleet: it drives to the first station empty and carries the load from the leg the order says. */
  private takeOrder(b: Bot): boolean {
    if (b.battery < 25 || !this.orders.length) return false;
    const order = this.orders.find((o) => o.fleetId === b.fleetId && (!o.robotModel || o.robotModel === b.model));
    if (!order) return false;
    let legs = [...order.legs],
      loadFrom = order.loadFrom;
    if (legs[0] === b.stationId && legs.length > 1) {
      legs = legs.slice(1);
      loadFrom = Math.max(0, loadFrom - 1);
    } // already standing at the first station
    b.trip = {
      assignedAtS: this.time,
      startedAtS: null,
      deadlineS: this.time + 600,
      id: order.tripId ?? this.newTripId(),
      kind: 'transport',
      origin: b.stationId ?? undefined,
      legs,
      leg: 0,
      loaded: true,
      loadFrom,
      payload: order.payload,
      orderId: order.id,
    };
    if (!this.startLeg(b)) {
      b.trip = null;
      if (!order.tripId) this.undoTripId();
      return false;
    } // cannot reach it from here: the order stays for another robot
    this.orders = this.orders.filter((o) => o !== order);
    return true;
  }
  /** Every traffic zone and intersection a route passes through, grouped: permits closer than GROUP_GAP are requested together. */
  private entriesOf(plan: PathPlan): Entry[] {
    const spans: { zone: boolean; id: string; s: number; exitS: number }[] = [];
    const total = plan.total;
    for (const z of this.graph.nav.trafficZones) {
      // intervals [enter, exit] of the path inside each zone; passes <6 m apart are one pass
      let inside = pointInPoly(plan.pts[0].x, plan.pts[0].y, z.polygon);
      let start = 0;
      const mine: typeof spans = [];
      for (let s = 0.2; s <= total + 0.2; s += 0.2) {
        const p = pointAt(plan, Math.min(s, total));
        const now = pointInPoly(p.x, p.y, z.polygon);
        if (now && !inside) start = s;
        if (!now && inside) mine.push({ zone: true, id: z.id, s: start, exitS: s });
        inside = now;
      }
      if (inside) mine.push({ zone: true, id: z.id, s: start, exitS: total });
      for (const q of mine) {
        const prev = spans.filter((x) => x.id === z.id).pop();
        if (prev && q.s - prev.exitS < 6) prev.exitS = q.exitS;
        else spans.push(q);
      }
    }
    for (let s = 0; s <= total + 0.1; s += 0.2) {
      // intersections: stretches of the path inside an intersection area
      const p = pointAt(plan, Math.min(s, total));
      for (const id of this.graph.intersections.near(p.x, p.y)) {
        const prev = spans.filter((x) => !x.zone && x.id === id).pop();
        if (prev && s - prev.exitS < 3) prev.exitS = s;
        else spans.push({ zone: false, id, s, exitS: s });
      }
    }
    spans.sort((a, b) => a.s - b.s);
    const out: Entry[] = [];
    for (const sp of spans) {
      const last = out[out.length - 1];
      if (last && sp.s - last.exitS < GROUP_GAP) {
        const list = sp.zone ? last.zones : last.xings;
        const have = list.find((x) => x.id === sp.id);
        if (have) have.exitS = Math.max(have.exitS, sp.exitS);
        else list.push({ id: sp.id, exitS: sp.exitS });
        last.exitS = Math.max(last.exitS, sp.exitS);
      } else
        out.push({
          s: sp.s,
          exitS: sp.exitS,
          hold: 0,
          zones: sp.zone ? [{ id: sp.id, exitS: sp.exitS }] : [],
          xings: sp.zone ? [] : [{ id: sp.id, exitS: sp.exitS }],
        });
    }
    for (const e of out)
      for (const x of e.xings) {
        const mine = spans.filter((q) => !q.zone && q.id === x.id && q.s >= e.s - 1e-6 && q.exitS <= e.exitS + 1e-6);
        const set = new Set<string>();
        for (const q of mine)
          for (let i = 0; i < plan.pts.length; i++)
            if (plan.cum[i] >= q.s - 0.3 && plan.cum[i] <= q.exitS + 0.3 && plan.laneAt[i]) set.add(plan.laneAt[i]!);
        x.lanes = [...set];
      }
    // Where to wait: at the usual distance before the first permit, but never inside the area of some other intersection (a waiting robot there would be in the way of the robots that hold it).
    out.forEach((e, i) => {
      const floor = i ? out[i - 1].exitS + 0.5 : 0;
      const q = Math.max(0, e.s - HOLD);
      const free = (x: number) => {
        const a = pointAt(plan, Math.max(0, x)),
          r = pointAt(plan, Math.max(0, x - 1));
        return !this.graph.intersections.near(a.x, a.y).length && !this.graph.intersections.near(r.x, r.y).length;
      };
      let h = q;
      while (h > floor && !free(h)) h -= 0.3;
      e.hold = free(h) || h > floor ? Math.max(0, h) : q;
    });
    return out;
  }
  private xing(id: string) {
    return this.xings.get(id) ?? this.xings.set(id, { occ: new Set(), waiters: new Set() }).get(id)!;
  }
  private byId(id: string) {
    return this.bots.find((o) => o.id === id)!;
  }
  private dropLock(b: Bot, id: string) {
    const p = this.xing(id);
    p.occ.delete(b.id);
    p.lanes?.delete(b.id);
    b.locks.delete(id);
  }
  /** Plan another way to the same destination from the end of the lane the robot is on, steering clear of everything standing still. The robot keeps the trail behind it (so its trolley does not jump). */
  private reroute(b: Bot): boolean {
    const old = b.plan!;
    if (b.holds.size) return false;
    const lane = this.graph.lanes.get(pointAt(old, b.s).lane ?? '');
    const st = this.graph.station(b.dest ?? '');
    if (!lane || !st) return false;
    const still = this.bots.filter((o) => o !== b && o.state !== 'offline' && o.v < 0.3);
    const avoid = new Set<string>();
    for (const n of this.graph.nodes.values())
      if (n.id !== lane.to && still.some((o) => Math.hypot(o.pos.x - n.x, o.pos.y - n.y) < 2.6)) avoid.add(n.id);
    const rest = lane.to === st.nodeId ? [] : this.graph.route(lane.to, st.nodeId, b.fleetId, avoid);
    if (!rest) return false;
    const lanes = [lane, ...rest];
    const ahead = [...new Set(old.laneAt.filter((_, i) => old.cum[i] > b.s))];
    if (lanes.map((l) => l.id).join() === ahead.join()) return false; // no other way
    const tail = this.graph.plan(lanes, b.pos, true);
    const trailLen = Math.min(b.s, TD + 0.4);
    const trail: Vec2[] = [],
      trailLane: (string | null)[] = [];
    for (let q = b.s - trailLen; q < b.s - 0.05; q += 0.2) {
      const p = pointAt(old, Math.max(0, q));
      trail.push({ x: p.x, y: p.y });
      trailLane.push(p.lane);
    }
    const pts = [...trail, ...tail.pts],
      laneAt = [...trailLane, ...tail.laneAt];
    const cum = [0];
    for (let i = 1; i < pts.length; i++)
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    for (const id of [...b.locks.keys()]) this.dropLock(b, id); // the new road is asked for again from scratch
    b.plan = { pts, laneAt, cum, total: cum[cum.length - 1] };
    b.s = cum[trail.length] ?? 0;
    b.entries = this.entriesOf(b.plan).filter((e) => e.exitS > b.s + 0.5);
    b.entryIdx = 0;
    b.queued = null;
    b.gateAt = -9;
    b.gateOk = true;
    b.stoppedSince = -1;
    b.waitReason = null;
    return true;
  }
  private release(b: Bot, zoneId: string) {
    this.zones.get(zoneId)?.occ.delete(b.id);
    b.holds.delete(zoneId);
  }
  /** Nobody is standing (parked, waiting, broken down) where the robot and its trolley will sweep while it passes through the entry, and the road beyond it has room for the whole robot. */
  private entryClear(b: Bot, e: Entry): Bot | null {
    const plan = b.plan!;
    const still = this.bots.filter((o) => o !== b && o.state !== 'offline' && o.v < 0.3);
    if (!still.length) return null;
    for (let q = Math.max(b.s + SAMPLE, e.s - 0.5); q <= e.exitS + EXIT_SPACE; q += SAMPLE) {
      // ahead of where the robot stands, never backwards or on the spot: the circle chains are longer than the real body, so a robot right behind it overlaps its footprint now but is left behind as it moves
      const qq = Math.min(q, plan.total);
      const c = [
        ...robotCircles(this.poseAt(plan, qq)),
        ...(b.loaded && qq - TD >= b.s - 0.2 ? trolleyCircles(this.poseAt(plan, qq - TD)) : []),
      ]; // (the stretch behind the robot, where its trolley hangs now, is not swept: a robot waiting right behind it would block it while it waits for the leader)
      const o = still.find((r) => hit(c, this.body(r)));
      if (o) return o;
      if (qq >= plan.total) break;
    }
    return null;
  }
  /** Does `from` wait for `id`, directly or through a chain of other waiting robots? */
  private waitsFor(from: Bot, id: string, depth = 6): boolean {
    return from.waitsOn.some((w) => w === id || (depth > 0 && this.waitsFor(this.byId(w), id, depth - 1)));
  }
  /** Ask for every permit of the entry, first come first served (Ati's VISA rule): a robot holds outside, the first to arrive goes first, the others wait until it has cleared. All or nothing.
   *  Two robots may be in an intersection together when their lanes never come close (or they are on the same lane, one behind the other). */
  private takeEntry(b: Bot, e: Entry): { ok: boolean; zone: string | null } {
    const nav = this.graph.nav;
    const holding = b.locks.size > 0 || b.holds.size > 0; // a robot that already holds permits is never held back by the queue: it must be able to finish and give them back
    if (b.ticketFor !== e) {
      b.ticketFor = e;
      b.ticket = this.time;
    }
    const waits = new Set<string>();
    const clash = (_id: string, mine: string[] | undefined, other: string[] | undefined) =>
      !(mine?.length && other?.length && mine.every((a) => other.includes(a))); // only robots on the very same lanes may share an intersection (they just follow each other)
    const cap = (id: string) => nav.trafficZones.find((z) => z.id === id)!.capacity;
    const zoneFull = (id: string) => this.zones.get(id)!.occ.size >= cap(id);
    const takenBy = (id: string, lanes?: string[]) => {
      const x = this.xing(id);
      return [...x.occ].filter(
        (o) => o !== b.id && clash(id, lanes, x.lanes?.get(o) ? [...x.lanes.get(o)!] : undefined),
      );
    };
    /** Robots ahead of this one in the queue for the permit (first come first served), except those that are themselves held up by this very robot: letting them go first would never end. */
    const earlier = (id: string, zone: boolean, lanes?: string[]) =>
      holding
        ? []
        : this.bots.filter(
            (o) =>
              o !== b &&
              o.queued &&
              !this.waitsFor(o, b.id) &&
              o.ticket < b.ticket &&
              (zone
                ? o.queued.zones.some((z) => z.id === id)
                : o.queued.xings.some((x) => x.id === id && clash(id, lanes, x.lanes))),
          );
    let blockedZone: string | null = null;
    for (const z of e.zones) {
      const occ = [...this.zones.get(z.id)!.occ].filter((o) => o !== b.id);
      const q = earlier(z.id, true);
      if ((zoneFull(z.id) && occ.length) || q.length) {
        blockedZone ??= z.id;
        occ.forEach((o) => waits.add(o));
        q.forEach((o) => waits.add(o.id));
      }
    }
    let logical = !blockedZone;
    for (const x of e.xings) {
      const held = takenBy(x.id, x.lanes),
        q = earlier(x.id, false, x.lanes);
      if (held.length || q.length) {
        logical = false;
        held.forEach((o) => waits.add(o));
        q.forEach((o) => waits.add(o.id));
      }
    }
    if (logical && this.time - b.gateAt > 0.5) {
      const o = this.entryClear(b, e);
      b.gateOk = !o;
      b.gateBlock = o?.id ?? null;
      b.gateAt = this.time;
    } // (the physical check runs twice a second at most)
    const ok = logical && b.gateOk;
    if (logical && !b.gateOk && b.gateBlock) waits.add(b.gateBlock);
    const held = waits.size > 0 && (blockedZone !== null || !logical);
    b.queued = !ok && held ? e : null;
    b.waitsOn = ok ? [] : [...waits];
    if (ok) {
      const clear = b.attached ? TD + 0.7 : 0.7;
      for (const z of e.zones) {
        this.zones.get(z.id)!.occ.add(b.id);
        b.holds.set(z.id, z.exitS + clear);
      }
      for (const x of e.xings) {
        const p = this.xing(x.id);
        p.occ.add(b.id);
        (p.lanes ??= new Map()).set(b.id, new Set(x.lanes));
        b.locks.set(x.id, x.exitS + clear);
      }
      b.gateAt = -9;
      b.ticketFor = null;
    }
    return { ok, zone: blockedZone };
  }
  /** Heading of the route at arc length q: central difference over 0.5 m, so it is smooth even on curves. */
  private headingAt(plan: PathPlan, q: number) {
    const a = pointAt(plan, Math.max(0, Math.min(plan.total, q - 0.25))),
      c = pointAt(plan, Math.max(0, Math.min(plan.total, q + 0.25)));
    return Math.hypot(c.x - a.x, c.y - a.y) > 1e-6
      ? Math.atan2(c.y - a.y, c.x - a.x)
      : pointAt(plan, Math.max(0, Math.min(plan.total, q))).heading;
  }
  /** Pose on the route at arc length q; before the start the route is extended backwards along its first heading (where a trolley hangs while the robot leaves). */
  private poseAt(plan: PathPlan, q: number): Pose {
    const h = this.headingAt(plan, Math.max(0, q));
    if (q >= 0) {
      const p = pointAt(plan, Math.min(q, plan.total));
      return { x: p.x, y: p.y, th: h };
    }
    const p0 = pointAt(plan, 0);
    return { x: p0.x + Math.cos(h) * q, y: p0.y + Math.sin(h) * q, th: h };
  }
  private trailerPose(b: Bot): Pose | null {
    return b.attached && b.plan ? this.poseAt(b.plan, b.s - TD) : b.attached && b.trailer ? b.trailer : null;
  }
  private body(o: Bot): Circle[] {
    const c = robotCircles({ x: o.pos.x, y: o.pos.y, th: o.theta });
    return o.trailer ? [...c, ...trolleyCircles(o.trailer)] : c;
  }
  /** The footprint (robot + trolley) at each checked position over the next `L` meters of the route. */
  private corridor(b: Bot, L: number): { d: number; c: Circle[] }[] {
    const plan = b.plan!;
    const out: { d: number; c: Circle[] }[] = [];
    for (let d = SAMPLE; d <= L + 1e-6; d += SAMPLE) {
      const q = Math.min(b.s + d, plan.total);
      out.push({
        d,
        c: [...robotCircles(this.poseAt(plan, q)), ...(b.attached ? trolleyCircles(this.poseAt(plan, q - TD)) : [])],
      });
      if (q >= plan.total) break;
    }
    return out;
  }
  /** How far along its route the robot may drive: up to where its footprint would touch another robot or the way a higher-priority robot has reserved. */
  private freeLength(b: Bot, claims: Map<string, Circle[]>): { len: number; claim: Circle[]; by: Bot | null } {
    const mine = this.corridor(b, CLAIM);
    const claim: Circle[] = [];
    let len = 0;
    for (const m of mine) {
      const by = this.touches(b, m.c, claims);
      if (by) return { len, claim, by };
      len = m.d;
      claim.push(...m.c);
    }
    return { len: Infinity, claim, by: null };
  }
  private touches(b: Bot, mine: Circle[], claims: Map<string, Circle[]>): Bot | null {
    const at = mine[0];
    if (!at) return null;
    for (const o of this.bots) {
      if (o === b || o.state === 'offline' || Math.hypot(o.pos.x - at.x, o.pos.y - at.y) > 12) continue;
      if (hit(mine, this.body(o))) return o;
      const c = claims.get(o.id);
      if (c && hit(mine, c)) return o;
    }
    return null;
  }
  /** Robots that wait for each other in a ring (A for B, B for C, C for A) will never move by themselves. Find such rings and break them without any robot backing up:
   *  a robot still at its station gives its trip up; otherwise a robot hands the intersections it holds over; otherwise one takes another road ahead. */
  private breakDeadlocks() {
    const waiting = new Map(
      this.bots.filter((b) => b.waitSince >= 0 && this.time - b.waitSince > CYCLE_AFTER).map((b) => [b.id, b]),
    );
    if (waiting.size < 2) return;
    const index = new Map<string, number>(),
      low = new Map<string, number>(),
      onStack = new Set<string>(),
      stack: string[] = [];
    const rings: Bot[][] = [];
    let n = 0;
    const visit = (id: string) => {
      index.set(id, n);
      low.set(id, n);
      n++;
      stack.push(id);
      onStack.add(id);
      for (const w of waiting.get(id)!.waitsOn) {
        if (!waiting.has(w)) continue;
        if (!index.has(w)) {
          visit(w);
          low.set(id, Math.min(low.get(id)!, low.get(w)!));
        } else if (onStack.has(w)) low.set(id, Math.min(low.get(id)!, index.get(w)!));
      }
      if (low.get(id) === index.get(id)) {
        const ring: Bot[] = [];
        for (;;) {
          const w = stack.pop()!;
          onStack.delete(w);
          ring.push(waiting.get(w)!);
          if (w === id) break;
        }
        if (ring.length > 1) rings.push(ring);
      }
    };
    for (const id of waiting.keys()) if (!index.has(id)) visit(id);
    for (const ring of rings) {
      if (ring.some((b) => this.time - b.resolvedAt < 6)) continue;
      this.deadlocksFound++;
      const key = ring
          .map((b) => b.id)
          .sort()
          .join(),
        seen = this.ringSeen.get(key);
      this.ringSeen.set(key, this.time); // a ring that stays stuck is one deadlock, not one per second
      if (seen === undefined || this.time - seen > 60)
        this.events.push({
          type: 'deadlock',
          ts: this.at(this.time),
          robotIds: ring.map((b) => b.id),
          fleetIds: [...new Set(ring.map((b) => b.fleetId))],
          waitedS: Math.round(Math.max(...ring.map((b) => this.time - b.waitSince))),
        });
      const youngest = (list: Bot[]) => list.sort((a, c) => c.ticket - a.ticket || c.prio - a.prio)[0];
      // 1. a robot hands over the intersections it holds
      const holders = ring.filter((b) => b.locks.size > 0);
      if (holders.length) {
        const v = youngest(holders);
        v.resolvedAt = this.time;
        for (const id of [...v.locks.keys()]) this.dropLock(v, id);
        continue;
      }
      // 2. a robot takes another road to the same destination, going forward from where it is (a trip is never given up or handed to anyone else)
      let done = false;
      for (const v of ring.filter((b) => b.plan && !b.holds.size).sort((a, c) => c.ticket - a.ticket))
        if (this.reroute(v)) {
          v.resolvedAt = this.time;
          done = true;
          break;
        }
      if (done) continue;
      ring.forEach((b) => (b.resolvedAt = this.time));
    }
  }
  deadlocksFound = 0;
  private ringSeen = new Map<string, number>();
  step(dt: number) {
    this.time += dt;
    const claims = new Map<string, Circle[]>();
    // Strict priority = oldest trip first. Each robot reserves its way top-down, so a lower-priority robot can never block a higher one for long and no cycle of waits can form.
    const order = [...this.bots].sort((p, q) => p.prio - q.prio || (p.id < q.id ? -1 : 1));
    for (const b of order) this.stepBot(b, dt, claims);
    if (Math.floor(this.time) !== Math.floor(this.time - dt)) this.breakDeadlocks();
  }
  private stepBot(b: Bot, dt: number, claims: Map<string, Circle[]>) {
    b.speed = 0;
    if (b.state === 'blocked') {
      b.v = 0;
      if (this.time >= b.blockedUntil) b.state = 'moving';
      return;
    }
    if (b.state === 'error') {
      // a fault that needs someone to come: the robot stands where it is (its footprint stays in the way) until it is cleared
      b.v = 0;
      claims.set(b.id, [
        ...robotCircles({ ...b.pos, th: b.theta }),
        ...(b.attached && b.trailer ? trolleyCircles(b.trailer) : []),
      ]);
      if (this.time >= b.faultUntil) {
        b.state = 'moving';
        this.events.push({ type: 'fault-cleared', ts: this.at(this.time), robotId: b.id, fleetId: b.fleetId });
      }
      return;
    }
    if (b.state === 'idle' || b.state === 'working' || b.state === 'charging') {
      b.v = 0;
      b.timer -= dt;
      if (b.state === 'charging') b.battery = Math.min(100, b.battery + dt * 6);
      if (b.timer <= 0 && !(b.state === 'charging' && b.battery < 90)) {
        if (!this.planRoute(b)) b.timer = 1.5;
      }
      return;
    }
    const plan = b.plan!;
    if (b.s < 0.02) {
      // leaving a station: turn on the spot towards the route, hitching the trolley behind when there is room for it
      const h = this.headingAt(plan, 0),
        d = angleDiff(b.theta, h);
      const turn = Math.abs(d) > 0.04;
      const th = turn ? b.theta + Math.max(-2 * dt, Math.min(2 * dt, d)) : b.theta;
      {
        const o = this.touches(b, robotCircles({ ...b.pos, th }, turn ? TURN_R : ROBOT_R), claims);
        if (o) {
          b.state = 'waiting';
          b.waitReason = 'headway';
          b.v = 0;
          b.waitsOn = [o.id];
          if (b.waitSince < 0) b.waitSince = this.time;
          return;
        }
      }
      if (turn) {
        b.theta = th;
        b.state = 'moving';
        b.v = 0;
        return;
      }
      if (b.loaded && !b.attached && !this.touches(b, trolleyCircles(this.poseAt(plan, b.s - TD)), claims)) {
        b.attached = true;
        b.trailer = this.poseAt(plan, b.s - TD);
      }
    }
    if (b.loaded && !b.attached && b.s >= TD) {
      b.attached = true;
      b.trailer = this.poseAt(plan, b.s - TD);
    } // no room behind at the station: the trolley is hitched as soon as the robot has pulled clear
    let limit = plan.total;
    let gate = false;
    let zoneWait: string | null = null;
    const e = b.entries[b.entryIdx];
    b.queued = null; // (set again below when the robot is queueing at a hold point)
    if (e) {
      const hold = e.hold;
      if (b.s >= hold - 1e-3) {
        const r = this.takeEntry(b, e);
        if (r.ok) b.entryIdx++;
        else {
          gate = true;
          zoneWait = r.zone;
          limit = Math.min(limit, hold);
        }
      } else limit = Math.min(limit, hold);
    }
    // Held up for a long time by something standing in the way (not by a traffic rule): take another road ahead, never back.
    if (b.s >= 0.5 && b.v < 0.05 && !zoneWait && (gate || b.waitReason === 'headway')) {
      if (b.stoppedSince < 0) b.stoppedSince = this.time;
      if (this.time - b.stoppedSince > REROUTE_AFTER && this.time - b.rerouteAt > 20) {
        b.rerouteAt = this.time;
        if (this.reroute(b)) return;
      }
    } else if (b.v > 0.1) b.stoppedSince = -1;
    const free = gate ? { len: 0, claim: [] as Circle[], by: null as Bot | null } : this.freeLength(b, claims);
    if (!gate) b.waitsOn = free.by && free.len < CLAIM - 1e-6 ? [free.by.id] : [];
    const blocked = free.len < CLAIM - 1e-6;
    b.waitingZone = zoneWait;
    b.waitReason = zoneWait ? 'traffic' : gate ? 'intersection' : blocked ? 'headway' : null;
    // The robot in the way is itself waiting for permits this robot holds (it stands at its station right on this road): hand them over so it can leave.
    if (blocked && b.locks.size && b.v < 0.05) {
      const by = this.touches(b, this.corridor(b, SAMPLE)[0]?.c ?? [], claims);
      const e2 = by && by.plan && by.s < 0.5 ? by.entries[by.entryIdx] : null;
      if (e2 && this.time - b.stoppedSince > 3 && b.stoppedSince >= 0)
        for (const x of e2.xings) if (b.locks.has(x.id)) this.dropLock(b, x.id);
    }
    const curve = Math.min(
      1,
      Math.abs(angleDiff(this.headingAt(plan, b.s), this.headingAt(plan, Math.min(plan.total, b.s + 1)))),
    ); // slow down in bends
    if (blocked) limit = Math.min(limit, b.s + free.len);
    const room = Math.max(0, limit - b.s);
    const lag = Math.abs(angleDiff(b.theta, this.headingAt(plan, Math.min(plan.total, b.s + 0.3))));
    let vt = V * (1 - 0.5 * curve) * Math.max(0.15, 1 - lag / 0.7);
    vt = Math.min(vt, Math.sqrt(2 * DEC * room));
    b.v = vt > b.v ? Math.min(vt, b.v + ACC * dt) : Math.max(vt, b.v - DEC * dt);
    const ds = Math.min(b.v * dt, room);
    b.s += ds;
    if (b.attached) b.odoLoaded += ds;
    else b.odoEmpty += ds;
    const p = this.poseAt(plan, b.s);
    b.pos = { x: p.x, y: p.y };
    {
      const d = angleDiff(b.theta, this.headingAt(plan, b.s));
      const dth = Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, d));
      if (b.v > 0.05 || !this.touches(b, robotCircles({ ...b.pos, th: b.theta + dth }, TURN_R), claims)) b.theta += dth;
    } // a robot standing still only swings its corners out when nobody is there b.lane = pointAt(plan, b.s).lane;
    b.trailer = this.trailerPose(b);
    b.speed = ds / dt;
    const held = gate || blocked;
    b.state = held && ds / dt < 0.3 ? 'waiting' : 'moving';
    if (b.state === 'waiting' && b.v < 0.03) b.v = 0;
    if (b.state === 'waiting') {
      if (b.waitSince < 0) b.waitSince = this.time;
    } else b.waitSince = -1;
    for (const [zid, exitS] of [...b.holds]) if (b.s > exitS) this.release(b, zid); // left the zone (trolley included): let the next robot in
    for (const [id, exitS] of [...b.locks]) if (b.s > exitS) this.dropLock(b, id); // left the intersection: the next robot may enter
    b.battery = Math.max(0, b.battery - dt * 0.05);
    b.energyKWh += (dt * 0.05 * b.kWh) / 100;
    if (b.task) this.syncTask(b, Math.min(1, b.s / Math.max(plan.total, 1)));
    if (b.s >= plan.total - 1e-3) {
      b.queued = null;
      for (const zid of [...b.holds.keys()]) this.release(b, zid);
      const st = this.graph.station(b.dest!)!;
      b.node = st.nodeId;
      b.stationId = st.id;
      b.dest = null;
      b.plan = null;
      b.speed = 0;
      b.v = 0;
      b.waitingZone = null;
      b.waitReason = null;
      for (const id of [...b.locks.keys()]) this.dropLock(b, id); // a parked robot holds no permit: others wait because its body is in the way, and it asks again when it leaves
      b.attached = false;
      b.trailer = null;
      b.loaded = false;
      b.payload = null; // delivered: the trolley is unhitched and the load handed over
      const t = b.trip;
      if (t) t.leg++;
      const done = !t || t.leg >= t.legs.length;
      if (t && done)
        this.events.push({
          type: 'trip-completed',
          ts: this.at(this.time),
          robotId: b.id,
          fleetId: b.fleetId,
          tripId: t.id,
          kind: t.kind,
          assignedAt: this.at(t.assignedAtS),
          startedAt: this.at(t.startedAtS ?? t.assignedAtS),
          deadlineAt: t.deadlineS === null ? null : this.at(t.deadlineS),
        });
      if (t && done && t.orderId)
        this.orderUpdates.push({ id: t.orderId, status: 'completed', tripId: t.id, robotId: b.id });
      if (done) b.trip = null; // a stop on the way: a short call, then the next leg
      const charge = b.task?.type === 'charge',
        parking = b.task?.type === 'park';
      b.state = charge ? 'charging' : parking ? 'idle' : 'working';
      b.timer = charge ? 3 : parking ? 8 + this.rand() * 12 : done ? 3 + this.rand() * 4 : 1.5 + this.rand() * 2;
      if (b.task) {
        if (done) b.task.progress = 1;
        else this.syncTask(b);
      }
      return;
    }
    claims.set(b.id, free.claim);
    if (this.opts.faults && this.faultRand() < dt * FAULT_RATE) {
      b.state = 'error';
      b.faultUntil = this.time + 45 + this.faultRand() * 60;
      b.speed = 0;
      b.v = 0;
      this.events.push({
        type: 'fault',
        ts: this.at(this.time),
        robotId: b.id,
        fleetId: b.fleetId,
        code: 'DRIVE_FAULT',
        needsIntervention: true,
      });
      return;
    }
    if (this.rand() < dt * 0.0012) {
      b.state = 'blocked';
      b.blockedUntil = this.time + 5 + this.rand() * 4;
      b.speed = 0;
      b.v = 0;
      claims.delete(b.id);
    }
  }
  snapshot(): RobotTelemetry[] {
    const ts = Date.now();
    return this.bots.map((b) => {
      const moving =
        (b.state === 'moving' || b.state === 'waiting' || b.state === 'blocked' || b.state === 'error') && b.plan;
      const traffic = b.waitingZone
        ? { zoneId: b.waitingZone, status: 'waiting' as const }
        : b.holds.size
          ? { zoneId: [...b.holds.keys()][0], status: 'inside' as const }
          : null;
      const alerts: NonNullable<RobotTelemetry['alerts']> = [];
      const who = b.waitsOn.length ? ` (${b.waitsOn.slice(0, 2).join(', ')} first)` : '';
      if (b.state === 'error')
        alerts.push({ code: 'FAULT', severity: 'critical', msg: 'Fault: needs someone on site' });
      if (b.state === 'blocked') alerts.push({ code: 'OBSTACLE', severity: 'critical', msg: 'Path obstructed' });
      if (b.battery < 25) alerts.push({ code: 'LOW_BATT', severity: 'warn', msg: 'Low battery' });
      if (b.waitingZone) alerts.push({ code: 'TRAFFIC_WAIT', severity: 'info', msg: `Waiting for ${b.waitingZone}` });
      else if (b.state === 'waiting' && b.waitReason === 'intersection')
        alerts.push({
          code: 'INTERSECTION_WAIT',
          severity: 'info',
          msg: `Waiting for the intersection to clear${who}`,
        });
      else if (b.state === 'waiting' && b.waitReason === 'headway')
        alerts.push({
          code: 'HEADWAY_WAIT',
          severity: 'info',
          msg: b.waitsOn.length ? `Queued behind ${b.waitsOn[0]}` : 'Queued behind another robot',
        });
      if (b.state === 'waiting' && b.waitSince >= 0 && this.time - b.waitSince > STUCK_ALERT)
        alerts.push({
          code: 'STUCK',
          severity: 'warn',
          msg: `Waiting for ${Math.round((this.time - b.waitSince) / 60)} min, needs a look`,
        });
      return {
        id: b.id,
        model: b.model,
        fleetId: b.fleetId,
        siteId: this.siteId,
        pose: { x: b.pos.x, y: b.pos.y, theta: b.theta },
        speed: b.speed,
        state: b.state,
        battery: Math.round(b.battery),
        payload: b.attached ? b.payload : null,
        trailer: b.trailer ? { x: b.trailer.x, y: b.trailer.y, theta: b.trailer.th } : null,
        task: b.task,
        path: moving ? [b.pos, ...b.plan!.pts.filter((_, i) => b.plan!.cum[i] > b.s)] : [],
        laneId: b.lane,
        traffic,
        waitReason: b.waitReason,
        waitsOn: b.state === 'waiting' ? [...b.waitsOn] : [],
        odometer: { empty: Math.round(b.odoEmpty * 10) / 10, loaded: Math.round(b.odoLoaded * 10) / 10 },
        energyKWh: Math.round(b.energyKWh * 1000) / 1000,
        atStation:
          b.stationId && (b.state === 'working' || b.state === 'charging' || b.state === 'idle') ? b.stationId : null,
        alerts,
        ts,
      };
    });
  }
}
