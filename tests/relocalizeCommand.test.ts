import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FleetSim } from '../src/adapters/sim';
import { RulesIndex } from '../src/core/rules';
import type { NavGraph, SiteLayout } from '../src/core/types';
import { gridMap } from './helpers/maps';

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

describe('a robot that was moved off the road and is dispatched', () => {
  const grid = gridMap({ cols: 3, rows: 2 }); // a quiet map: one robot, no traffic to wait for
  const idleBot = (sim: FleetSim) =>
    sim.bots.find((b) => !b.plan && !b.trip && b.speed < 0.01 && b.state !== 'offline');
  const laneDistance = (sim: FleetSim, id: string) => {
    const b = sim.bots.find((x) => x.id === id)!;
    let best = Infinity;
    for (const l of grid.lanes) {
      if (!l.fleets.includes(b.fleetId)) continue;
      for (let i = 0; i + 1 < l.geom.length; i++) {
        const [ax, ay] = l.geom[i],
          [bx, by] = l.geom[i + 1];
        const dx = bx - ax,
          dy = by - ay;
        const u = Math.max(0, Math.min(1, ((b.pos.x - ax) * dx + (b.pos.y - ay) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(b.pos.x - (ax + u * dx), b.pos.y - (ay + u * dy)));
      }
    }
    return best;
  };
  const findIdle = (sim: FleetSim) => {
    let b = idleBot(sim);
    for (let t = 0; !b && t < 900; t += 1) {
      run(sim, 1);
      b = idleBot(sim);
    }
    expect(b).toBeTruthy();
    return b!;
  };
  it('finds the nearest lane by itself, drives onto it without jumping, and then goes on with the trip', () => {
    const sim = new FleetSim(grid, 'grid', 1, 7);
    run(sim, 3);
    const b = findIdle(sim);
    // put it somewhere that is clearly off every lane but not far from one (the floor is full of parallel lanes)
    const spots = [2, -2, 3, -3, 4, -4, 2.5, -2.5].flatMap((d) => [
      { x: d, y: 0 },
      { x: 0, y: d },
    ]);
    const spot = spots.find((s) => {
      const home = { x: b.pos.x, y: b.pos.y };
      sim.moveByHand(b.id, s);
      const d = laneDistance(sim, b.id);
      b.pos = home;
      return d > 1.6 && d < 8;
    });
    expect(spot).toBeTruthy();
    expect(sim.moveByHand(b.id, spot!)).toBe(true);
    expect(laneDistance(sim, b.id)).toBeGreaterThan(1.3);
    let last = { x: b.pos.x, y: b.pos.y };
    let onLane = false,
      worst = 0;
    for (let t = 0; t < 120 && !onLane; t += 0.1) {
      sim.step(0.1);
      sim.drainEvents();
      sim.drainOrderUpdates();
      worst = Math.max(worst, Math.hypot(b.pos.x - last.x, b.pos.y - last.y));
      last = { x: b.pos.x, y: b.pos.y };
      onLane = !!b.trip && laneDistance(sim, b.id) <= 1.3;
    }
    expect(b.trip).toBeTruthy();
    expect(onLane).toBe(true);
    expect(worst).toBeLessThan(0.25); // never faster than the robot can drive: no teleporting
    run(sim, 30);
    expect(b.trip === null || b.plan !== null).toBe(true);
  });
  it('a robot with no lane within reach stays where it is and gets no trip', () => {
    const sim = new FleetSim(grid, 'grid', 1, 7);
    run(sim, 3);
    const b = findIdle(sim);
    const before = { x: b.pos.x, y: b.pos.y };
    sim.moveByHand(b.id, { x: 400, y: 400 });
    run(sim, 60);
    expect(b.trip).toBeNull();
    expect(b.pos.x).toBeCloseTo(before.x + 400);
  });
});
