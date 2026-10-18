import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FleetSim } from '../src/adapters/sim';
import type { NavGraph } from '../src/core/types';

const nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;

/** A short, order-sensitive fingerprint of everything the simulator reports (poses, states, tasks, events, order updates). */
function fingerprint(seed: number, withCommands: boolean) {
  const sim = new FleetSim(nav, nav.siteId, 14, seed, undefined, { faults: false });
  let h = 2166136261;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  };
  for (let t = 0; t < 240; t += 0.1) {
    if (withCommands) {
      const tick = Math.round(t * 10);
      if (tick === 300) sim.sendToCharger(sim.bots[0].id);
      if (tick === 600) {
        sim.displace(sim.bots[3].id, { x: 0.4, y: 0.4 });
        sim.relocalize(sim.bots[3].id);
      }
      if (tick === 900) {
        const own = nav.stations.filter(
          (s) => s.fleets.includes(sim.bots[1].fleetId) && s.type !== 'park' && s.type !== 'charge',
        );
        sim.submitOrder({
          id: 'ORD-G',
          fleetId: sim.bots[1].fleetId,
          legs: [own[0].id, own[1].id],
          loadFrom: 1,
          payload: { kind: 'box', qty: 1 },
        } as never);
      }
    }
    sim.step(0.1);
    for (const r of sim.snapshot())
      mix(
        `${r.id}|${r.state}|${r.pose.x.toFixed(2)}|${r.pose.y.toFixed(2)}|${r.pose.theta.toFixed(2)}|${r.battery.toFixed(1)}|${r.task?.id ?? ''}|${r.waitReason ?? ''}|${r.alerts?.map((a) => a.code).join(',') ?? ''}`,
      );
    sim.drainEvents().forEach((e) => mix(JSON.stringify(e).replace(/\d{10,}/g, '')));
    sim.drainOrderUpdates().forEach((u) => mix(JSON.stringify(u)));
  }
  return h.toString(16);
}

/**
 * Characterization test: the simulator is deterministic for a seed, so a refactor of its code must not change what it does. If one of these changes ON PURPOSE (a new rule, a new dispatch
 * choice), run the test, check the zero-violation tests still pass, and put the new fingerprint here.
 */
describe('FleetSim behaviour is unchanged', () => {
  it('seed 7, plain', () => expect(fingerprint(7, false)).toBe('190dfd50'));
  it('seed 11, plain', () => expect(fingerprint(11, false)).toBe('7a200a15'));
  it('seed 3 with a charge command, a relocalize and an order', () => expect(fingerprint(3, true)).toBe('fa0a8d13'));
});
