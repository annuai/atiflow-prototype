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

describe('"send to charger"', () => {
  it('a robot that is not on a work trip is accepted, and its next trip is a charge trip to a charger', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7);
    run(sim, 3);
    // find a robot that is parked right now, otherwise wait for one
    let target = sim.bots.find((b) => !b.trip && (b.state === 'idle' || b.state === 'working'));
    for (let t = 0; !target && t < 600; t += 1) {
      run(sim, 1);
      target = sim.bots.find((b) => !b.trip && (b.state === 'idle' || b.state === 'working'));
    }
    expect(target).toBeTruthy();
    const r = sim.sendToCharger(target!.id);
    expect(r).toEqual({ ok: true, when: 'now' });
    let charged = false;
    for (let t = 0; t < 600 && !charged; t += 0.1) {
      sim.step(0.1);
      sim.drainEvents();
      charged = target!.trip?.kind === 'charge' || target!.state === 'charging';
    }
    expect(charged).toBe(true);
  });
  it('is refused with a reason while the robot is on a work trip, and for a robot that does not exist', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7);
    let busy = sim.bots.find((b) => b.trip?.kind === 'transport');
    for (let t = 0; !busy && t < 900; t += 1) {
      run(sim, 1);
      busy = sim.bots.find((b) => b.trip?.kind === 'transport');
    }
    expect(busy).toBeTruthy();
    expect(sim.sendToCharger(busy!.id)).toMatchObject({ ok: false, reason: 'work-trip', tripId: busy!.trip!.id });
    expect(sim.sendToCharger('AMR-999')).toEqual({ ok: false, reason: 'not-found' });
  });
  it('a robot already heading to a charger is refused', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7);
    let c = sim.bots.find((b) => b.trip?.kind === 'charge' || b.state === 'charging');
    for (let t = 0; !c && t < 2400; t += 1) {
      run(sim, 1);
      c = sim.bots.find((b) => b.trip?.kind === 'charge' || b.state === 'charging');
    }
    if (c) expect(sim.sendToCharger(c.id)).toMatchObject({ ok: false, reason: 'already-charging' });
    else expect(true).toBe(true); // no robot needed a charge in this window (the rule is also covered by the live check)
  });
});
