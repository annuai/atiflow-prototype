import { LaneGraph, pointAt, type PathPlan } from '../core/lanes';
import { angleDiff, pointInPoly } from '../core/geom';
import type { NavGraph, RobotState, RobotTelemetry, Vec2 } from '../core/types';

const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const HOLD = 1.8, V = 1.1, ACC = 1.2, DEC = 3, TD = 1.3;       // hold distance before a traffic zone, cruise speed, accel / brake (m/s^2), robot centre -> trolley centre
const TURN_RATE = 2.5;                                          // rad/s: the robot turns at most this fast, and slows down while its heading lags behind the route
const BACKOFF_AFTER = 2, BACKOFF_MAX = 8, BACK_V = 0.8;     // a robot that has been stuck this long behind an older trip backs up along its route (at most this far, this fast)
const CLEAR = 0.03, CLAIM = 3.2, SAMPLE = 0.35;      // gap kept between footprints; how far ahead a robot reserves its way; spacing of the checked positions                                            // extra gap required between footprints (m)
/** Footprints are chains of circles: the robot (1.2 x 0.85 m) and the trolley it tows (1.1 x 0.7 m). Two lanes are 1.0 m apart, so neighbours in parallel lanes never conflict. */
type Circle = { x: number; y: number; r: number };
type Pose = { x: number; y: number; th: number };
const ROBOT_R = 0.46, TROLLEY_R = 0.4;
export const robotCircles = (p: Pose): Circle[] => [-0.4, 0, 0.4].map((o) => ({ x: p.x + Math.cos(p.th) * o, y: p.y + Math.sin(p.th) * o, r: ROBOT_R }));
export const trolleyCircles = (p: Pose): Circle[] => [-0.33, 0, 0.33].map((o) => ({ x: p.x + Math.cos(p.th) * o, y: p.y + Math.sin(p.th) * o, r: TROLLEY_R }));
const hit = (a: Circle[], b: Circle[]) => a.some((p) => b.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r + CLEAR));

interface Bot {
  id: string; model: string; fleetId: string; pos: Vec2; theta: number; battery: number; state: RobotState;
  node: string; stationId: string | null; plan: PathPlan | null; s: number; entries: { zoneId: string; s: number; exitS: number }[]; entryIdx: number;
  holds: Map<string, number>; holdIn: Map<string, number>; waitingZone: string | null; waitReason: 'traffic' | 'headway' | null;
  timer: number; speed: number; v: number; blockedUntil: number; loaded: boolean; nextLoaded: boolean; attached: boolean; trailer: Pose | null; moveAt: number; prio: number; backFrom: number; backTo: number; yieldUntil: number; task: RobotTelemetry['task']; payload: RobotTelemetry['payload']; dest: string | null; lane: string | null;
}

/** Pure, deterministic fleet simulation (no timers). Obeys the same rules a real fleet does: fleet-confined lanes, directed lanes,
 *  traffic zones (capacity, FIFO queue, hold point at the entrance), headway behind other robots, no forbidden zones (lanes avoid them). */
export class FleetSim {
  readonly graph: LaneGraph; bots: Bot[] = []; time = 0; private rand: () => number;
  zones = new Map<string, { occ: Set<string>; queue: string[] }>();
  constructor(nav: NavGraph, private siteId: string, count = 14, seed = 7) {
    this.graph = new LaneGraph(nav); this.rand = rng(seed);
    nav.trafficZones.forEach((z) => this.zones.set(z.id, { occ: new Set(), queue: [] }));
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
      const fleet = nav.fleets[i % nav.fleets.length].id;
      const spread = (s: NavGraph['stations'][number]) => this.bots.every((o) => Math.hypot(o.pos.x - this.graph.nodes.get(s.nodeId)!.x, o.pos.y - this.graph.nodes.get(s.nodeId)!.y) > 4);   // parked robots start well apart
      const own = nav.stations.filter((s) => s.fleets.includes(fleet) && s.type !== 'charge' && !used.has(s.id) && spread(s));
      const st = own[Math.floor(this.rand() * own.length)]; used.add(st.id); const n = this.graph.nodes.get(st.nodeId)!;
      this.bots.push({ id: `TRP-${20480 + i}`, model: i % 5 === 4 ? 'sherpa-tug' : 'sherpa-xt-lite', fleetId: fleet, pos: { x: n.x, y: n.y }, theta: 0, battery: 45 + this.rand() * 55, state: 'idle', node: n.id, stationId: st.id,
        plan: null, s: 0, entries: [], entryIdx: 0, holds: new Map(), holdIn: new Map(), waitingZone: null, waitReason: null, timer: this.rand() * 4, speed: 0, v: 0, blockedUntil: 0, loaded: false, nextLoaded: i % 2 === 0, attached: false, trailer: null, moveAt: 0, prio: 0, backFrom: -1, backTo: -Infinity, yieldUntil: -1, task: null, payload: null, dest: null, lane: null });
    }
  }
  private incoming(id: string) { return this.bots.filter((b) => b.dest === id).length; }
  private parked(b: Bot) { return b.state === 'idle' || b.state === 'working' || b.state === 'charging'; }
  /** Nodes where a robot stands still: other robots are never routed through them. */
  private occupiedNodes(except: Bot) { return new Set(this.bots.filter((o) => o !== except && o.stationId && this.parked(o)).map((o) => o.node)); }
  private planRoute(b: Bot): boolean {
    const low = b.battery < 25; const g = this.graph.nav; const loaded = !low && b.nextLoaded; const avoid = this.occupiedNodes(b);
    const taken = new Set(this.bots.filter((o) => o !== b && o.stationId).map((o) => o.stationId!));       // one robot per station: never send two to the same spot
    const cands = g.stations.filter((s) => s.fleets.includes(b.fleetId) && s.id !== b.stationId && !taken.has(s.id) && (low ? s.type === 'charge' : s.type !== 'charge'))
      .sort((p, q) => this.incoming(p.id) - this.incoming(q.id) + (this.rand() - 0.5) * 2.5);
    for (const st of cands) {
      if (this.incoming(st.id) >= 1) continue;
      const lanes = this.graph.route(b.node, st.nodeId, b.fleetId, avoid); if (!lanes || !lanes.length) continue;
      const plan = this.graph.plan(lanes, b.pos); const entries: Bot['entries'] = [];
      for (const z of g.trafficZones) {                       // intervals [enter, exit] of the path inside each zone; passes <6 m apart are one pass
        const iv: Bot['entries'] = []; let inside = pointInPoly(plan.pts[0].x, plan.pts[0].y, z.polygon); let start = 0;
        for (let s = 0.2; s <= plan.total + 0.2; s += 0.2) {
          const p = pointAt(plan, Math.min(s, plan.total)); const now = pointInPoly(p.x, p.y, z.polygon);
          if (now && !inside) start = s; if (!now && inside) iv.push({ zoneId: z.id, s: start, exitS: s }); inside = now;
        }
        if (inside) iv.push({ zoneId: z.id, s: start, exitS: plan.total });
        for (const q of iv) { const prev = [...entries].reverse().find((x) => x.zoneId === z.id); if (prev && q.s - prev.exitS < 6) prev.exitS = q.exitS; else entries.push(q); }
      }
      entries.sort((a, c) => a.s - c.s);
      Object.assign(b, { moveAt: this.time, prio: this.time, plan, s: 0, entries, entryIdx: 0, state: 'moving', dest: st.id, stationId: null, timer: 0, v: 0, loaded, attached: false, trailer: null,
        task: { id: `T-${Math.floor(this.rand() * 90000 + 10000)}`, type: low ? 'charge' : loaded ? 'transport' : 'return', from: b.stationId ?? undefined, to: st.id, progress: 0 },
        payload: loaded ? { kind: ['PCBA tray', 'Reel box', 'Material'][Math.floor(this.rand() * 3)], qty: 1 + Math.floor(this.rand() * 9) } : null });
      if (!low) b.nextLoaded = !b.nextLoaded;                  // loaded trip out, empty trip back
      return true;
    }
    return false;
  }
  /** Backing up must never take the robot (or its trolley) into a traffic zone it does not hold. */
  private intoForeignZone(b: Bot, plan: PathPlan, q: number): boolean {
    const at = [this.poseAt(plan, q), ...(b.attached ? [this.poseAt(plan, q - TD)] : [])];
    return this.graph.nav.trafficZones.some((z) => !b.holds.has(z.id) && at.some((p) => pointInPoly(p.x, p.y, z.polygon)));
  }
  private release(b: Bot, zoneId: string) { this.zones.get(zoneId)?.occ.delete(b.id); b.holds.delete(zoneId); b.holdIn.delete(zoneId); }
  private acquire(b: Bot, zoneId: string): boolean {
    const z = this.graph.nav.trafficZones.find((q) => q.id === zoneId)!; const st = this.zones.get(zoneId)!;
    if (!st.queue.includes(b.id)) st.queue.push(b.id);
    if (st.occ.size < z.capacity && st.queue[0] === b.id) { st.queue.shift(); st.occ.add(b.id); return true; }
    return false;
  }
  /** Heading of the route at arc length q: central difference over 0.5 m, so it is smooth even on curves. */
  private headingAt(plan: PathPlan, q: number) {
    const a = pointAt(plan, Math.max(0, Math.min(plan.total, q - 0.25))), c = pointAt(plan, Math.max(0, Math.min(plan.total, q + 0.25)));
    return Math.hypot(c.x - a.x, c.y - a.y) > 1e-6 ? Math.atan2(c.y - a.y, c.x - a.x) : pointAt(plan, Math.max(0, Math.min(plan.total, q))).heading;
  }
  /** Pose on the route at arc length q; before the start the route is extended backwards along its first heading (where a trolley hangs while the robot leaves). */
  private poseAt(plan: PathPlan, q: number): Pose {
    const h = this.headingAt(plan, Math.max(0, q));
    if (q >= 0) { const p = pointAt(plan, Math.min(q, plan.total)); return { x: p.x, y: p.y, th: h }; }
    const p0 = pointAt(plan, 0); return { x: p0.x + Math.cos(h) * q, y: p0.y + Math.sin(h) * q, th: h };
  }
  private trailerPose(b: Bot): Pose | null { return b.attached && b.plan ? this.poseAt(b.plan, b.s - TD) : b.attached && b.trailer ? b.trailer : null; }
  private body(o: Bot): Circle[] { const c = robotCircles({ x: o.pos.x, y: o.pos.y, th: o.theta }); return o.trailer ? [...c, ...trolleyCircles(o.trailer)] : c; }
  /** The footprint (robot + trolley) at each checked position over the next `L` meters of the route. */
  private corridor(b: Bot, L: number): { d: number; c: Circle[] }[] {
    const plan = b.plan!; const out: { d: number; c: Circle[] }[] = [];
    for (let d = SAMPLE; d <= L + 1e-6; d += SAMPLE) { const q = Math.min(b.s + d, plan.total); out.push({ d, c: [...robotCircles(this.poseAt(plan, q)), ...(b.attached ? trolleyCircles(this.poseAt(plan, q - TD)) : [])] }); if (q >= plan.total) break; }
    return out;
  }
  /** How far along its route the robot may drive: up to where its footprint would touch another robot or the way a higher-priority robot has reserved. */
  private freeLength(b: Bot, claims: Map<string, Circle[]>): { len: number; claim: Circle[]; by: Bot | null } {
    const mine = this.corridor(b, CLAIM); const claim: Circle[] = []; let len = 0;
    for (const m of mine) { const by = this.touches(b, m.c, claims); if (by) return { len, claim, by }; len = m.d; claim.push(...m.c); }
    return { len: Infinity, claim, by: null };
  }
  private touches(b: Bot, mine: Circle[], claims: Map<string, Circle[]>): Bot | null {
    const at = mine[0]; if (!at) return null;
    for (const o of this.bots) {
      if (o === b || o.state === 'offline' || Math.hypot(o.pos.x - at.x, o.pos.y - at.y) > 12) continue;
      if (hit(mine, this.body(o))) return o; const c = claims.get(o.id); if (c && hit(mine, c)) return o;
    }
    return null;
  }
  step(dt: number) {
    this.time += dt; const claims = new Map<string, Circle[]>();
    // Strict priority = oldest trip first. Each robot reserves its way top-down, so a lower-priority robot can never block a higher one for long and no cycle of waits can form.
    const order = [...this.bots].sort((p, q) => p.prio - q.prio || (p.id < q.id ? -1 : 1));
    for (const b of order) this.stepBot(b, dt, claims);
  }
  private stepBot(b: Bot, dt: number, claims: Map<string, Circle[]>) {
    b.speed = 0;
    if (b.state === 'blocked') { b.v = 0; if (this.time >= b.blockedUntil) b.state = 'moving'; return; }
    if (b.state === 'idle' || b.state === 'working' || b.state === 'charging') {
      b.v = 0; b.timer -= dt; if (b.state === 'charging') b.battery = Math.min(100, b.battery + dt * 6);
      if (b.timer <= 0 && !(b.state === 'charging' && b.battery < 90)) { if (!this.planRoute(b)) b.timer = 1.5; }
      return;
    }
    const plan = b.plan!;
    if (b.s < 0.02) {                                             // leaving a station: turn on the spot towards the route, then hitch the trolley behind
      const h = this.headingAt(plan, 0), d = angleDiff(b.theta, h);
      const turn = Math.abs(d) > 0.04;
      const th = turn ? b.theta + Math.max(-2 * dt, Math.min(2 * dt, d)) : b.theta;       // the turn and the hitching only happen when nothing stands in the way
      const swing = [...robotCircles({ ...b.pos, th }), ...(!turn && b.loaded && !b.attached ? trolleyCircles(this.poseAt(plan, b.s - TD)) : [])];
      if (this.touches(b, swing, claims)) { b.state = 'waiting'; b.waitReason = 'headway'; b.v = 0; return; }
      if (turn) { b.theta = th; b.state = 'moving'; b.v = 0; return; }
      if (b.loaded && !b.attached) { b.attached = true; b.trailer = this.poseAt(plan, b.s - TD); }
    }
    let limit = plan.total; let zoneWait = false; const e = b.entries[b.entryIdx];
    if (e) {
      const hold = Math.max(0, e.s - HOLD);
      if (b.s >= hold - 1e-3) {
        if (this.acquire(b, e.zoneId)) { b.holds.set(e.zoneId, e.exitS); b.holdIn.set(e.zoneId, e.s); b.entryIdx++; }
        else { zoneWait = true; limit = Math.min(limit, hold); b.waitReason = 'traffic'; b.waitingZone = e.zoneId; }
      } else limit = Math.min(limit, hold);
    }
    const free = zoneWait ? { len: 0, claim: [] as Circle[], by: null as Bot | null } : this.freeLength(b, claims);
    const blocked = free.len < CLAIM - 1e-6; if (!zoneWait) { b.waitingZone = null; b.waitReason = blocked ? 'headway' : null; }
    // Stuck for a long time behind an older trip (e.g. two robots meeting head-on in a narrow aisle): back up along the route until the other one has passed.
    if (blocked && free.by && free.by.prio > b.prio && this.time - b.moveAt > BACKOFF_AFTER) free.by.yieldUntil = this.time + 1;     // an older trip is stuck behind this robot: it must make room
    const yielding = b.yieldUntil > this.time && b.v < 0.05;
    const stuck = blocked && !zoneWait && this.time - b.moveAt > BACKOFF_AFTER && free.by && (free.by.prio <= b.prio || this.time - b.moveAt > BACKOFF_AFTER * 4);
    if (stuck || yielding || b.backFrom >= 0) {
      if (b.backFrom < 0) { b.backFrom = b.s; b.backTo = b.holdIn.size ? Math.min(...b.holdIn.values()) - 0.7 : -Infinity; }      // holding a traffic zone: back right out of it, so the robots waiting for it can go
      const back = b.s - SAMPLE; const rear = [...robotCircles(this.poseAt(plan, back)), ...(b.attached ? trolleyCircles(this.poseAt(plan, back - TD)) : [])];
      if ((blocked || yielding || b.s > b.backTo) && b.s > 0.2 && !this.intoForeignZone(b, plan, b.s - SAMPLE) && b.backFrom - b.s < Math.max(BACKOFF_MAX, b.backFrom - b.backTo + 0.5) && !this.touches(b, rear, claims)) {
        b.s -= BACK_V * dt; const p = this.poseAt(plan, b.s); b.pos = { x: p.x, y: p.y }; { const d = angleDiff(b.theta, this.headingAt(plan, b.s)); b.theta += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, d)); } b.lane = pointAt(plan, Math.max(0, b.s)).lane; b.trailer = this.trailerPose(b);
        // backed out of a traffic zone: give it up (so the robots waiting for it can move) and ask for it again later
        for (const [zid, es] of [...b.holdIn]) if (b.s < es - 0.5) { this.release(b, zid); const i = b.entries.findIndex((x) => x.zoneId === zid && x.s === es); if (i >= 0) b.entryIdx = Math.min(b.entryIdx, i); }
        b.state = 'moving'; b.v = 0; b.speed = BACK_V; b.waitReason = 'headway'; claims.delete(b.id); return;
      }
      b.backFrom = -1; b.moveAt = this.time;
    }
    const curve = Math.min(1, Math.abs(angleDiff(this.headingAt(plan, b.s), this.headingAt(plan, Math.min(plan.total, b.s + 1)))));   // slow down in bends
    if (blocked) limit = Math.min(limit, b.s + free.len);
    const room = Math.max(0, limit - b.s);
    const lag = Math.abs(angleDiff(b.theta, this.headingAt(plan, Math.min(plan.total, b.s + 0.3))));
    let vt = V * (1 - 0.5 * curve) * Math.max(0.15, 1 - lag / 0.7); vt = Math.min(vt, Math.sqrt(2 * DEC * room));
    b.v = vt > b.v ? Math.min(vt, b.v + ACC * dt) : Math.max(vt, b.v - DEC * dt);
    const ds = Math.min(b.v * dt, room); b.s += ds;
    const p = this.poseAt(plan, b.s); b.pos = { x: p.x, y: p.y }; { const d = angleDiff(b.theta, this.headingAt(plan, b.s)); b.theta += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, d)); } b.lane = pointAt(plan, Math.max(0, b.s)).lane;
    b.trailer = this.trailerPose(b); b.speed = ds / dt;
    const held = zoneWait || blocked;
    if (ds / dt > 0.25 || !held) b.moveAt = this.time;                                  // time of the last real progress (a robot inching up to an obstacle counts as stopped)
    b.state = held && ds / dt < 0.3 ? 'waiting' : 'moving'; if (b.state === 'waiting' && b.v < 0.03) b.v = 0;
    for (const [zid, exitS] of [...b.holds]) if (b.s > exitS + 0.1) this.release(b, zid);   // left the zone: let the next robot in
    b.battery = Math.max(0, b.battery - dt * 0.05); if (b.task) b.task.progress = Math.min(1, b.s / Math.max(plan.total, 1));
    if (b.s >= plan.total - 1e-3) {
      for (const zid of [...b.holds.keys()]) this.release(b, zid);
      const st = this.graph.station(b.dest!)!; b.node = st.nodeId; b.stationId = st.id; b.dest = null; b.plan = null; b.speed = 0; b.v = 0; b.waitingZone = null; b.waitReason = null;
      b.attached = false; b.trailer = null; b.loaded = false; b.payload = null;                      // delivered: the trolley is unhitched and the load handed over
      const charge = b.task?.type === 'charge'; b.state = charge ? 'charging' : 'working'; b.timer = charge ? 3 : 3 + this.rand() * 4; if (b.task) b.task.progress = 1; return;
    }
    claims.set(b.id, free.claim);
    if (this.rand() < dt * 0.0012) { b.state = 'blocked'; b.blockedUntil = this.time + 5 + this.rand() * 4; b.speed = 0; b.v = 0; claims.delete(b.id); }
  }
  snapshot(): RobotTelemetry[] {
    const ts = Date.now();
    return this.bots.map((b) => {
      const moving = (b.state === 'moving' || b.state === 'waiting' || b.state === 'blocked') && b.plan;
      const traffic = b.waitingZone ? { zoneId: b.waitingZone, status: 'waiting' as const } : b.holds.size ? { zoneId: [...b.holds.keys()][0], status: 'inside' as const } : null;
      const alerts: NonNullable<RobotTelemetry['alerts']> = [];
      if (b.state === 'blocked') alerts.push({ code: 'OBSTACLE', severity: 'critical', msg: 'Path obstructed' });
      if (b.battery < 25) alerts.push({ code: 'LOW_BATT', severity: 'warn', msg: 'Low battery' });
      if (b.waitingZone) alerts.push({ code: 'TRAFFIC_WAIT', severity: 'info', msg: `Waiting for ${b.waitingZone}` });
      return { id: b.id, model: b.model, fleetId: b.fleetId, siteId: this.siteId, pose: { x: b.pos.x, y: b.pos.y, theta: b.theta }, speed: b.speed, state: b.state, battery: Math.round(b.battery),
        payload: b.payload, trailer: b.trailer ? { x: b.trailer.x, y: b.trailer.y, theta: b.trailer.th } : null, task: b.task, path: moving ? [b.pos, ...b.plan!.pts.filter((_, i) => b.plan!.cum[i] > b.s)] : [], laneId: b.lane, traffic, waitReason: b.waitReason,
        atStation: b.stationId && (b.state === 'working' || b.state === 'charging' || b.state === 'idle') ? b.stationId : null, alerts, ts };
    });
  }
}
