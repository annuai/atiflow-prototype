import { angleDiff } from '../../core/geom';
import { pointAt, type PathPlan } from '../../core/lanes';
import { ACC, CLAIM, DEC, FAULT_RATE, REROUTE_AFTER, SAMPLE, TD, TURN_RATE, V } from './constants';
import { ROBOT_R, TURN_R, robotCircles, trolleyCircles } from './footprint';
import { headingAt, poseAt } from './path';
import type { Bot, Circle } from './types';
import type { World } from './world';
import type { Permits } from './permits';
import type { Traffic } from './traffic';
import type { Dispatch } from './dispatch';

/** One robot's step: parked / charging / faulted / blocked robots, leaving a station, asking for permits, speed and position, arriving, faults. */
export class Mover {
  constructor(
    private readonly w: World,
    private readonly permits: Permits,
    private readonly traffic: Traffic,
    private readonly dispatch: Dispatch,
  ) {}
  /** One tick of one robot. Robots that are not driving stand still in their own way; a driving one asks for the permits ahead, finds how far it may go, moves, and arrives or breaks down. */
  stepBot(b: Bot, dt: number, claims: Map<string, Circle[]>) {
    b.speed = 0;
    if (b.estop) return this.stepStopped(b, claims);
    if (b.state === 'blocked') return this.stepBlocked(b);
    if (b.state === 'error') return this.stepFaulted(b, claims);
    if (b.state === 'idle' || b.state === 'working' || b.state === 'charging') return this.stepParked(b, dt);
    const plan = b.plan!;
    if (b.s < 0.02 && this.leaveStation(b, plan, dt, claims)) return;
    if (b.loaded && !b.attached && b.s >= TD) {
      b.attached = true;
      b.trailer = poseAt(plan, b.s - TD);
    } // no room behind at the station: the trolley is hitched as soon as the robot has pulled clear
    const ahead = this.permitsAhead(b, plan);
    if (!ahead) return; // it took another road: its new plan starts next tick
    const way = this.wayAhead(b, claims, ahead);
    this.drive(b, plan, dt, claims, way);
    if (b.task) this.dispatch.syncTask(b, Math.min(1, b.s / Math.max(plan.total, 1)));
    if (b.s >= plan.total - 1e-3) return this.arrive(b);
    claims.set(b.id, way.free.claim);
    this.breakDown(b, dt, claims);
  }
  /** Emergency stop: the robot stands exactly where it is, its footprint stays in the way, and nothing else about it changes until it is released. */
  private stepStopped(b: Bot, claims: Map<string, Circle[]>) {
    b.v = 0;
    claims.set(b.id, [
      ...robotCircles({ ...b.pos, th: b.theta }),
      ...(b.attached && b.trailer ? trolleyCircles(b.trailer) : []),
    ]);
  }
  /** A random obstacle in the way: the robot stops for a few seconds. */
  private stepBlocked(b: Bot) {
    b.v = 0;
    if (this.w.time >= b.blockedUntil) b.state = 'moving';
  }
  /** A fault that needs someone to come: the robot stands where it is (its footprint stays in the way) until it is cleared. */
  private stepFaulted(b: Bot, claims: Map<string, Circle[]>) {
    b.v = 0;
    claims.set(b.id, [
      ...robotCircles({ ...b.pos, th: b.theta }),
      ...(b.attached && b.trailer ? trolleyCircles(b.trailer) : []),
    ]);
    if (this.w.time >= b.faultUntil) {
      b.state = 'moving';
      this.w.events.push({ type: 'fault-cleared', ts: this.w.at(this.w.time), robotId: b.id, fleetId: b.fleetId });
    }
  }
  /** Parked, working or charging: count down, charge, and ask for the next trip when the time is up. */
  private stepParked(b: Bot, dt: number) {
    b.v = 0;
    b.timer -= dt;
    if (b.state === 'charging') b.battery = Math.min(100, b.battery + dt * 6);
    if (b.timer <= 0 && !(b.state === 'charging' && b.battery < 90)) {
      if (!this.dispatch.planRoute(b)) b.timer = 1.5;
    }
  }
  /** Leaving a station: turn on the spot towards the route, hitching the trolley behind when there is room for it. True = the robot used this tick for that (waiting or turning). */
  private leaveStation(b: Bot, plan: PathPlan, dt: number, claims: Map<string, Circle[]>): boolean {
    const h = headingAt(plan, 0),
      d = angleDiff(b.theta, h);
    const turn = Math.abs(d) > 0.04;
    const th = turn ? b.theta + Math.max(-2 * dt, Math.min(2 * dt, d)) : b.theta;
    const o = this.traffic.touches(b, robotCircles({ ...b.pos, th }, turn ? TURN_R : ROBOT_R), claims);
    if (o) {
      b.state = 'waiting';
      b.waitReason = 'headway';
      b.v = 0;
      b.waitsOn = [o.id];
      if (b.waitSince < 0) b.waitSince = this.w.time;
      return true;
    }
    if (turn) {
      b.theta = th;
      b.state = 'moving';
      b.v = 0;
      return true;
    }
    if (b.loaded && !b.attached && !this.traffic.touches(b, trolleyCircles(poseAt(plan, b.s - TD)), claims)) {
      b.attached = true;
      b.trailer = poseAt(plan, b.s - TD);
    }
    return false;
  }
  /**
   * Ask for the permits of the next entry once the robot is at its hold point (first come first served): the distance it may drive for the permits' sake, whether it is held at one, and which zone it waits for.
   * Held up for a long time by something standing in the way (not by a traffic rule), it takes another road ahead, never back: null then.
   */
  private permitsAhead(b: Bot, plan: PathPlan): { limit: number; gate: boolean; zoneWait: string | null } | null {
    let limit = plan.total;
    let gate = false;
    let zoneWait: string | null = null;
    const e = b.entries[b.entryIdx];
    b.queued = null; // (set again below when the robot is queueing at a hold point)
    if (e) {
      const hold = e.hold;
      if (b.s >= hold - 1e-3) {
        const r = this.permits.takeEntry(b, e);
        if (r.ok) b.entryIdx++;
        else {
          gate = true;
          zoneWait = r.zone;
          limit = Math.min(limit, hold);
        }
      } else limit = Math.min(limit, hold);
    }
    if (b.s >= 0.5 && b.v < 0.05 && !zoneWait && (gate || b.waitReason === 'headway')) {
      if (b.stoppedSince < 0) b.stoppedSince = this.w.time;
      if (this.w.time - b.stoppedSince > REROUTE_AFTER && this.w.time - b.rerouteAt > 20) {
        b.rerouteAt = this.w.time;
        if (this.dispatch.reroute(b)) return null;
      }
    } else if (b.v > 0.1) b.stoppedSince = -1;
    return { limit, gate, zoneWait };
  }
  /** How far the robot may drive for the other robots' sake (nobody's footprint or reservation in the way), why it waits if it does, and, when the robot in the way waits for zones this robot holds, handing those over. */
  private wayAhead(
    b: Bot,
    claims: Map<string, Circle[]>,
    ahead: { limit: number; gate: boolean; zoneWait: string | null },
  ) {
    const { gate, zoneWait } = ahead;
    const free = gate ? { len: 0, claim: [] as Circle[], by: null as Bot | null } : this.traffic.freeLength(b, claims);
    if (!gate) b.waitsOn = free.by && free.len < CLAIM - 1e-6 ? [free.by.id] : [];
    const blocked = free.len < CLAIM - 1e-6;
    b.waitingZone = zoneWait;
    b.waitReason = zoneWait ? 'traffic' : gate ? 'intersection' : blocked ? 'headway' : null;
    // The robot in the way is itself waiting for the zones this robot holds (it stands at its station right on this road): this robot hands them over so it can leave (the one exception to one robot per zone: a recorded override, see ZONE_HANDOVER).
    if (blocked && b.locks.size && b.v < 0.05) {
      const by = this.traffic.touches(b, this.traffic.corridor(b, SAMPLE)[0]?.c ?? [], claims);
      const e2 = by && by.plan && by.s < 0.5 ? by.entries[by.entryIdx] : null;
      if (e2 && this.w.time - b.stoppedSince > 3 && b.stoppedSince >= 0)
        for (const x of e2.xings)
          if (b.locks.has(x.id)) {
            b.handedOver = Math.max(b.handedOver, b.locks.get(x.id) ?? 0);
            this.w.dropLock(b, x.id);
          }
    }
    return { free, blocked, gate, limit: ahead.limit };
  }
  /** Speed and position: slow in bends and while the heading lags, brake for the room left, move along the route, turn, and give permits back for the zones the robot has left. Returns the distance driven. */
  private drive(
    b: Bot,
    plan: PathPlan,
    dt: number,
    claims: Map<string, Circle[]>,
    way: { free: { len: number }; blocked: boolean; gate: boolean; limit: number },
  ): number {
    const { free, blocked, gate } = way;
    let limit = way.limit;
    const curve = Math.min(
      1,
      Math.abs(angleDiff(headingAt(plan, b.s), headingAt(plan, Math.min(plan.total, b.s + 1)))),
    ); // slow down in bends
    if (blocked) limit = Math.min(limit, b.s + free.len);
    const room = Math.max(0, limit - b.s);
    const lag = Math.abs(angleDiff(b.theta, headingAt(plan, Math.min(plan.total, b.s + 0.3))));
    let vt = V * (1 - 0.5 * curve) * Math.max(0.15, 1 - lag / 0.7);
    vt = Math.min(vt, Math.sqrt(2 * DEC * room));
    b.v = vt > b.v ? Math.min(vt, b.v + ACC * dt) : Math.max(vt, b.v - DEC * dt);
    const ds = Math.min(b.v * dt, room);
    b.s += ds;
    if (b.attached) b.odoLoaded += ds;
    else b.odoEmpty += ds;
    const p = poseAt(plan, b.s);
    b.pos = { x: p.x, y: p.y };
    {
      const d = angleDiff(b.theta, headingAt(plan, b.s));
      const dth = Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, d));
      if (b.v > 0.05 || !this.traffic.touches(b, robotCircles({ ...b.pos, th: b.theta + dth }, TURN_R), claims))
        b.theta += dth;
    } // (a robot standing still only swings its corners out when nobody is there)
    b.lane = pointAt(plan, b.s).lane;
    b.trailer = this.traffic.trailerPose(b);
    b.speed = ds / dt;
    const held = gate || blocked;
    b.state = held && ds / dt < 0.3 ? 'waiting' : 'moving';
    if (b.state === 'waiting' && b.v < 0.03) b.v = 0;
    if (b.state === 'waiting') {
      if (b.waitSince < 0) b.waitSince = this.w.time;
    } else b.waitSince = -1;
    for (const [zid, exitS] of [...b.holds]) if (b.s > exitS) this.w.release(b, zid); // left the zone (trolley included): let the next robot in
    for (const [id, exitS] of [...b.locks]) if (b.s > exitS) this.w.dropLock(b, id); // left the intersection: the next robot may enter
    b.battery = Math.max(0, b.battery - dt * 0.05);
    b.energyKWh += (dt * 0.05 * b.kWh) / 100;
    return ds;
  }
  /** The robot has reached its destination: permits and trolley are let go, the trip moves on (or ends, and is reported), and the robot waits, parks or charges. */
  private arrive(b: Bot) {
    b.queued = null;
    for (const zid of [...b.holds.keys()]) this.w.release(b, zid);
    const st = this.w.graph.station(b.dest!)!;
    b.node = st.nodeId;
    b.stationId = st.id;
    b.dest = null;
    b.plan = null;
    b.handedOver = 0;
    b.speed = 0;
    b.v = 0;
    b.waitingZone = null;
    b.waitReason = null;
    for (const id of [...b.locks.keys()]) this.w.dropLock(b, id); // a parked robot holds no permit: others wait because its body is in the way, and it asks again when it leaves
    b.attached = false;
    b.trailer = null;
    b.loaded = false;
    b.payload = null; // delivered: the trolley is unhitched and the load handed over
    const t = b.trip;
    if (t) t.leg++;
    const done = !t || t.leg >= t.legs.length;
    if (t && done)
      this.w.events.push({
        type: 'trip-completed',
        ts: this.w.at(this.w.time),
        robotId: b.id,
        fleetId: b.fleetId,
        tripId: t.id,
        kind: t.kind,
        assignedAt: this.w.at(t.assignedAtS),
        startedAt: this.w.at(t.startedAtS ?? t.assignedAtS),
        deadlineAt: t.deadlineS === null ? null : this.w.at(t.deadlineS),
      });
    if (t && done && t.orderId)
      this.w.orderUpdates.push({ id: t.orderId, status: 'completed', tripId: t.id, robotId: b.id });
    if (done) b.trip = null; // a stop on the way: a short call, then the next leg
    const charge = b.task?.type === 'charge',
      parking = b.task?.type === 'park';
    b.state = charge ? 'charging' : parking ? 'idle' : 'working';
    b.timer = charge ? 3 : parking ? 8 + this.w.rand() * 12 : done ? 3 + this.w.rand() * 4 : 1.5 + this.w.rand() * 2;
    if (b.task) {
      if (done) b.task.progress = 1;
      else this.dispatch.syncTask(b);
    }
  }
  /** Rare random trouble while driving: a fault that needs someone on site (only when faults are switched on), or an obstacle that clears by itself. */
  private breakDown(b: Bot, dt: number, claims: Map<string, Circle[]>) {
    if (this.w.opts.faults && this.w.faultRand() < dt * FAULT_RATE) {
      b.state = 'error';
      b.faultUntil = this.w.time + 45 + this.w.faultRand() * 60;
      b.speed = 0;
      b.v = 0;
      this.w.events.push({
        type: 'fault',
        ts: this.w.at(this.w.time),
        robotId: b.id,
        fleetId: b.fleetId,
        code: 'DRIVE_FAULT',
        needsIntervention: true,
      });
      return;
    }
    if (this.w.rand() < dt * 0.0012) {
      b.state = 'blocked';
      b.blockedUntil = this.w.time + 5 + this.w.rand() * 4;
      b.speed = 0;
      b.v = 0;
      claims.delete(b.id);
    }
  }
}
