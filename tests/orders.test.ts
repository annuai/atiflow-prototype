import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FleetSim } from '../src/adapters/sim';
import type { NavGraph, OrderUpdate, SiteLayout, TransportOrder } from '../src/core/types';

const site = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8')) as SiteLayout;
const nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
const order = (id: string, over: Partial<TransportOrder> = {}): TransportOrder => ({ id, fleetId: 'line-side', legs: ['STA-116', 'STA-107'], loadFrom: 1, payload: { kind: 'Chain Sprocket 24T', qty: 5 }, ...over });

describe('requested trips (orders) on the simulated floor', () => {
  it('a robot takes the order, drives to the pick-up empty, carries the load to the drop-off, and the order is reported ongoing then completed', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7); const updates: OrderUpdate[] = []; let carriedAtPickup: boolean | null = null, carriedOnLeg2 = false;
    expect(sim.submitOrder(order('REQ-1'))).toBe(true);
    for (let t = 0; t < 3600 && !updates.some((u) => u.status === 'completed'); t += 0.1) {
      sim.step(0.1); updates.push(...sim.drainOrderUpdates()); sim.drainEvents();
      const on = updates.find((u) => u.status === 'ongoing'); const bot = on && sim.bots.find((b) => b.id === on.robotId);
      if (bot?.trip?.orderId === 'REQ-1') { if (bot.trip.leg === 0 && bot.loaded) carriedAtPickup = true; if (bot.trip.leg === 1 && bot.loaded) carriedOnLeg2 = true; }
    }
    const ongoing = updates.find((u) => u.status === 'ongoing'), done = updates.find((u) => u.status === 'completed');
    expect(ongoing).toMatchObject({ id: 'REQ-1' }); expect(ongoing!.tripId).toMatch(/^TRP-\d+$/); expect(done).toMatchObject({ id: 'REQ-1', tripId: ongoing!.tripId, robotId: ongoing!.robotId });
    expect(carriedAtPickup).toBeNull(); expect(carriedOnLeg2).toBe(true);        // empty to the pick-up, loaded after it
  });
  it('a robot drives the trip id the request was given (before approval) and does not make a new one; ids are shared with the simulation\'s own trips', () => {
    const ids = { n: 100, next() { return `TRP-${++this.n}`; }, undo() { this.n--; } }; const sim = new FleetSim(nav, site.siteId, 14, 7, undefined, { tripIds: ids });
    sim.submitOrder(order('REQ-T', { tripId: 'TRP-900' })); const updates: OrderUpdate[] = []; for (let t = 0; t < 120 && !updates.some((u) => u.status === 'ongoing'); t += 0.1) { sim.step(0.1); updates.push(...sim.drainOrderUpdates()); sim.drainEvents(); }
    expect(updates.find((u) => u.status === 'ongoing')).toMatchObject({ id: 'REQ-T', tripId: 'TRP-900' }); expect(sim.bots.some((b) => b.trip?.id === 'TRP-900')).toBe(true); expect(ids.n).toBeGreaterThan(100);          // its own trips took ids from the shared counter
  });
  it('an order still waiting for a robot can be taken back; one that a robot has started cannot', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7); sim.submitOrder(order('REQ-A')); sim.submitOrder(order('REQ-B', { legs: ['STA-117', 'STA-108'] }));
    expect(sim.cancelOrder('REQ-B')).toBe(true); expect(sim.orders.map((o) => o.id)).toEqual(['REQ-A']);
    const updates: OrderUpdate[] = []; for (let t = 0; t < 120 && !updates.some((u) => u.status === 'ongoing'); t += 0.1) { sim.step(0.1); updates.push(...sim.drainOrderUpdates()); }
    expect(updates.some((u) => u.id === 'REQ-A' && u.status === 'ongoing')).toBe(true); expect(sim.cancelOrder('REQ-A')).toBe(false); expect(updates.some((u) => u.id === 'REQ-B')).toBe(false);
  });
  it('an order for a station that is not on the fleet\'s map, or a fleet with no robot, fails at once', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7);
    expect(sim.submitOrder(order('REQ-X', { legs: ['STA-999'] }))).toBe(false); expect(sim.submitOrder(order('REQ-Y', { fleetId: 'nope' }))).toBe(false);
    expect(sim.drainOrderUpdates().map((u) => [u.id, u.status])).toEqual([['REQ-X', 'failed'], ['REQ-Y', 'failed']]);
  });
  it('requested trips are one robot each and take TRP ids like every other trip', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7); ['R1', 'R2', 'R3'].forEach((id, i) => sim.submitOrder(order(id, { legs: [['STA-116', 'STA-117', 'STA-119'][i], ['STA-107', 'STA-108', 'STA-110'][i]] })));
    const ongoing: OrderUpdate[] = []; for (let t = 0; t < 900 && ongoing.length < 3; t += 0.1) { sim.step(0.1); ongoing.push(...sim.drainOrderUpdates().filter((u) => u.status === 'ongoing')); sim.drainEvents(); }
    expect(ongoing).toHaveLength(3); expect(new Set(ongoing.map((u) => u.robotId)).size).toBe(3); expect(new Set(ongoing.map((u) => u.tripId)).size).toBe(3);
  });
});
