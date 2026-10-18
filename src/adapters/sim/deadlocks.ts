import { CYCLE_AFTER } from './constants';
import type { Bot } from './types';
import type { World } from './world';
import type { Dispatch } from './dispatch';

/** Finds robots that wait for each other in a ring and breaks the ring without any robot backing up. */
export class Deadlocks {
  constructor(
    private readonly w: World,
    private readonly dispatch: Dispatch,
  ) {}
  /** Robots that wait for each other in a ring (A for B, B for C, C for A) will never move by themselves. Find such rings and break them without any robot backing up:
   *  a robot still at its station gives its trip up; otherwise a robot hands the intersections it holds over; otherwise one takes another road ahead. */
  breakDeadlocks() {
    const waiting = new Map(
      this.w.bots.filter((b) => b.waitSince >= 0 && this.w.time - b.waitSince > CYCLE_AFTER).map((b) => [b.id, b]),
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
      if (ring.some((b) => this.w.time - b.resolvedAt < 6)) continue;
      this.w.deadlocksFound++;
      const key = ring
          .map((b) => b.id)
          .sort()
          .join(),
        seen = this.w.ringSeen.get(key);
      this.w.ringSeen.set(key, this.w.time); // a ring that stays stuck is one deadlock, not one per second
      if (seen === undefined || this.w.time - seen > 60)
        this.w.events.push({
          type: 'deadlock',
          ts: this.w.at(this.w.time),
          robotIds: ring.map((b) => b.id),
          fleetIds: [...new Set(ring.map((b) => b.fleetId))],
          waitedS: Math.round(Math.max(...ring.map((b) => this.w.time - b.waitSince))),
        });
      // 1. a robot hands over the zones it holds (a recorded override: ZONE_HANDOVER)
      const holders = ring.filter((b) => b.locks.size > 0);
      if (holders.length) {
        const v = [...holders].sort((a, c) => c.ticket - a.ticket || c.prio - a.prio)[0];
        v.resolvedAt = this.w.time;
        for (const id of [...v.locks.keys()]) {
          v.handedOver = Math.max(v.handedOver, v.locks.get(id) ?? 0);
          this.w.dropLock(v, id);
        }
        continue;
      }
      // 2. robots that only block each other's reserved way ahead (two robots one behind the other on a lane): the younger one goes by the bodies alone for a few seconds
      if (ring.every((b) => b.waitReason === 'headway')) {
        const v = [...ring].sort((a, c) => c.ticket - a.ticket)[0];
        if (v.ignoreClaims < this.w.time - 20) {
          v.ignoreClaims = this.w.time + 8;
          v.resolvedAt = this.w.time;
          continue;
        }
      }
      // 3. a robot takes another road to the same destination, going forward from where it is (a trip is never given up or handed to anyone else)
      let done = false;
      for (const v of ring.filter((b) => b.plan && !b.holds.size).sort((a, c) => c.ticket - a.ticket))
        if (this.dispatch.reroute(v)) {
          v.resolvedAt = this.w.time;
          done = true;
          break;
        }
      if (done) continue;
      ring.forEach((b) => (b.resolvedAt = this.w.time));
    }
  }
}
