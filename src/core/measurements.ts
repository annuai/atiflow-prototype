import type { FleetEvent, RobotTelemetry } from './types';

/**
 * Turns the telemetry stream and the fleet events into KPI building blocks: how long each robot spent in each kind of state, trips and their times,
 * driven distance split empty / loaded, energy, faults, deadlocks and fleet availability. Time is kept in hourly buckets so any period is a sum of buckets
 * and a trend is the list of buckets. Pure (no DOM, no React); today it lives in memory for the session, a server-side log would produce the same `Measured`.
 */
export type TimeKind = 'exec' | 'idle' | 'charging' | 'error' | 'offline' | 'other';
const HOUR = 3_600_000,
  AVAILABLE_SHARE = 0.85,
  SAMPLE_EVERY_MS = 60_000;

/** What a robot is doing, for the utilisation / idle KPIs. exec = on a work trip (driving, held up in traffic, calling at a stop); idle = nothing assigned; other = on its way to charge or park. */
export function timeKind(r: RobotTelemetry): TimeKind {
  if (r.state === 'offline') return 'offline';
  if (r.state === 'error') return 'error';
  if (r.state === 'charging') return 'charging';
  const t = r.task,
    work = !!t && (t.type === 'transport' || t.type === 'return') && (t.progress ?? 0) < 1;
  if (work) return 'exec';
  if (t && (t.type === 'charge' || t.type === 'park') && (t.progress ?? 0) < 1) return 'other';
  return 'idle';
}

export interface RobotMeasure {
  robotId: string;
  fleetId: string;
  /** Seconds in each kind of state; `total` is their sum. */
  seconds: Record<TimeKind, number> & { total: number };
  /** Seconds stopped by an obstacle (a subset of `exec`). */ blockedS: number;
  trips: number;
  /** summed assignment -> completion time of the finished work trips (s) */ cycleS: number;
  slaMet: number;
  slaTotal: number;
  emptyM: number;
  loadedM: number;
  kWh: number;
  faults: number;
}
export interface HourPoint {
  t: number;
  observedS: number;
  trips: number;
  deadlocks: number;
  slaMet: number;
  slaTotal: number;
  availMet: number;
  availTotal: number;
  execS: number;
  onlineS: number;
}
export interface Measured {
  from: number;
  to: number;
  /** seconds with data (wall clock, not robot-seconds) */ observedS: number;
  robots: RobotMeasure[];
  deadlocks: number;
  availMet: number;
  availTotal: number;
  hourly: HourPoint[];
}

const blank = (robotId: string, fleetId: string): RobotMeasure => ({
  robotId,
  fleetId,
  seconds: { exec: 0, idle: 0, charging: 0, error: 0, offline: 0, other: 0, total: 0 },
  blockedS: 0,
  trips: 0,
  cycleS: 0,
  slaMet: 0,
  slaTotal: 0,
  emptyM: 0,
  loadedM: 0,
  kWh: 0,
  faults: 0,
});
interface Bucket {
  robots: Map<string, RobotMeasure>;
  observedS: number;
  deadlocks: number;
  availMet: number;
  availTotal: number;
}

export class MeasurementLog {
  private buckets = new Map<number, Bucket>();
  private last = 0;
  private lastSample = 0;
  private odo = new Map<string, { empty: number; loaded: number; kWh: number }>();
  private bucket(ts: number) {
    const k = Math.floor(ts / HOUR) * HOUR;
    let b = this.buckets.get(k);
    if (!b) {
      b = { robots: new Map(), observedS: 0, deadlocks: 0, availMet: 0, availTotal: 0 };
      this.buckets.set(k, b);
    }
    return b;
  }
  private robot(b: Bucket, id: string, fleetId: string) {
    let r = b.robots.get(id);
    if (!r) {
      r = blank(id, fleetId);
      b.robots.set(id, r);
    }
    return r;
  }

  ingest(batch: RobotTelemetry[]) {
    if (!batch.length) return;
    const ts = batch[0].ts;
    const dt = this.last ? Math.min(Math.max((ts - this.last) / 1000, 0), 2) : 0;
    this.last = ts;
    const b = this.bucket(ts);
    b.observedS += dt;
    for (const r of batch) {
      const m = this.robot(b, r.id, r.fleetId);
      const k = timeKind(r);
      m.seconds[k] += dt;
      m.seconds.total += dt;
      if (r.state === 'blocked') m.blockedS += dt;
      if (r.odometer) {
        const p = this.odo.get(r.id);
        if (p && r.odometer.empty >= p.empty && r.odometer.loaded >= p.loaded) {
          m.emptyM += r.odometer.empty - p.empty;
          m.loadedM += r.odometer.loaded - p.loaded;
        }
      }
      if (r.energyKWh !== undefined) {
        const p = this.odo.get(r.id);
        if (p && r.energyKWh >= p.kWh) m.kWh += r.energyKWh - p.kWh;
      }
      this.odo.set(r.id, { empty: r.odometer?.empty ?? 0, loaded: r.odometer?.loaded ?? 0, kWh: r.energyKWh ?? 0 });
    }
    if (ts - this.lastSample >= SAMPLE_EVERY_MS) {
      // every 60 s: is at least 85% of the fleet available (not charging, not faulted, not offline)?
      this.lastSample = ts;
      const ok = batch.filter((r) => r.state !== 'charging' && r.state !== 'error' && r.state !== 'offline').length;
      b.availTotal++;
      if (ok >= AVAILABLE_SHARE * batch.length) b.availMet++;
    }
  }
  event(e: FleetEvent) {
    const b = this.bucket(e.ts);
    if (e.type === 'deadlock') b.deadlocks++;
    else if (e.type === 'fault') {
      if (e.needsIntervention) this.robot(b, e.robotId, e.fleetId).faults++;
    } else if (e.type === 'trip-completed' && (e.kind === 'transport' || e.kind === 'return')) {
      const m = this.robot(b, e.robotId, e.fleetId);
      m.trips++;
      m.cycleS += (e.ts - e.assignedAt) / 1000;
      if (e.deadlineAt !== null) {
        m.slaTotal++;
        if (e.ts <= e.deadlineAt) m.slaMet++;
      }
    }
  }
  reset() {
    this.buckets.clear();
    this.odo.clear();
    this.last = 0;
    this.lastSample = 0;
  }

  /** Everything measured in [from, to] (epoch ms), summed per robot, with one point per hour. */
  query(from: number, to: number): Measured {
    const out: Measured = { from, to, observedS: 0, robots: [], deadlocks: 0, availMet: 0, availTotal: 0, hourly: [] };
    const per = new Map<string, RobotMeasure>();
    for (const [t, b] of [...this.buckets].sort((x, y) => x[0] - y[0])) {
      if (t + HOUR <= from || t > to) continue;
      out.observedS += b.observedS;
      out.deadlocks += b.deadlocks;
      out.availMet += b.availMet;
      out.availTotal += b.availTotal;
      const p: HourPoint = {
        t,
        observedS: b.observedS,
        trips: 0,
        deadlocks: b.deadlocks,
        slaMet: 0,
        slaTotal: 0,
        availMet: b.availMet,
        availTotal: b.availTotal,
        execS: 0,
        onlineS: 0,
      };
      for (const [id, m] of b.robots) {
        let a = per.get(id);
        if (!a) {
          a = blank(id, m.fleetId);
          per.set(id, a);
        }
        for (const key of Object.keys(m.seconds) as (keyof RobotMeasure['seconds'])[]) a.seconds[key] += m.seconds[key];
        a.blockedS += m.blockedS;
        a.trips += m.trips;
        a.cycleS += m.cycleS;
        a.slaMet += m.slaMet;
        a.slaTotal += m.slaTotal;
        a.emptyM += m.emptyM;
        a.loadedM += m.loadedM;
        a.kWh += m.kWh;
        a.faults += m.faults;
        p.trips += m.trips;
        p.slaMet += m.slaMet;
        p.slaTotal += m.slaTotal;
        p.execS += m.seconds.exec;
        p.onlineS += m.seconds.total - m.seconds.offline;
      }
      out.hourly.push(p);
    }
    out.robots = [...per.values()].sort((x, y) => x.robotId.localeCompare(y.robotId));
    return out;
  }
}
