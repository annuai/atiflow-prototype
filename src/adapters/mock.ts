import type { NavGraph, RobotTelemetry, TelemetryAdapter } from '../core/types';
import { FleetSim, type RosterEntry } from './sim';

/** Default adapter until a live feed exists: drives FleetSim in real time. */
export class MockSimulator implements TelemetryAdapter {
  readonly sim: FleetSim; private cb: (b: RobotTelemetry[]) => void = () => {}; private timer: number | undefined; private last = 0;
  constructor(nav: NavGraph, siteId: string, count = 14, seed = 7, roster?: RosterEntry[]) { this.sim = new FleetSim(nav, siteId, count, seed, roster); }
  onTelemetry(cb: (b: RobotTelemetry[]) => void) { this.cb = cb; }
  connect() { this.last = performance.now(); this.timer = window.setInterval(() => { const n = performance.now(); this.sim.step(Math.min((n - this.last) / 1000, 0.25)); this.last = n; this.cb(this.sim.snapshot()); }, 100); }
  disconnect() { window.clearInterval(this.timer); }
}
