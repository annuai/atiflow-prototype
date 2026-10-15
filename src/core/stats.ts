import type { RobotTelemetry } from './types';

/** What the dashboard shows about the fleet right now (pure: robots in, numbers out). */
export interface FleetSummary {
  total: number;
  active: number;
  activeTrips: number;
  attention: number;
  health: number;
  utilisation: number;
}
const BUSY = new Set(['moving', 'working']),
  IN_TRIP = new Set(['moving', 'waiting', 'blocked']);
export const needsAttention = (r: RobotTelemetry) =>
  r.state === 'blocked' || r.state === 'error' || r.battery < 25 || !!r.alerts?.some((a) => a.severity === 'critical');

export function summarise(robots: RobotTelemetry[]): FleetSummary {
  const total = robots.length;
  if (!total) return { total: 0, active: 0, activeTrips: 0, attention: 0, health: 100, utilisation: 0 };
  const attention = robots.filter(needsAttention).length;
  return {
    total,
    attention,
    active: robots.filter((r) => r.state !== 'offline' && r.state !== 'idle').length,
    activeTrips: robots.filter(
      (r) => r.task && r.task.type !== 'park' && (r.task.progress ?? 0) < 1 && IN_TRIP.has(r.state),
    ).length,
    health: Math.round((100 * (total - attention)) / total),
    utilisation: Math.round((100 * robots.filter((r) => BUSY.has(r.state)).length) / total),
  };
}

/** Running totals built from the telemetry stream: distance driven, time lost standing still, trips finished, and busy time per hour of the day. */
export class StatsTracker {
  distanceM = 0;
  downtimeS = 0;
  private done = new Set<string>();
  private last = 0;
  private busyS = new Array<number>(24).fill(0);
  private totalS = new Array<number>(24).fill(0);
  get tripsDone() {
    return this.done.size;
  }
  ingest(batch: RobotTelemetry[], now = new Date()) {
    if (!batch.length) return;
    const ts = batch[0].ts;
    const dt = this.last ? Math.min(Math.max((ts - this.last) / 1000, 0), 2) : 0;
    this.last = ts;
    const hour = now.getHours();
    for (const r of batch) {
      this.distanceM += r.speed * dt;
      if (r.state === 'waiting' || r.state === 'blocked' || r.state === 'error' || r.state === 'offline')
        this.downtimeS += dt;
      this.totalS[hour] += dt;
      if (BUSY.has(r.state)) this.busyS[hour] += dt;
      if (r.task && (r.task.progress ?? 0) >= 1 && r.task.type !== 'charge' && r.task.type !== 'park')
        this.done.add(r.task.id);
    }
  }
  /** Share of robot time spent moving or working in this hour (null before anything was measured). */
  utilisationAt(hour: number): number | null {
    return this.totalS[hour] > 0 ? Math.round((100 * this.busyS[hour]) / this.totalS[hour]) : null;
  }
  reset() {
    this.distanceM = 0;
    this.downtimeS = 0;
    this.done.clear();
    this.last = 0;
    this.busyS.fill(0);
    this.totalS.fill(0);
  }
}
