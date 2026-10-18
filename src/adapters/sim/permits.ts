import { pointAt, type PathPlan } from '../../core/lanes';
import { gateDepthAt } from '../../core/gate';
import { pointInPoly } from '../../core/geom';
import { EXIT_SPACE, GROUP_GAP, HOLD, SAMPLE, TD } from './constants';
import { hit, robotCircles, trolleyCircles } from './footprint';
import { poseAt } from './path';
import type { Bot, Entry } from './types';
import type { World } from './world';
import type { Traffic } from './traffic';

/** Permits for traffic zones: who may enter a zone or Line gate, the hold points before them, first come first served. */
export class Permits {
  constructor(
    private readonly w: World,
    private readonly traffic: Traffic,
  ) {}
  /** The traffic zones (drawn at every junction) that contain the point. */
  zoneIdsAt(x: number, y: number): string[] {
    return this.w.graph.nav.trafficZones.filter((z) => pointInPoly(x, y, z.polygon)).map((z) => z.id);
  }
  private inAnyZone(x: number, y: number): boolean {
    return this.w.graph.nav.trafficZones.some((z) => pointInPoly(x, y, z.polygon));
  }
  /** Every traffic zone a route passes through, grouped: zones closer than GROUP_GAP along the route are requested together. */
  entriesOf(plan: PathPlan): Entry[] {
    const spans: { zone: boolean; id: string; s: number; exitS: number; d0?: number; d1?: number }[] = [];
    const gates = new Map(this.w.graph.nav.trafficZones.filter((z) => z.gate).map((z) => [z.id, z.gate!]));
    const total = plan.total;
    for (let s = 0; s <= total + 0.1; s += 0.2) {
      // traffic zones (one at every junction): stretches of the path inside a zone
      const p = pointAt(plan, Math.min(s, total));
      for (const id of this.zoneIdsAt(p.x, p.y)) {
        const g = gates.get(id);
        const d = g ? gateDepthAt(g, p.x, p.y) : undefined;
        const prev = spans.filter((x) => !x.zone && x.id === id).pop();
        if (prev && s - prev.exitS < 3) {
          prev.exitS = s;
          prev.d1 = d;
        } else spans.push({ zone: false, id, s, exitS: s, d0: d, d1: d });
      }
    }
    // a Line gate only holds the robots that come from its controlled side (they move towards its line); the others cross freely
    for (let i = spans.length - 1; i >= 0; i--) {
      const sp = spans[i];
      if (gates.has(sp.id) && !((sp.d1 ?? 0) < (sp.d0 ?? 0) - 0.2)) spans.splice(i, 1);
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
    this.placeHolds(plan, out);
    return out;
  }
  /** Robots standing inside the zone at the start of their trip and asking for this very zone go first (for a robot outside): they cannot wait outside, and a robot that came in after them would block their way out. */
  private leavingFirst(b: Bot, zoneId: string): string[] {
    const poly = this.w.graph.nav.trafficZones.find((z) => z.id === zoneId)?.polygon;
    if (!poly || pointInPoly(b.pos.x, b.pos.y, poly)) return [];
    return this.w.bots
      .filter(
        (o) =>
          o !== b &&
          o.plan &&
          o.s < 0.5 &&
          !o.locks.has(zoneId) &&
          o.entries[o.entryIdx]?.xings.some((q) => q.id === zoneId) &&
          pointInPoly(o.pos.x, o.pos.y, poly),
      )
      .map((o) => o.id);
  }
  /** Where each group of zones waits: at the usual distance before its first zone, on road outside every zone, with the robot AND its trolley clear of them (a robot waiting inside a zone it holds, or in
   *  another one, would be in the way of the robots that need it). When a zone follows another so closely that there is no such place between them, the two are taken together. */
  private placeHolds(plan: PathPlan, out: Entry[]) {
    const free = (x: number) =>
      [0, 1.4, 2.2].every((back) => {
        const p = pointAt(plan, Math.max(0, x - back));
        return !this.inAnyZone(p.x, p.y);
      });
    for (let i = 0; i < out.length; i++) {
      const e = out[i];
      const floor = i ? out[i - 1].exitS + 0.5 : 0;
      let h = Math.max(0, e.s - HOLD);
      while (h > floor && !free(h)) h -= 0.3;
      if (i > 0 && !free(h)) {
        const prev = out[i - 1];
        prev.exitS = Math.max(prev.exitS, e.exitS);
        for (const x of e.xings) {
          const have = prev.xings.find((q) => q.id === x.id);
          if (have) {
            have.exitS = Math.max(have.exitS, x.exitS);
            have.lanes = [...new Set([...(have.lanes ?? []), ...(x.lanes ?? [])])];
          } else prev.xings.push(x);
        }
        out.splice(i, 1);
        i--;
        continue;
      }
      e.hold = i === 0 && !free(h) ? Math.max(0, e.s - HOLD) : Math.max(0, h);
    }
  }
  /** Nobody is standing (parked, waiting, broken down) where the robot and its trolley will sweep while it passes through the entry, and the road beyond it has room for the whole robot. */
  private entryClear(b: Bot, e: Entry): Bot | null {
    const plan = b.plan!;
    const still = this.w.bots.filter((o) => o !== b && o.state !== 'offline' && o.v < 0.3);
    if (!still.length) return null;
    for (let q = Math.max(b.s + SAMPLE, e.s - 0.5); q <= e.exitS + EXIT_SPACE; q += SAMPLE) {
      // ahead of where the robot stands, never backwards or on the spot: the circle chains are longer than the real body, so a robot right behind it overlaps its footprint now but is left behind as it moves
      const qq = Math.min(q, plan.total);
      const c = [
        ...robotCircles(poseAt(plan, qq)),
        ...(b.loaded && qq - TD >= b.s - 0.2 ? trolleyCircles(poseAt(plan, qq - TD)) : []),
      ]; // (the stretch behind the robot, where its trolley hangs now, is not swept: a robot waiting right behind it would block it while it waits for the leader)
      const o = still.find((r) => hit(c, this.traffic.body(r)));
      if (o) return o;
      if (qq >= plan.total) break;
    }
    return null;
  }
  /** Does `from` wait for `id`, directly or through a chain of other waiting robots? */
  private waitsFor(from: Bot, id: string, depth = 6): boolean {
    return from.waitsOn.some((w) => w === id || (depth > 0 && this.waitsFor(this.w.byId(w), id, depth - 1)));
  }
  /** Ask for every permit of the entry, first come first served (Ati's VISA rule): a robot holds outside, the first to arrive goes first, the others wait until it has cleared. All or nothing.
   *  Two robots may be in an intersection together when their lanes never come close (or they are on the same lane, one behind the other). */
  takeEntry(b: Bot, e: Entry): { ok: boolean; zone: string | null } {
    const holding = b.locks.size > 0 || b.holds.size > 0; // a robot that already holds permits is never held back by the queue: it must be able to finish and give them back
    if (b.ticketFor !== e) {
      b.ticketFor = e;
      b.ticket = this.w.time;
    }
    const waits = new Set<string>();
    // A traffic zone holds ONE robot at a time: the next waits at its hold point until the one inside has left (first come, first served).
    const takenBy = (id: string) => [...this.w.xing(id).occ].filter((o) => o !== b.id);
    /** Robots ahead of this one in the queue for the zone (first come first served), except those that are themselves held up by this very robot: letting them go first would never end. */
    const earlier = (id: string) =>
      holding
        ? []
        : this.w.bots.filter(
            (o) =>
              o !== b &&
              o.queued &&
              !this.waitsFor(o, b.id) &&
              o.ticket < b.ticket &&
              o.queued.xings.some((x) => x.id === id),
          );
    let logical = true;
    let blockedX: string | null = null;
    for (const x of e.xings) {
      const held = takenBy(x.id),
        q = earlier(x.id);
      const gate = this.w.graph.nav.trafficZones.find((z) => z.id === x.id && z.gate);
      // a Line gate waits until its whole area is clear: a robot driving through it the free way counts too
      if (gate)
        for (const o of this.w.bots)
          if (o !== b && o.state !== 'offline' && !held.includes(o.id) && pointInPoly(o.pos.x, o.pos.y, gate.polygon))
            held.push(o.id);
      held.push(...this.leavingFirst(b, x.id));
      if (held.length || q.length) {
        logical = false;
        blockedX ??= x.id;
        held.forEach((o) => waits.add(o));
        q.forEach((o) => waits.add(o.id));
      }
    }
    if (logical && this.w.time - b.gateAt > 0.5) {
      const o = this.entryClear(b, e);
      b.gateOk = !o;
      b.gateBlock = o?.id ?? null;
      b.gateAt = this.w.time;
    } // (the physical check runs twice a second at most)
    const ok = logical && b.gateOk;
    if (logical && !b.gateOk && b.gateBlock) waits.add(b.gateBlock);
    const held = waits.size > 0 && !logical;
    b.queued = !ok && held ? e : null;
    b.waitsOn = ok ? [] : [...waits];
    if (ok) {
      const clear = b.attached ? TD + 0.7 : 0.7;
      for (const x of e.xings) {
        const p = this.w.xing(x.id);
        p.occ.add(b.id);
        (p.lanes ??= new Map()).set(b.id, new Set(x.lanes));
        b.locks.set(x.id, x.exitS + clear);
      }
      b.gateAt = -9;
      b.ticketFor = null;
    }
    return { ok, zone: blockedX };
  }
}
