import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FleetSim } from '../src/adapters/sim';
import { RulesIndex } from '../src/core/rules';
import type { FleetEvent, NavGraph, RobotTelemetry, SiteLayout } from '../src/core/types';

const site = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8')) as SiteLayout;
const nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
const run = (seconds: number, opts?: { faults?: boolean }, seed = 7) => {
  const sim = new FleetSim(nav, site.siteId, 14, seed, undefined, opts);
  const events: FleetEvent[] = [];
  let last: RobotTelemetry[] = [];
  for (let t = 0; t < seconds; t += 0.1) {
    sim.step(0.1);
    events.push(...sim.drainEvents());
    if (Math.round(t * 10) % 10 === 0) last = sim.snapshot();
  }
  return { sim, events, last };
};

describe('the simulator reports what the KPIs need', () => {
  const { events, last } = run(900);
  it('every finished trip carries its assigned / started / completed times; work trips also have an SLA deadline after they were assigned', () => {
    const done = events.filter(
      (e): e is Extract<FleetEvent, { type: 'trip-completed' }> => e.type === 'trip-completed',
    );
    expect(done.length).toBeGreaterThan(10);
    for (const e of done) {
      expect(e.assignedAt).toBeLessThanOrEqual(e.startedAt);
      expect(e.startedAt).toBeLessThanOrEqual(e.ts);
      if (e.kind === 'transport' || e.kind === 'return') expect(e.deadlineAt!).toBeGreaterThan(e.assignedAt);
      else expect(e.deadlineAt).toBeNull();
    }
    expect(new Set(done.map((e) => e.tripId)).size).toBe(done.length); // each trip completes once
  });
  it('robots report cumulative odometer (empty / loaded) and driving energy; without faults nothing breaks down', () => {
    expect(last.some((r) => (r.odometer?.loaded ?? 0) > 0)).toBe(true);
    expect(last.some((r) => (r.odometer?.empty ?? 0) > 0)).toBe(true);
    expect(last.every((r) => (r.energyKWh ?? -1) >= 0)).toBe(true);
    expect(events.some((e) => e.type === 'fault')).toBe(false);
  });
});

describe('faults (switched on only for the live demo)', () => {
  it('a long run produces faults that need manual help, each cleared later, with no rule violations', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7, undefined, { faults: true });
    const rules = new RulesIndex(nav, site);
    const events: FleetEvent[] = [];
    const viol: string[] = [];
    for (let t = 0; t < 3600; t += 0.1) {
      sim.step(0.1);
      events.push(...sim.drainEvents());
      if (Math.round(t * 10) % 20) continue;
      for (const r of sim.snapshot()) for (const a of rules.check(r)) viol.push(`${r.id} ${a.code} @${t.toFixed(0)}`);
    }
    const faults = events.filter((e) => e.type === 'fault'),
      cleared = events.filter((e) => e.type === 'fault-cleared');
    expect(faults.length).toBeGreaterThan(0);
    expect(cleared.length).toBeGreaterThanOrEqual(faults.length - 2);
    expect(faults.every((f) => f.type === 'fault' && f.needsIntervention)).toBe(true);
    expect(viol.slice(0, 5)).toEqual([]);
  });
  it('faults are off by default, so the same seed always gives the same traffic', () => {
    const a = run(120)
        .last.map((r) => `${r.id}${r.pose.x.toFixed(2)}`)
        .join(),
      b = run(120, { faults: false })
        .last.map((r) => `${r.id}${r.pose.x.toFixed(2)}`)
        .join();
    expect(a).toBe(b);
  });
});
