import { LaneGraph } from '../../core/lanes';
import type { FleetEvent, NavGraph, OrderUpdate, TransportOrder } from '../../core/types';
import { LEAVE_CLEAR, WORK, rng } from './constants';
import type { Bot, Permit, RosterEntry, SimOptions } from './types';

/**
 * The state every part of the simulation shares: the lane map, the robots, the clock, the permits of the traffic zones, and what has happened since it was last read.
 * It has no rules of its own: `Permits`, `Traffic`, `Dispatch`, `Mover`, `Deadlocks` and `Commands` act on it.
 */
export class World {
  readonly graph: LaneGraph;
  bots: Bot[] = [];
  time = 0;
  rand: () => number;
  faultRand: () => number;
  tripSeq = 0;
  zones = new Map<string, Permit>();
  xings = new Map<string, Permit>();
  /** Moments since the last `drainEvents()`. */
  events: FleetEvent[] = [];
  /** Orders waiting for a robot (oldest first), and what happened to them since the last `drainOrderUpdates()`. */
  orders: TransportOrder[] = [];
  orderUpdates: OrderUpdate[] = [];
  deadlocksFound = 0;
  ringSeen = new Map<string, number>();
  private t0 = Date.now();
  constructor(
    nav: NavGraph,
    readonly siteId: string,
    count = 14,
    seed = 7,
    roster?: RosterEntry[],
    readonly opts: SimOptions = {},
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
        lostBy: null,
        estop: false,
        chargeRequested: false,
        ignoreClaims: 0,
        handedOver: 0,
        trip: null,
        task: null,
        payload: null,
        dest: null,
        lane: null,
      };
      this.bots.push(bot);
    }
  }
  at(s: number) {
    return Math.round(this.t0 + s * 1000);
  }
  /** Hand over (and forget) the events that happened since the last call. */
  drainEvents(): FleetEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
  newTripId(): string {
    return this.opts.tripIds?.next() ?? `TRP-${String(++this.tripSeq).padStart(3, '0')}`;
  }
  undoTripId() {
    if (this.opts.tripIds) this.opts.tripIds.undo();
    else this.tripSeq--;
  }
  incoming(id: string) {
    return this.bots.filter((b) => b.dest === id).length;
  }
  parked(b: Bot) {
    return b.state === 'idle' || b.state === 'working' || b.state === 'charging';
  }
  /** Nodes where a robot stands still: other robots are never routed through them. */
  /** The station a robot is physically at: the one it is parked at, or, until it has driven clear of it, the one its trip started from (it still stands there while it waits to leave). */
  standsAt(o: Bot): string | null {
    return o.stationId ?? (o.plan && o.s < LEAVE_CLEAR ? (o.task?.from ?? null) : null);
  }
  occupiedNodes(except: Bot) {
    return new Set(
      this.bots
        .filter((o) => o !== except && ((o.stationId && this.parked(o)) || (o.plan && o.s < 0.5)))
        .map((o) => o.node),
    );
  }
  byId(id: string) {
    return this.bots.find((o) => o.id === id)!;
  }
  xing(id: string) {
    return this.xings.get(id) ?? this.xings.set(id, { occ: new Set(), waiters: new Set() }).get(id)!;
  }
  dropLock(b: Bot, id: string) {
    const p = this.xing(id);
    p.occ.delete(b.id);
    p.lanes?.delete(b.id);
    b.locks.delete(id);
  }
  release(b: Bot, zoneId: string) {
    this.zones.get(zoneId)?.occ.delete(b.id);
    b.holds.delete(zoneId);
  }
}
