import { pointAt, type PathPlan } from '../../core/lanes';
import { pointInPoly, segDist } from '../../core/geom';
import type { Lane, NavGraph, Vec2 } from '../../core/types';
import { FAR, REJOIN_M, REJOIN_MAX, SLA_BASE, SLA_FACTOR, SLA_PER_STOP, TD, V, WORK } from './constants';
import type { Bot } from './types';
import type { World } from './world';
import type { Permits } from './permits';

/** Giving a robot work: choosing a trip, planning its route, the lead-in from off the road, rerouting, and taking a requested order. */
export class Dispatch {
  constructor(
    private readonly w: World,
    private readonly permits: Permits,
  ) {}
  /** Where a trip starts from. A robot on its lane network starts from its node; one that is off the road (moved by hand) first finds the nearest lane of its fleet and joins it there, then follows the route from that lane's end. null = no lane near enough to rejoin. */
  private leadIn(b: Bot): { from: string; first: Lane | null } | null {
    const at = this.w.graph.nodes.get(b.node);
    if (!at || Math.hypot(at.x - b.pos.x, at.y - b.pos.y) <= REJOIN_M) return { from: b.node, first: null };
    let best: Lane | null = null,
      bd = Infinity;
    for (const l of this.w.graph.nav.lanes) {
      if (!l.fleets.includes(b.fleetId)) continue;
      for (let i = 0; i + 1 < l.geom.length; i++) {
        const d = segDist(b.pos.x, b.pos.y, l.geom[i][0], l.geom[i][1], l.geom[i + 1][0], l.geom[i + 1][1]).d;
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
    }
    if (!best || bd > REJOIN_MAX) return null;
    return bd <= REJOIN_M ? { from: b.node, first: null } : { from: best.to, first: best };
  }
  /** The route to a node from where the lead-in says the robot starts: the lane it rejoins (when off the road), then the best route onward. */
  private routeFrom(
    b: Bot,
    lead: { from: string; first: Lane | null },
    to: string,
    avoids: (ReadonlySet<string> | undefined)[],
  ): Lane[] | null {
    if (lead.first && lead.first.to === to) return [lead.first];
    let lanes: Lane[] | null = null;
    for (const a of avoids) lanes ??= this.w.graph.route(lead.from, to, b.fleetId, a);
    return lanes && lead.first ? [lead.first, ...lanes] : lanes;
  }
  planRoute(b: Bot): boolean {
    return b.trip ? this.startLeg(b) : this.startTrip(b);
  }
  /** Task shown to the supervisor: the trip's id, its stops and destination, which leg is being driven. */
  syncTask(b: Bot, frac = 0) {
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
    const g = this.w.graph;
    const avoid = this.w.occupiedNodes(b);
    const stationNodes = new Set(g.nav.stations.map((q) => q.nodeId));
    const lead = this.leadIn(b);
    if (!lead) return false; // no lane near enough to rejoin: the robot waits and asks again
    while (t.leg < t.legs.length) {
      const id = t.legs[t.leg];
      const st = g.station(id)!;
      const spoken = this.w.bots.some((o) => o !== b && (this.w.standsAt(o) === id || o.dest === id));
      const lanes = spoken ? null : this.routeFrom(b, lead, st.nodeId, [stationNodes, avoid, undefined]); // when the only way out leads past a parked robot, the robot goes anyway and waits for it to leave (it will: it is only parked between jobs)      // keep to roads without other stations on them when there is one: a parked robot must not block through traffic
      if (lanes && lanes.length) {
        const from = b.stationId ?? undefined;
        const plan = g.plan(lanes, b.pos, !!lead.first);
        const carrying = t.loaded && t.leg >= (t.loadFrom ?? 0);
        Object.assign(b, {
          prio: this.w.time,
          plan,
          s: 0,
          entries: this.permits.entriesOf(plan),
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
          this.w.orderUpdates.push({ id: t.orderId, status: 'ongoing', tripId: t.id, robotId: b.id });
        t.startedAtS ??= this.w.time;
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
    const k = Math.min(plan.total > 60 ? 2 : plan.total > 30 ? 1 : 0, Math.floor(this.w.rand() * 3));
    if (!k) return [];
    const near: { id: string; at: number }[] = [];
    for (const s of this.w.graph.nav.stations) {
      if (
        !WORK(s) ||
        s.id === dest ||
        s.id === b.stationId ||
        spoken.has(s.id) ||
        !s.fleets.includes(b.fleetId) ||
        crowded(s)
      )
        continue;
      const n = this.w.graph.nodes.get(s.nodeId)!;
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
    for (const c of near.sort(() => this.w.rand() - 0.5))
      if (out.length < k && out.every((o) => Math.abs(o.at - c.at) > 12)) out.push(c);
    return out.sort((p, q) => p.at - q.at).map((o) => o.id);
  }
  /** A new trip: loaded out, empty back, or to a charger when the battery is low. Destinations are far from where the robot starts, with stops on the way. */
  private startTrip(b: Bot): boolean {
    if (!b.chargeRequested && this.takeOrder(b)) return true;
    const low = b.battery < 25 || b.chargeRequested;
    const g = this.w.graph.nav;
    const park =
      !low &&
      b.nextLoaded &&
      g.stations.some((q) => q.type === 'park' && q.fleets.includes(b.fleetId)) &&
      this.w.rand() < 0.15; // now and then a robot with no work goes to a parking spot and waits
    const kind: 'charge' | 'park' | null = low ? 'charge' : park ? 'park' : null;
    const loaded = !kind && b.nextLoaded;
    const avoid = this.w.occupiedNodes(b);
    const stationNodes = new Set(g.stations.map((q) => q.nodeId));
    const lead = this.leadIn(b);
    if (!lead) return false; // off the road with no lane near enough to rejoin: no trip is started
    const spoken = new Set(
      this.w.bots
        .filter((o) => o !== b)
        .flatMap((o) => [this.w.standsAt(o), o.dest, o.trip?.legs[o.trip.legs.length - 1]])
        .filter((id): id is string => !!id),
    ); // one robot per station: never send two to the same spot
    const busy = this.w.bots
      .filter((o) => o !== b)
      .flatMap((o) => [this.w.standsAt(o), o.dest])
      .filter((id): id is string => !!id)
      .map((id) => this.w.graph.stationNode(id)!); // stations of other robots (parked or heading there)
    const wanted = g.stations.filter(
      (s) =>
        s.fleets.includes(b.fleetId) && s.id !== b.stationId && !spoken.has(s.id) && (kind ? s.type === kind : WORK(s)),
    );
    const crowded = (s: NavGraph['stations'][number]) =>
      busy.some((n) => {
        const q = this.w.graph.nodes.get(s.nodeId)!;
        return Math.hypot(n.x - q.x, n.y - q.y) < 4;
      });
    const order = (list: typeof wanted) =>
      list
        .map((st) => {
          const n = this.w.graph.nodes.get(st.nodeId)!;
          const d = Math.hypot(n.x - b.pos.x, n.y - b.pos.y);
          return { st, cost: kind ? d / 12 + this.w.rand() * 3 : (d >= FAR ? 0 : 1000 - d) + this.w.rand() * 10 };
        })
        .sort((p, q) => p.cost - q.cost)
        .map((c) => c.st); // a charger: the nearest; work: far away, else the farthest there is
    const cands = [...order(wanted.filter((s) => !crowded(s))), ...order(wanted.filter(crowded))]; // stations away from other robots first; a crowded one is better than leaving the robot idle in someone's way
    for (const st of cands) {
      const lanes = this.routeFrom(b, lead, st.nodeId, [stationNodes, avoid, undefined]);
      if (!lanes || !lanes.length) continue;
      const stops = kind
        ? []
        : this.pickStops(b, st.id, this.w.graph.plan(lanes, b.pos, !!lead.first), spoken, crowded);
      const work = !kind;
      const due = work
        ? this.w.time +
          SLA_BASE +
          (SLA_FACTOR * this.w.graph.plan(lanes, b.pos, !!lead.first).total) / V +
          SLA_PER_STOP * stops.length
        : null;
      b.trip = {
        assignedAtS: this.w.time,
        startedAtS: null,
        deadlineS: due,
        id: this.w.newTripId(),
        kind: kind ?? (loaded ? 'transport' : 'return'),
        origin: b.stationId ?? undefined,
        legs: [...stops, st.id],
        leg: 0,
        loaded,
        payload: loaded
          ? {
              kind: ['PCBA tray', 'Reel box', 'Material'][Math.floor(this.w.rand() * 3)],
              qty: 1 + Math.floor(this.w.rand() * 9),
            }
          : null,
      };
      if (this.startLeg(b)) {
        if (!kind) b.nextLoaded = !b.nextLoaded;
        if (kind === 'charge') b.chargeRequested = false;
        return true;
      } // loaded trip out, empty trip back
      this.w.undoTripId();
    }
    b.trip = null;
    if (b.chargeRequested && kind === 'charge') b.chargeRequested = false; // no charger could be reached: the request ends, work goes on
    return false;
  }
  /** Plan another way to the same destination from the end of the lane the robot is on, steering clear of everything standing still. The robot keeps the trail behind it (so its trolley does not jump). */
  reroute(b: Bot): boolean {
    const old = b.plan!;
    if (b.holds.size) return false;
    const lane = this.w.graph.lanes.get(pointAt(old, b.s).lane ?? '');
    const st = this.w.graph.station(b.dest ?? '');
    if (!lane || !st) return false;
    const still = this.w.bots.filter((o) => o !== b && o.state !== 'offline' && o.v < 0.3);
    const avoid = new Set<string>();
    for (const n of this.w.graph.nodes.values())
      if (n.id !== lane.to && still.some((o) => Math.hypot(o.pos.x - n.x, o.pos.y - n.y) < 2.6)) avoid.add(n.id);
    const rest = lane.to === st.nodeId ? [] : this.w.graph.route(lane.to, st.nodeId, b.fleetId, avoid);
    if (!rest) return false;
    const lanes = [lane, ...rest];
    const ahead = [...new Set(old.laneAt.filter((_, i) => old.cum[i] > b.s))];
    if (lanes.map((l) => l.id).join() === ahead.join()) return false; // no other way
    const tail = this.w.graph.plan(lanes, b.pos, true);
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
    const clear = b.attached ? TD + 0.7 : 0.7;
    const inside = [...b.locks.keys()].filter((id) => {
      const z = this.w.graph.nav.trafficZones.find((q) => q.id === id);
      return !!z && pointInPoly(b.pos.x, b.pos.y, z.polygon);
    }); // a zone the robot is standing in stays its own: it is not asked for again (and never given to another robot while it is inside)
    for (const id of [...b.locks.keys()]) if (!inside.includes(id)) this.w.dropLock(b, id); // the new road is asked for again from scratch
    b.handedOver = 0; // (the new plan has its own distances)
    b.plan = { pts, laneAt, cum, total: cum[cum.length - 1] };
    b.s = cum[trail.length] ?? 0;
    const all = this.permits.entriesOf(b.plan);
    b.entries = all.filter((e) => e.exitS > b.s + 0.5);
    for (const id of inside) {
      let exit = b.s;
      for (let q = b.s; q <= b.plan.total; q += 0.2) {
        const p = pointAt(b.plan, q);
        if (this.permits.zoneIdsAt(p.x, p.y).includes(id)) exit = q;
        else if (q > b.s + 0.4) break;
      }
      b.locks.set(id, exit + clear);
    }
    b.entryIdx = 0;
    b.queued = null;
    b.gateAt = -9;
    b.gateOk = true;
    b.stoppedSince = -1;
    b.waitReason = null;
    return true;
  }
  /** A parked robot with enough battery takes the oldest order of its fleet: it drives to the first station empty and carries the load from the leg the order says. */
  private takeOrder(b: Bot): boolean {
    if (b.battery < 25 || !this.w.orders.length) return false;
    const order = this.w.orders.find((o) => o.fleetId === b.fleetId && (!o.robotModel || o.robotModel === b.model));
    if (!order) return false;
    let legs = [...order.legs],
      loadFrom = order.loadFrom;
    if (legs[0] === b.stationId && legs.length > 1) {
      legs = legs.slice(1);
      loadFrom = Math.max(0, loadFrom - 1);
    } // already standing at the first station
    b.trip = {
      assignedAtS: this.w.time,
      startedAtS: null,
      deadlineS: this.w.time + 600,
      id: order.tripId ?? this.w.newTripId(),
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
      if (!order.tripId) this.w.undoTripId();
      return false;
    } // cannot reach it from here: the order stays for another robot
    this.w.orders = this.w.orders.filter((o) => o !== order);
    return true;
  }
}
