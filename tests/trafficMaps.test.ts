import { describe, expect, it } from 'vitest';
import { auditNav } from '../src/core/audit';
import { aisleMap, gridMap } from './helpers/maps';
import { run } from './helpers/run';

/** The traffic rules on tiny maps that reproduce the layouts that used to deadlock. They run on any map, so they also guard changes to the rules themselves. */
describe('traffic on small maps', () => {
  it('two robots in a one-lane aisle (lanes 0.8 m apart: they cannot pass) take turns and both keep working', () => {
    const r = run(aisleMap(24, 0.8), 2, 600);
    expect(r.touches.slice(0, 3)).toEqual([]);
    for (const [id, n] of r.trips) expect(n, id).toBeGreaterThanOrEqual(4);
    expect(r.worstWait).toBeLessThan(60);
  });
  it('four robots in a 2 x 2 block of crossing roads never touch and all keep working', () => {
    const r = run(gridMap({ cols: 2, rows: 2 }), 4, 600);
    expect(r.touches.slice(0, 3)).toEqual([]);
    for (const [id, n] of r.trips) expect(n, id).toBeGreaterThanOrEqual(3);
    expect(r.worstWait).toBeLessThan(90);
  });
  it('eight robots in a 3 x 3 grid (a busy hub in the middle) never touch and nobody waits for long', () => {
    const r = run(gridMap({ cols: 3, rows: 3 }), 8, 900);
    expect(r.touches.slice(0, 3)).toEqual([]);
    for (const [id, n] of r.trips) expect(n, id).toBeGreaterThanOrEqual(3);
    expect(r.worstWait).toBeLessThan(90);
  });
});

describe('map audit', () => {
  it('finds lanes that are too close for two robots to pass, and says what to do', () => {
    const a = auditNav(aisleMap(24, 0.8));
    expect(a.narrowShare).toBeGreaterThan(0.5);
    expect(a.warnings.join(' ')).toMatch(/0\.6 m/);
  });
  it('is quiet about a roomy grid', () => {
    const a = auditNav(gridMap({ cols: 3, rows: 3, offset: 0.7 }));
    expect(a.narrowShare).toBeLessThan(0.02);
    expect(a.warnings.filter((w) => /closer than/.test(w))).toEqual([]);
  });
});
