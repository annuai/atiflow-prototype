import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MeasurementLog, timeKind } from '../src/core/measurements';
import { FleetSim } from '../src/adapters/sim';
import type { FleetEvent, NavGraph, RobotTelemetry, SiteLayout } from '../src/core/types';

const T0 = Date.UTC(2026, 9, 13, 8, 0, 0);
const bot = (id: string, over: Partial<RobotTelemetry>, ts: number): RobotTelemetry => ({ id, model: 'sherpa-xt-lite', fleetId: 'f', siteId: 's', pose: { x: 0, y: 0, theta: 0 }, speed: 0, state: 'idle', battery: 80, ts, ...over });
const work = { id: 'TRP-001', type: 'transport', progress: 0.5 };

describe('timeKind: what a robot is doing for the utilisation / idle KPIs', () => {
  it('work trips are exec (even held up in traffic), nothing assigned is idle, charge / park trips are other, charging / error / offline are themselves', () => {
    expect(timeKind(bot('a', { state: 'moving', task: work }, 0))).toBe('exec'); expect(timeKind(bot('a', { state: 'waiting', task: work }, 0))).toBe('exec');
    expect(timeKind(bot('a', { state: 'working', task: { ...work, progress: 1 } }, 0))).toBe('idle'); expect(timeKind(bot('a', { state: 'idle' }, 0))).toBe('idle');
    expect(timeKind(bot('a', { state: 'moving', task: { id: 'x', type: 'charge', progress: 0.2 } }, 0))).toBe('other');
    expect(timeKind(bot('a', { state: 'charging' }, 0))).toBe('charging'); expect(timeKind(bot('a', { state: 'error' }, 0))).toBe('error'); expect(timeKind(bot('a', { state: 'offline' }, 0))).toBe('offline');
  });
});

describe('MeasurementLog', () => {
  it('adds up time per kind, odometer / energy differences, trips with cycle time and SLA, faults and deadlocks', () => {
    const log = new MeasurementLog();
    for (let i = 0; i <= 10; i++) log.ingest([bot('a', { state: 'moving', task: work, odometer: { empty: i, loaded: 2 * i }, energyKWh: i * 0.01 }, T0 + i * 1000), bot('b', { state: 'idle' }, T0 + i * 1000)]);
    const ev: FleetEvent[] = [
      { type: 'trip-completed', ts: T0 + 9000, robotId: 'a', fleetId: 'f', tripId: 'T1', kind: 'transport', assignedAt: T0 - 51_000, startedAt: T0 - 40_000, deadlineAt: T0 + 10_000 },     // 60 s cycle, in time
      { type: 'trip-completed', ts: T0 + 9500, robotId: 'a', fleetId: 'f', tripId: 'T2', kind: 'return', assignedAt: T0, startedAt: T0, deadlineAt: T0 + 5000 },                             // late
      { type: 'trip-completed', ts: T0 + 9600, robotId: 'b', fleetId: 'f', tripId: 'T3', kind: 'charge', assignedAt: T0, startedAt: T0, deadlineAt: null },                                  // charging trips are no work
      { type: 'fault', ts: T0 + 9700, robotId: 'a', fleetId: 'f', code: 'X', needsIntervention: true }, { type: 'deadlock', ts: T0 + 9800, robotIds: ['a', 'b'], fleetIds: ['f'], waitedS: 20 },
    ]; ev.forEach((e) => log.event(e));
    const m = log.query(T0, T0 + 20_000); const a = m.robots.find((r) => r.robotId === 'a')!, b = m.robots.find((r) => r.robotId === 'b')!;
    expect(a.seconds.exec).toBeCloseTo(10, 5); expect(b.seconds.idle).toBeCloseTo(10, 5); expect(m.observedS).toBeCloseTo(10, 5);
    expect(a.emptyM).toBeCloseTo(10, 5); expect(a.loadedM).toBeCloseTo(20, 5); expect(a.kWh).toBeCloseTo(0.1, 5);
    expect(a.trips).toBe(2); expect(a.cycleS).toBeCloseTo(60 + 9.5, 5); expect(a.slaTotal).toBe(2); expect(a.slaMet).toBe(1); expect(b.trips).toBe(0); expect(a.faults).toBe(1); expect(m.deadlocks).toBe(1);
    expect(m.hourly).toHaveLength(1); expect(m.hourly[0].trips).toBe(2);
  });
  it('availability is sampled once a minute: met when at least 85% of the robots are not charging, faulted or offline', () => {
    const log = new MeasurementLog(); const fleet = (charging: number, ts: number) => Array.from({ length: 10 }, (_, i) => bot('r' + i, { state: i < charging ? 'charging' : 'idle' }, ts));
    log.ingest(fleet(1, T0)); log.ingest(fleet(2, T0 + 61_000)); log.ingest(fleet(0, T0 + 122_000));       // 90% ok, 80% not ok, 100% ok
    const m = log.query(T0, T0 + 200_000); expect(m.availTotal).toBe(3); expect(m.availMet).toBe(2);
  });
  it('a period is the sum of the hours inside it; a counter that goes back (robot restarted) does not count backwards', () => {
    const log = new MeasurementLog(); log.ingest([bot('a', { odometer: { empty: 100, loaded: 0 } }, T0)]); log.ingest([bot('a', { odometer: { empty: 5, loaded: 0 } }, T0 + 1000)]); log.ingest([bot('a', { odometer: { empty: 9, loaded: 0 } }, T0 + 2000)]);
    expect(log.query(T0, T0 + 5000).robots[0].emptyM).toBeCloseTo(4, 5);
    log.event({ type: 'deadlock', ts: T0 + 2 * 3_600_000, robotIds: ['a'], fleetIds: ['f'], waitedS: 20 }); expect(log.query(T0, T0 + 4 * 3_600_000).hourly).toHaveLength(2); expect(log.query(T0, T0 + 3_600_000 - 1).deadlocks).toBe(0);
  });
});

describe('fed by the simulator', () => {
  it('15 simulated minutes give believable KPIs: busy share, some SLA misses allowed, empty and loaded distance, energy', () => {
    const site = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8')) as SiteLayout, nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
    const sim = new FleetSim(nav, site.siteId, 14, 7); const log = new MeasurementLog(); const start = Date.now();
    for (let t = 0; t < 900; t += 0.1) { sim.step(0.1); sim.drainEvents().forEach((e) => log.event({ ...e, ts: start + t * 1000 })); const s = sim.snapshot().map((r) => ({ ...r, ts: start + t * 1000 })); log.ingest(s); }
    const m = log.query(start - 1, start + 10_000_000); const sum = (f: (r: (typeof m.robots)[number]) => number) => m.robots.reduce((a, r) => a + f(r), 0);
    const exec = sum((r) => r.seconds.exec), total = sum((r) => r.seconds.total); expect(exec / total).toBeGreaterThan(0.3); expect(exec / total).toBeLessThan(0.99);
    expect(sum((r) => r.trips)).toBeGreaterThan(10); expect(sum((r) => r.emptyM)).toBeGreaterThan(50); expect(sum((r) => r.loadedM)).toBeGreaterThan(50); expect(sum((r) => r.kWh)).toBeGreaterThan(0);
    const slaTotal = sum((r) => r.slaTotal); expect(slaTotal).toBeGreaterThan(5); expect(sum((r) => r.slaMet) / slaTotal).toBeGreaterThan(0.5);
  });
});
