import { FleetSim } from '../../src/adapters/sim';
import type { NavGraph } from '../../src/core/types';
import { rects, touching } from './touch';

export interface RunResult {
  trips: Map<string, number>;
  worstWait: number;
  touches: string[];
  waitingAtEnd: number;
  ringsBroken: number;
}
/** Runs the simulator on a map and reports what a traffic test cares about: trips finished per robot, the longest any robot waited, robots touching. */
export function run(nav: NavGraph, robots: number, seconds: number, seed = 5): RunResult {
  const sim = new FleetSim(nav, nav.siteId, robots, seed);
  const trips = new Map<string, number>();
  const seen = new Map<string, string>();
  const since = new Map<string, number>();
  const touches: string[] = [];
  let worstWait = 0;
  for (let t = 0; t < seconds; t += 0.1) {
    sim.step(0.1);
    const snap = sim.snapshot();
    snap.forEach((a, i) => {
      if (a.state === 'working' && a.task && seen.get(a.id) !== a.task.id && a.task.type !== 'charge') {
        seen.set(a.id, a.task.id);
        trips.set(a.id, (trips.get(a.id) ?? 0) + 1);
      }
      if (a.state === 'waiting') {
        if (!since.has(a.id)) since.set(a.id, t);
        worstWait = Math.max(worstWait, t - since.get(a.id)!);
      } else since.delete(a.id);
      for (let j = i + 1; j < snap.length; j++) {
        const b = snap[j];
        if (Math.hypot(a.pose.x - b.pose.x, a.pose.y - b.pose.y) > 6) continue;
        if (rects(a).some((p) => rects(b).some((q) => touching(p, q))))
          touches.push(`t=${t.toFixed(1)} ${a.id} x ${b.id}`);
      }
    });
  }
  for (const b of sim.snapshot()) if (!trips.has(b.id)) trips.set(b.id, 0);
  return {
    trips,
    worstWait,
    touches,
    waitingAtEnd: sim.snapshot().filter((b) => b.state === 'waiting').length,
    ringsBroken: sim.deadlocksFound,
  };
}
