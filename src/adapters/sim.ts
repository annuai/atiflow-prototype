import { LaneGraph, pointAt, type PathPlan } from '../core/lanes';
import { angleDiff, pointInPoly } from '../core/geom';
import type { NavGraph, RobotState, RobotTelemetry, Vec2 } from '../core/types';

const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const HOLD = 2.4, V = 1.1, ACC = 1.2, DEC = 3, TD = 1.3;       // hold distance before an intersection / traffic zone, cruise speed, accel / brake (m/s^2), robot centre -> trolley centre
const REROUTE_AFTER = 10;                                        // seconds stopped by an obstacle before the robot looks for another road
const TURN_RATE = 2.5;                                          // rad/s: the robot turns at most this fast, and slows down while its heading lags behind the route
const CLEAR = 0.01, CLAIM = 3.2, SAMPLE = 0.35;                 // gap kept between footprints; how far ahead a robot reserves its way; spacing of the checked positions
const GROUP_GAP = 3.6, EXIT_SPACE = 3.6;                        // intersections closer than this along a route are permitted together; free road needed beyond an intersection before entering it
/** Footprints are chains of circles: the robot (1.2 x 0.85 m) and the trolley it tows (1.1 x 0.7 m). Opposite lanes are about 0.95 m apart, so neighbours in parallel lanes pass each other. */
type Circle = { x: number; y: number; r: number };
type Pose = { x: number; y: number; th: number };
const ROBOT_R = 0.43, TROLLEY_R = 0.37;
export const robotCircles = (p: Pose): Circle[] => [-0.45, -0.15, 0.15, 0.45].map((o) => ({ x: p.x + Math.cos(p.th) * o, y: p.y + Math.sin(p.th) * o, r: ROBOT_R }));
export const trolleyCircles = (p: Pose): Circle[] => [-0.4, -0.13, 0.13, 0.4].map((o) => ({ x: p.x + Math.cos(p.th) * o, y: p.y + Math.sin(p.th) * o, r: TROLLEY_R }));
const hit = (a: Circle[], b: Circle[]) => a.some((p) => b.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r + CLEAR));

/** One permit request along a route: the traffic zones and intersections it passes through, within `GROUP_GAP` of each other, taken all together or not at all. */
interface Span { id: string; exitS: number; lanes?: string[] }     // lanes: the lanes the route uses inside the intersection (robots on the same lanes may follow each other through)
interface Entry { s: number; exitS: number; hold: number; zones: Span[]; xings: Span[] }   // each permit is given back when its own span is left
interface Bot {
  id: string; model: string; fleetId: string; pos: Vec2; theta: number; battery: number; state: RobotState;
  node: string; stationId: string | null; plan: PathPlan | null; s: number; entries: Entry[]; entryIdx: number;
  holds: Map<string, number>; locks: Map<string, number>; waitingZone: string | null; waitReason: 'traffic' | 'headway' | 'intersection' | null;
  timer: number; speed: number; v: number; blockedUntil: number; loaded: boolean; nextLoaded: boolean; attached: boolean; trailer: Pose | null; prio: number; gateAt: number; gateOk: boolean; stuckSince: number; stoppedSince: number; rerouteAt: number; queued: Entry | null;
  task: RobotTelemetry['task']; payload: RobotTelemetry['payload']; dest: string | null; lane: string | null;
}
interface Permit { occ: Set<string>; waiters: Set<string>; lanes?: Map<string, Set<string>> }

/** Pure, deterministic fleet simulation (no timers). Obeys the same rules a real fleet does: fleet-confined lanes, directed lanes, one direction of travel (robots never reverse),
 *  a permit ("visa") for every intersection and traffic zone (one robot in, the others wait at the hold point until it is clear), no touching, no forbidden zones (lanes avoid them). */
export class FleetSim {
  readonly graph: LaneGraph; bots: Bot[] = []; time = 0; private rand: () => number;
  zones = new Map<string, Permit>(); private xings = new Map<string, Permit>();
  constructor(nav: NavGraph, private siteId: string, count = 14, seed = 7) {
    this.graph = new LaneGraph(nav); this.rand = rng(seed);
    nav.trafficZones.forEach((z) => this.zones.set(z.id, { occ: new Set(), waiters: new Set() }));
    const used = new Set<string>(); const xAt = (x: number, y: number) => this.graph.intersections.near(x, y);
    for (let i = 0; i < count; i++) {
      const fleet = nav.fleets[i % nav.fleets.length].id;
      const spot = (s: NavGraph['stations'][number]) => this.graph.nodes.get(s.nodeId)!;
      const apart = (s: NavGraph['stations'][number]) => this.bots.every((o) => Math.hypot(o.pos.x - spot(s).x, o.pos.y - spot(s).y) > 4 && !xAt(spot(s).x, spot(s).y).some((c) => xAt(o.pos.x, o.pos.y).includes(c)));   // parked robots start well apart, one per intersection
      const own = nav.stations.filter((s) => s.fleets.includes(fleet) && s.type !== 'charge' && !used.has(s.id) && apart(s));
      const st = own[Math.floor(this.rand() * own.length)]; used.add(st.id); const n = this.graph.nodes.get(st.nodeId)!;
      const bot: Bot = { id: `AMR-${String(i + 1).padStart(3, '0')}`, model: i % 5 === 4 ? 'sherpa-tug' : 'sherpa-xt-lite', fleetId: fleet, pos: { x: n.x, y: n.y }, theta: 0, battery: 45 + this.rand() * 55, state: 'idle', node: n.id, stationId: st.id,
        plan: null, s: 0, entries: [], entryIdx: 0, holds: new Map(), locks: new Map(), waitingZone: null, waitReason: null, timer: this.rand() * 4, speed: 0, v: 0, blockedUntil: 0, loaded: false, nextLoaded: i % 2 === 0, attached: false, trailer: null, prio: 0, gateAt: -9, gateOk: true, stuckSince: -1, stoppedSince: -1, rerouteAt: -99, queued: null,
        task: null, payload: null, dest: null, lane: null };
      this.bots.push(bot);
    }
  }
  private incoming(id: string) { return this.bots.filter((b) => b.dest === id).length; }
  private parked(b: Bot) { return b.state === 'idle' || b.state === 'working' || b.state === 'charging'; }
  /** Nodes where a robot stands still: other robots are never routed through them. */
  private occupiedNodes(except: Bot) { return new Set(this.bots.filter((o) => o !== except && ((o.stationId && this.parked(o)) || (o.plan && o.s < 0.5))).map((o) => o.node)); }
  private planRoute(b: Bot): boolean {
    const low = b.battery < 25; const g = this.graph.nav; const loaded = !low && b.nextLoaded; const avoid = this.occupiedNodes(b); const stationNodes = new Set(g.stations.map((q) => q.nodeId));
    const taken = new Set(this.bots.filter((o) => o !== b && o.stationId).map((o) => o.stationId!));       // one robot per station: never send two to the same spot
    const xOf = (id: string) => { const n = this.graph.stationNode(id); return n ? this.graph.intersections.near(n.x, n.y) : []; };
    const busy = new Set(this.bots.filter((o) => o !== b).flatMap((o) => [o.stationId, o.dest]).filter((id): id is string => !!id).flatMap(xOf));       // never send two robots to stations of the same intersection: a parked one would block the other's way out
    const cands = g.stations.filter((s) => s.fleets.includes(b.fleetId) && s.id !== b.stationId && !taken.has(s.id) && !xOf(s.id).some((c) => busy.has(c)) && (low ? s.type === 'charge' : s.type !== 'charge'))
      .map((st) => { const n = this.graph.nodes.get(st.nodeId)!; return { st, cost: Math.hypot(n.x - b.pos.x, n.y - b.pos.y) / 12 + this.rand() * 3 }; }).sort((p, q) => p.cost - q.cost).map((c) => c.st);      // mostly nearby work, like a dispatcher would hand out
    for (const st of cands) {
      if (this.incoming(st.id) >= 1) continue;
      const lanes = this.graph.route(b.node, st.nodeId, b.fleetId, stationNodes) ?? this.graph.route(b.node, st.nodeId, b.fleetId, avoid);      // keep to roads without other stations on them when there is one: a parked robot must not block through traffic
      if (!lanes || !lanes.length) continue;
      const plan = this.graph.plan(lanes, b.pos);
      Object.assign(b, { prio: this.time, plan, s: 0, entries: this.entriesOf(plan), entryIdx: 0, state: 'moving', dest: st.id, stationId: null, timer: 0, v: 0, loaded, attached: false, trailer: null, gateAt: -9,
        task: { id: `T-${Math.floor(this.rand() * 90000 + 10000)}`, type: low ? 'charge' : loaded ? 'transport' : 'return', from: b.stationId ?? undefined, to: st.id, progress: 0 },
        payload: loaded ? { kind: ['PCBA tray', 'Reel box', 'Material'][Math.floor(this.rand() * 3)], qty: 1 + Math.floor(this.rand() * 9) } : null });
      if (!low) b.nextLoaded = !b.nextLoaded;                  // loaded trip out, empty trip back
      return true;
    }
    return false;
  }
  /** Every traffic zone and intersection a route passes through, grouped: permits closer than GROUP_GAP are requested together. */
  private entriesOf(plan: PathPlan): Entry[] {
    const spans: { zone: boolean; id: string; s: number; exitS: number }[] = []; const total = plan.total;
    for (const z of this.graph.nav.trafficZones) {                       // intervals [enter, exit] of the path inside each zone; passes <6 m apart are one pass
      let inside = pointInPoly(plan.pts[0].x, plan.pts[0].y, z.polygon); let start = 0; const mine: typeof spans = [];
      for (let s = 0.2; s <= total + 0.2; s += 0.2) {
        const p = pointAt(plan, Math.min(s, total)); const now = pointInPoly(p.x, p.y, z.polygon);
        if (now && !inside) start = s; if (!now && inside) mine.push({ zone: true, id: z.id, s: start, exitS: s }); inside = now;
      }
      if (inside) mine.push({ zone: true, id: z.id, s: start, exitS: total });
      for (const q of mine) { const prev = spans.filter((x) => x.id === z.id).pop(); if (prev && q.s - prev.exitS < 6) prev.exitS = q.exitS; else spans.push(q); }
    }
    for (let s = 0; s <= total + 0.1; s += 0.2) {                          // intersections: stretches of the path inside an intersection area
      const p = pointAt(plan, Math.min(s, total));
      for (const id of this.graph.intersections.near(p.x, p.y)) { const prev = spans.filter((x) => !x.zone && x.id === id).pop(); if (prev && s - prev.exitS < 3) prev.exitS = s; else spans.push({ zone: false, id, s, exitS: s }); }
    }
    spans.sort((a, b) => a.s - b.s); const out: Entry[] = [];
    for (const sp of spans) {
      const last = out[out.length - 1];
      if (last && sp.s - last.exitS < GROUP_GAP) { const list = sp.zone ? last.zones : last.xings; const have = list.find((x) => x.id === sp.id); if (have) have.exitS = Math.max(have.exitS, sp.exitS); else list.push({ id: sp.id, exitS: sp.exitS }); last.exitS = Math.max(last.exitS, sp.exitS); }
      else out.push({ s: sp.s, exitS: sp.exitS, hold: 0, zones: sp.zone ? [{ id: sp.id, exitS: sp.exitS }] : [], xings: sp.zone ? [] : [{ id: sp.id, exitS: sp.exitS }] });
    }
    for (const e of out) for (const x of e.xings) { const mine = spans.filter((q) => !q.zone && q.id === x.id && q.s >= e.s - 1e-6 && q.exitS <= e.exitS + 1e-6); const set = new Set<string>();
      for (const q of mine) for (let i = 0; i < plan.pts.length; i++) if (plan.cum[i] >= q.s - 0.3 && plan.cum[i] <= q.exitS + 0.3 && plan.laneAt[i]) set.add(plan.laneAt[i]!); x.lanes = [...set]; }
    // Where to wait: at the usual distance before the first permit, but never inside the area of some other intersection (a waiting robot there would be in the way of the robots that hold it).
    out.forEach((e, i) => {
      const floor = i ? out[i - 1].exitS + 0.5 : 0; let q = Math.max(0, e.s - HOLD); const free = (x: number) => { const a = pointAt(plan, Math.max(0, x)), r = pointAt(plan, Math.max(0, x - 1)); return !this.graph.intersections.near(a.x, a.y).length && !this.graph.intersections.near(r.x, r.y).length; };
      let h = q; while (h > floor && !free(h)) h -= 0.3; e.hold = free(h) || h > floor ? Math.max(0, h) : q;
    });
    return out;
  }
  private xing(id: string) { return this.xings.get(id) ?? this.xings.set(id, { occ: new Set(), waiters: new Set() }).get(id)!; }
  private byId(id: string) { return this.bots.find((o) => o.id === id)!; }
  private dropLock(b: Bot, id: string) { const p = this.xing(id); p.occ.delete(b.id); p.lanes?.delete(b.id); b.locks.delete(id); }
  /** Plan another way to the same destination from the end of the lane the robot is on, steering clear of everything standing still. The robot keeps the trail behind it (so its trolley does not jump). */
  private reroute(b: Bot): boolean {
    const old = b.plan!; if (b.holds.size) return false;
    const lane = this.graph.lanes.get(pointAt(old, b.s).lane ?? ''); const st = b.dest ? this.graph.station(b.dest) : null; if (!lane || !st) return false;
    const still = this.bots.filter((o) => o !== b && o.state !== 'offline' && o.v < 0.3);
    const avoid = new Set<string>(); for (const n of this.graph.nodes.values()) if (n.id !== lane.to && still.some((o) => Math.hypot(o.pos.x - n.x, o.pos.y - n.y) < 2.6)) avoid.add(n.id);
    const rest = lane.to === st.nodeId ? [] : this.graph.route(lane.to, st.nodeId, b.fleetId, avoid); if (!rest) return false;
    const lanes = [lane, ...rest]; const ahead = [...new Set(old.laneAt.filter((_, i) => old.cum[i] > b.s))]; if (lanes.map((l) => l.id).join() === ahead.join()) return false;      // no other way
    const tail = this.graph.plan(lanes, b.pos, true); const trailLen = Math.min(b.s, TD + 0.4); const trail: Vec2[] = [], trailLane: (string | null)[] = [];
    for (let q = b.s - trailLen; q < b.s - 0.05; q += 0.2) { const p = pointAt(old, Math.max(0, q)); trail.push({ x: p.x, y: p.y }); trailLane.push(p.lane); }
    const pts = [...trail, ...tail.pts], laneAt = [...trailLane, ...tail.laneAt]; const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    for (const id of [...b.locks.keys()]) this.dropLock(b, id);        // the new road is asked for again from scratch
    b.plan = { pts, laneAt, cum, total: cum[cum.length - 1] }; b.s = cum[trail.length] ?? 0; b.entries = this.entriesOf(b.plan).filter((e) => e.exitS > b.s + 0.5); b.entryIdx = 0; b.queued = null; b.gateAt = -9; b.gateOk = true; b.stoppedSince = -1; b.waitReason = null; return true;
  }
  private cancelTrip(b: Bot) {
    for (const [z] of [...b.holds]) this.release(b, z); for (const id of [...b.locks.keys()]) this.dropLock(b, id);
    b.queued = null;
    b.stationId = b.task?.from ?? this.graph.nav.stations.find((q) => q.nodeId === b.node)?.id ?? null;     // back at the station it came from
    Object.assign(b, { plan: null, dest: null, task: null, payload: null, entries: [], entryIdx: 0, s: 0, v: 0, state: 'idle', timer: 2 + this.rand() * 3, waitingZone: null, waitReason: null, stuckSince: -1, attached: false, trailer: null, loaded: false });
    b.nextLoaded = !b.nextLoaded;
  }
  private release(b: Bot, zoneId: string) { this.zones.get(zoneId)?.occ.delete(b.id); b.holds.delete(zoneId); }
  /** Nobody is standing (parked, waiting, broken down) where the robot and its trolley will sweep while it passes through the entry, and the road beyond it has room for the whole robot. */
  private entryClear(b: Bot, e: Entry): boolean {
    const plan = b.plan!; const still = this.bots.filter((o) => o !== b && o.state !== 'offline' && o.v < 0.3); if (!still.length) return true;
    for (let q = Math.max(0, e.s - 0.5); q <= e.exitS + EXIT_SPACE; q += SAMPLE) {
      const qq = Math.min(q, plan.total); const c = [...robotCircles(this.poseAt(plan, qq)), ...(b.loaded ? trolleyCircles(this.poseAt(plan, qq - TD)) : [])];
      if (still.some((o) => hit(c, this.body(o)))) return false;
      if (qq >= plan.total) break;
    }
    return true;
  }
  /** Ask for every permit of the entry. All or nothing; the oldest trip wins when several robots want the same intersection. */
  private takeEntry(b: Bot, e: Entry): { ok: boolean; zone: string | null } {
    const nav = this.graph.nav; const holding = b.locks.size > 0 || b.holds.size > 0;      // a robot that already holds permits is never held back by the queue: it must be able to finish and give them back
    const older = (id: string) => !holding && this.bots.some((o) => o !== b && o.queued && o.prio < b.prio && (o.queued.zones.some((z) => z.id === id) || o.queued.xings.some((x) => x.id === id)));     // an older trip is queueing for it
    const cap = (id: string) => nav.trafficZones.find((z) => z.id === id)!.capacity;
    const zoneFull = (id: string) => this.zones.get(id)!.occ.size >= cap(id), xingTaken = (id: string, lanes?: string[]) => { const x = this.xing(id); if (x.occ.size === 0 || x.occ.has(b.id)) return false; return !(lanes?.length && [...x.occ].every((o) => { const held = x.lanes?.get(o); return !!held && lanes.every((l) => held.has(l)); })); };      // taken, unless every holder uses the lanes this robot uses (they just follow each other)
    const blockedZone = e.zones.find((z) => zoneFull(z.id) || older(z.id))?.id ?? null;
    const logical = !blockedZone && e.xings.every((x) => !xingTaken(x.id, x.lanes) && !older(x.id));
    if (logical && this.time - b.gateAt > 0.5) { b.gateOk = this.entryClear(b, e); b.gateAt = this.time; }      // (the physical check runs twice a second at most)
    const ok = logical && b.gateOk;
    // Waiting robots queue up (oldest first) only for permits that are really taken; a robot held up by a parked robot or a full road does not block the others meanwhile.
    const held = e.zones.some((z) => zoneFull(z.id)) || e.xings.some((x) => xingTaken(x.id, x.lanes));
    b.queued = !ok && held ? e : null;
    if (ok) {
      const clear = b.attached ? TD + 0.7 : 0.7;
      for (const z of e.zones) { this.zones.get(z.id)!.occ.add(b.id); b.holds.set(z.id, z.exitS + clear); }
      for (const x of e.xings) { const p = this.xing(x.id); p.occ.add(b.id); (p.lanes ??= new Map()).set(b.id, new Set(x.lanes)); b.locks.set(x.id, x.exitS + clear); }
      b.gateAt = -9;
    }
    return { ok, zone: blockedZone };
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
  private freeLength(b: Bot, claims: Map<string, Circle[]>): { len: number; claim: Circle[] } {
    const mine = this.corridor(b, CLAIM); const claim: Circle[] = []; let len = 0;
    for (const m of mine) { if (this.touches(b, m.c, claims)) return { len, claim }; len = m.d; claim.push(...m.c); }
    return { len: Infinity, claim };
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
    if (b.s < 0.02) {                                             // leaving a station: turn on the spot towards the route, hitching the trolley behind when there is room for it
      const h = this.headingAt(plan, 0), d = angleDiff(b.theta, h);
      const turn = Math.abs(d) > 0.04;
      const th = turn ? b.theta + Math.max(-2 * dt, Math.min(2 * dt, d)) : b.theta;
      if (this.touches(b, robotCircles({ ...b.pos, th }), claims)) { b.state = 'waiting'; b.waitReason = 'headway'; b.v = 0; return; }
      if (turn) { b.theta = th; b.state = 'moving'; b.v = 0; return; }
      if (b.loaded && !b.attached && !this.touches(b, trolleyCircles(this.poseAt(plan, b.s - TD)), claims)) { b.attached = true; b.trailer = this.poseAt(plan, b.s - TD); }
    }
    if (b.loaded && !b.attached && b.s >= TD) { b.attached = true; b.trailer = this.poseAt(plan, b.s - TD); }     // no room behind at the station: the trolley is hitched as soon as the robot has pulled clear
    let limit = plan.total; let gate = false; let zoneWait: string | null = null; const e = b.entries[b.entryIdx];
    b.queued = null;                                              // (set again below when the robot is queueing at a hold point)
    if (e) {
      const hold = e.hold;
      if (b.s >= hold - 1e-3) { const r = this.takeEntry(b, e); if (r.ok) b.entryIdx++; else { gate = true; zoneWait = r.zone; limit = Math.min(limit, hold); } }
      else limit = Math.min(limit, hold);
    }
    // Still at its station and unable to leave (something stands in its way, or it keeps losing the permit): give the trip up and ask the dispatcher for another one instead of waiting for ever.
    if (gate && b.s < 0.5) { if (b.stuckSince < 0) b.stuckSince = this.time; if (this.time - b.stuckSince > 8) { this.cancelTrip(b); return; } } else b.stuckSince = -1;
    // Held up for a long time by something standing in the way (not by a traffic rule): take another road ahead, never back.
    if (b.s >= 0.5 && b.v < 0.05 && !(zoneWait) && (gate || b.waitReason === 'headway')) { if (b.stoppedSince < 0) b.stoppedSince = this.time; if (this.time - b.stoppedSince > REROUTE_AFTER && this.time - b.rerouteAt > 20) { b.rerouteAt = this.time; if (this.reroute(b)) return; } } else if (b.v > 0.1) b.stoppedSince = -1;
    const free = gate ? { len: 0, claim: [] as Circle[] } : this.freeLength(b, claims);
    const blocked = free.len < CLAIM - 1e-6; b.waitingZone = zoneWait; b.waitReason = zoneWait ? 'traffic' : gate ? 'intersection' : blocked ? 'headway' : null;
    // The robot in the way is itself waiting for permits this robot holds (it stands at its station right on this road): hand them over so it can leave.
    if (blocked && b.locks.size && b.v < 0.05) { const by = this.touches(b, this.corridor(b, SAMPLE)[0]?.c ?? [], claims); const e2 = by && by.plan && by.s < 0.5 ? by.entries[by.entryIdx] : null;
      if (e2 && this.time - b.stoppedSince > 3 && b.stoppedSince >= 0) for (const x of e2.xings) if (b.locks.has(x.id)) this.dropLock(b, x.id); }
    const curve = Math.min(1, Math.abs(angleDiff(this.headingAt(plan, b.s), this.headingAt(plan, Math.min(plan.total, b.s + 1)))));   // slow down in bends
    if (blocked) limit = Math.min(limit, b.s + free.len);
    const room = Math.max(0, limit - b.s);
    const lag = Math.abs(angleDiff(b.theta, this.headingAt(plan, Math.min(plan.total, b.s + 0.3))));
    let vt = V * (1 - 0.5 * curve) * Math.max(0.15, 1 - lag / 0.7); vt = Math.min(vt, Math.sqrt(2 * DEC * room));
    b.v = vt > b.v ? Math.min(vt, b.v + ACC * dt) : Math.max(vt, b.v - DEC * dt);
    const ds = Math.min(b.v * dt, room); b.s += ds;
    const p = this.poseAt(plan, b.s); b.pos = { x: p.x, y: p.y }; { const d = angleDiff(b.theta, this.headingAt(plan, b.s)); b.theta += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, d)); } b.lane = pointAt(plan, b.s).lane;
    b.trailer = this.trailerPose(b); b.speed = ds / dt;
    const held = gate || blocked;
    b.state = held && ds / dt < 0.3 ? 'waiting' : 'moving'; if (b.state === 'waiting' && b.v < 0.03) b.v = 0;
    for (const [zid, exitS] of [...b.holds]) if (b.s > exitS) this.release(b, zid);          // left the zone (trolley included): let the next robot in
    for (const [id, exitS] of [...b.locks]) if (b.s > exitS) this.dropLock(b, id);          // left the intersection: the next robot may enter
    b.battery = Math.max(0, b.battery - dt * 0.05); if (b.task) b.task.progress = Math.min(1, b.s / Math.max(plan.total, 1));
    if (b.s >= plan.total - 1e-3) {
      b.queued = null; for (const zid of [...b.holds.keys()]) this.release(b, zid);
      const st = this.graph.station(b.dest!)!; b.node = st.nodeId; b.stationId = st.id; b.dest = null; b.plan = null; b.speed = 0; b.v = 0; b.waitingZone = null; b.waitReason = null;
      for (const id of [...b.locks.keys()]) this.dropLock(b, id);          // a parked robot holds no permit: others wait because its body is in the way, and it asks again when it leaves
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
      else if (b.waitReason === 'intersection' && b.state === 'waiting') alerts.push({ code: 'INTERSECTION_WAIT', severity: 'info', msg: 'Waiting for the intersection to clear' });
      return { id: b.id, model: b.model, fleetId: b.fleetId, siteId: this.siteId, pose: { x: b.pos.x, y: b.pos.y, theta: b.theta }, speed: b.speed, state: b.state, battery: Math.round(b.battery),
        payload: b.payload, trailer: b.trailer ? { x: b.trailer.x, y: b.trailer.y, theta: b.trailer.th } : null, task: b.task, path: moving ? [b.pos, ...b.plan!.pts.filter((_, i) => b.plan!.cum[i] > b.s)] : [], laneId: b.lane, traffic, waitReason: b.waitReason,
        atStation: b.stationId && (b.state === 'working' || b.state === 'charging' || b.state === 'idle') ? b.stationId : null, alerts, ts };
    });
  }
}
