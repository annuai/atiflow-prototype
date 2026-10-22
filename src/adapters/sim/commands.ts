import type { ChargeResult, StopResult, OrderUpdate, RelocalizeResult, TransportOrder, Vec2 } from '../../core/types';
import type { World } from './world';

/** What the outside world can ask of the fleet: send a robot to a charger, relocalize it, hand it an order (and the test / demo aids that move or displace a robot). */
export class Commands {
  constructor(private readonly w: World) {}
  /** "Send to charger": a trip that has started is never re-planned, so a robot on a work trip is refused; one on an empty return or parking trip goes when it ends; an idle one goes now. */
  sendToCharger(id: string): ChargeResult {
    const b = this.w.bots.find((x) => x.id === id);
    if (!b) return { ok: false, reason: 'not-found' };
    if (b.state === 'offline') return { ok: false, reason: 'offline' };
    if (b.state === 'error' || this.w.time < b.faultUntil) return { ok: false, reason: 'error' };
    if (b.state === 'charging' || b.trip?.kind === 'charge') return { ok: false, reason: 'already-charging' };
    if (b.trip?.kind === 'transport') return { ok: false, reason: 'work-trip', tripId: b.trip.id };
    if (!this.w.graph.nav.stations.some((q) => q.type === 'charge' && q.fleets.includes(b.fleetId)))
      return { ok: false, reason: 'no-charger' };
    b.chargeRequested = true;
    if (!b.trip && (b.state === 'idle' || b.state === 'working')) {
      b.timer = 0; // parked: plan the charge trip on the next step
      return { ok: true, when: 'now' };
    }
    return { ok: true, when: 'after-trip' };
  }
  /** "Relocalize": the robot finds its place on the map again. Only a robot that stands still can do it (a driving one is refused). */
  relocalize(id: string): RelocalizeResult {
    const b = this.w.bots.find((x) => x.id === id);
    if (!b) return { ok: false, reason: 'not-found' };
    if (b.state === 'offline') return { ok: false, reason: 'offline' };
    if (b.speed > 0.05) return { ok: false, reason: 'moving' };
    b.lostBy = null;
    return { ok: true };
  }
  /** "Emergency stop": the robot stops where it is and stays there until `release` (a robot already stopped is refused). */
  emergencyStop(id: string): StopResult {
    const b = this.w.bots.find((x) => x.id === id);
    if (!b) return { ok: false, reason: 'not-found' };
    if (b.state === 'offline') return { ok: false, reason: 'offline' };
    if (b.estop) return { ok: false, reason: 'already-stopped' };
    b.estop = true;
    return { ok: true, count: 1 };
  }
  /** Let a stopped robot carry on. */
  release(id: string): StopResult {
    const b = this.w.bots.find((x) => x.id === id);
    if (!b) return { ok: false, reason: 'not-found' };
    if (!b.estop) return { ok: false, reason: 'not-stopped' };
    b.estop = false;
    return { ok: true, count: 1 };
  }
  /** Stop every robot of a fleet that is not stopped already (`stop`), or let them all carry on. */
  stopFleet(fleetId: string, stop: boolean): StopResult {
    const bots = this.w.bots.filter((b) => b.fleetId === fleetId && b.state !== 'offline' && b.estop !== stop);
    if (!bots.length) return { ok: false, reason: stop ? 'already-stopped' : 'not-stopped' };
    bots.forEach((b) => (b.estop = stop));
    return { ok: true, count: bots.length };
  }
  /** Test and demo aid: make a robot report a position `by` metres away from where it is (as if someone had moved it and it has not found its place yet). */
  displace(id: string, by: Vec2): boolean {
    const b = this.w.bots.find((x) => x.id === id);
    if (!b) return false;
    b.lostBy = by;
    return true;
  }
  /** Test and demo aid: someone picks the robot up and puts it `by` metres away (it reports its new position). Only a robot that stands still can be moved. */
  moveByHand(id: string, by: Vec2): boolean {
    const b = this.w.bots.find((x) => x.id === id);
    if (!b || b.speed > 0.05 || b.plan) return false;
    b.pos = { x: b.pos.x + by.x, y: b.pos.y + by.y };
    return true;
  }
  drainOrderUpdates(): OrderUpdate[] {
    const u = this.w.orderUpdates;
    this.w.orderUpdates = [];
    return u;
  }
  /** Accept an order: false (and a `failed` update) when the fleet has no robot here or a station is not on the map. */
  submitOrder(o: TransportOrder): boolean {
    const known = o.legs.length > 0 && o.legs.every((id) => this.w.graph.station(id)?.fleets.includes(o.fleetId));
    const robots = this.w.bots.filter((b) => b.fleetId === o.fleetId && (!o.robotModel || b.model === o.robotModel));
    if (!known || !robots.length) {
      this.w.orderUpdates.push({
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
    if (!this.w.orders.some((q) => q.id === o.id)) this.w.orders.push(o);
    return true;
  }
  /** Take the order back while no robot is on its way with it. */
  cancelOrder(id: string): boolean {
    const n = this.w.orders.length;
    this.w.orders = this.w.orders.filter((o) => o.id !== id);
    return this.w.orders.length < n;
  }
}
