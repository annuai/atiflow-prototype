import type { FleetEvent, NavGraph, RobotTelemetry, TelemetryAdapter } from '../core/types';
import { FleetSim, type RosterEntry } from './sim';

/** Default adapter until a live feed exists: drives FleetSim in real time (with rare faults switched on, so reliability figures have something to show). */
export class MockSimulator implements TelemetryAdapter {
  readonly sim: FleetSim; private cb: (b: RobotTelemetry[]) => void = () => {}; private ev: (e: FleetEvent) => void = () => {}; private timer: number | undefined; private last = 0;
  constructor(nav: NavGraph, siteId: string, count = 14, seed = 7, roster?: RosterEntry[]) { this.sim = new FleetSim(nav, siteId, count, seed, roster, { faults: true }); }
  onTelemetry(cb: (b: RobotTelemetry[]) => void) { this.cb = cb; }
  onEvent(cb: (e: FleetEvent) => void) { this.ev = cb; }
  connect() { this.last = performance.now(); this.timer = window.setInterval(() => { const n = performance.now(); this.sim.step(Math.min((n - this.last) / 1000, 0.25)); this.last = n; this.sim.drainEvents().forEach(this.ev); this.cb(this.sim.snapshot()); }, 100); }
  disconnect() { window.clearInterval(this.timer); }
}
