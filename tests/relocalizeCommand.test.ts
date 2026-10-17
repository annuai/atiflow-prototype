import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FleetSim } from '../src/adapters/sim';
import { RulesIndex } from '../src/core/rules';
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
const pose = (sim: FleetSim, id: string) => sim.snapshot().find((t) => t.id === id)!.pose;

describe('"relocalize"', () => {
  it('a robot that stands still reports its real position again; one that is driving is refused', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7);
    run(sim, 3);
    let still = sim.bots.find((b) => b.speed < 0.01 && b.state !== 'offline');
    for (let t = 0; !still && t < 600; t += 1) {
      run(sim, 1);
      still = sim.bots.find((b) => b.speed < 0.01 && b.state !== 'offline');
    }
    expect(still).toBeTruthy();
    const real = { x: still!.pos.x, y: still!.pos.y };
    expect(sim.displace(still!.id, { x: 4, y: 0 })).toBe(true);
    expect(pose(sim, still!.id).x).toBeCloseTo(real.x + 4);
    expect(sim.relocalize(still!.id)).toEqual({ ok: true });
    expect(pose(sim, still!.id).x).toBeCloseTo(real.x);
  });
  it('is refused for a driving robot and for a robot that does not exist', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7);
    let moving = sim.bots.find((b) => b.speed > 0.2);
    for (let t = 0; !moving && t < 600; t += 1) {
      run(sim, 1);
      moving = sim.bots.find((b) => b.speed > 0.2);
    }
    expect(moving).toBeTruthy();
    expect(sim.relocalize(moving!.id)).toEqual({ ok: false, reason: 'moving' });
    expect(sim.relocalize('AMR-999')).toEqual({ ok: false, reason: 'not-found' });
  });
  it('a displaced robot is flagged "not on a lane" by the checker and the flag clears after relocalizing', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7);
    const rules = new RulesIndex(nav, site);
    run(sim, 3);
    let still = sim.bots.find((b) => b.speed < 0.01 && b.state !== 'offline');
    for (let t = 0; !still && t < 600; t += 1) {
      run(sim, 1);
      still = sim.bots.find((b) => b.speed < 0.01 && b.state !== 'offline');
    }
    const codes = () => rules.check(sim.snapshot().find((t) => t.id === still!.id)!).map((a) => a.code);
    sim.displace(still!.id, { x: 6, y: 6 });
    expect(codes()).toContain('OFF_LANE');
    sim.relocalize(still!.id);
    expect(codes()).not.toContain('OFF_LANE');
  });
});
