import type { FleetEvent, NavGraph, OrderUpdate, RobotTelemetry, TelemetryAdapter, TransportOrder } from '../core/types';
import { tripIds } from '../core/tripIds';
import { FleetSim, type RosterEntry } from './sim';

/** Default adapter until a live feed exists: drives FleetSim in real time (with rare faults switched on, so reliability figures have something to show). */
export class MockSimulator implements TelemetryAdapter {
  readonly sim: FleetSim; private cb: (b: RobotTelemetry[]) => void = () => {}; private ev: (e: FleetEvent) => void = () => {}; private ou: (u: OrderUpdate) => void = () => {}; private timer: number | undefined; private last = 0;
  constructor(nav: NavGraph, siteId: string, count = 14, seed = 7, roster?: RosterEntry[]) { this.sim = new FleetSim(nav, siteId, count, seed, roster, { faults: true, tripIds }); }
  onTelemetry(cb: (b: RobotTelemetry[]) => void) { this.cb = cb; }
  onEvent(cb: (e: FleetEvent) => void) { this.ev = cb; }
  onOrderUpdate(cb: (u: OrderUpdate) => void) { this.ou = cb; }
  submitOrder(o: TransportOrder) { const ok = this.sim.submitOrder(o); if (!ok) this.sim.drainOrderUpdates().forEach(this.ou); return ok; }
  cancelOrder(id: string) { return this.sim.cancelOrder(id); }
  connect() { this.last = performance.now(); this.timer = window.setInterval(() => { const n = performance.now(); this.sim.step(Math.min((n - this.last) / 1000, 0.25)); this.last = n; this.sim.drainEvents().forEach(this.ev); this.sim.drainOrderUpdates().forEach(this.ou); this.cb(this.sim.snapshot()); }, 100); }
  disconnect() { window.clearInterval(this.timer); }
}
