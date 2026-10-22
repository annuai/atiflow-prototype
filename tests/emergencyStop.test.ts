import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FleetSim } from '../src/adapters/sim';
import type { NavGraph, SiteLayout } from '../src/core/types';

const site = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8')) as SiteLayout;
const nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
const run = (sim: FleetSim, s: number) => {
  for (let t = 0; t < s; t += 0.1) {
    sim.step(0.1);
    sim.drainEvents();
    sim.drainOrderUpdates();
  }
};
const driving = (sim: FleetSim) => {
  for (let t = 0; t < 600; t += 1) {
    const b = sim.bots.find((x) => x.speed > 0.3);
    if (b) return b;
    run(sim, 1);
  }
  throw new Error('no robot ever drove');
};

describe('emergency stop', () => {
  it('a stopped robot stands exactly where it is, reports paused, and carries on when released', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7);
    const b = driving(sim);
    expect(sim.emergencyStop(b.id)).toEqual({ ok: true, count: 1 });
    run(sim, 1);
    const at = { ...b.pos };
    run(sim, 20);
    expect(b.pos).toEqual(at);
    const t = sim.snapshot().find((x) => x.id === b.id)!;
    expect(t.state).toBe('paused');
    expect(t.speed).toBe(0);
    expect(t.alerts?.some((a) => a.code === 'E_STOP')).toBe(true);
    expect(sim.emergencyStop(b.id)).toEqual({ ok: false, reason: 'already-stopped' });
    expect(sim.releaseStop(b.id)).toEqual({ ok: true, count: 1 });
    run(sim, 30);
    expect(Math.hypot(b.pos.x - at.x, b.pos.y - at.y)).toBeGreaterThan(0.5);
    expect(sim.releaseStop(b.id)).toEqual({ ok: false, reason: 'not-stopped' });
  });
  it('stops and resumes a whole fleet, and refuses unknown robots', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7);
    run(sim, 5);
    const fleet = sim.bots[0].fleetId;
    const n = sim.bots.filter((b) => b.fleetId === fleet && b.state !== 'offline').length;
    expect(sim.stopFleet(fleet, true)).toEqual({ ok: true, count: n });
    run(sim, 10);
    expect(
      sim
        .snapshot()
        .filter((t) => t.fleetId === fleet)
        .every((t) => t.speed === 0),
    ).toBe(true);
    expect(sim.stopFleet(fleet, true).ok).toBe(false);
    expect(sim.stopFleet(fleet, false)).toEqual({ ok: true, count: n });
    expect(sim.emergencyStop('NOPE')).toEqual({ ok: false, reason: 'not-found' });
  });
});
