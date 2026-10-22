import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { heatColor, heatSpots, pickPointers } from '../src/features/material-insights/model/heat';
import type { NavGraph } from '../src/core/types';

const nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;

describe('material heat map (example data)', () => {
  it('gives every work station a stable amount, busiest first, never parking or chargers', () => {
    const a = heatSpots(nav, 'line-side');
    expect(a.length).toBeGreaterThan(5);
    expect(heatSpots(nav, 'line-side')).toEqual(a);
    expect(a.every((s) => !/^(PARK|CHARGE)/.test(s.id))).toBe(true);
    for (let i = 1; i < a.length; i++) expect(a[i - 1].units).toBeGreaterThanOrEqual(a[i].units);
    expect(a[0].level).toBe(1);
    expect(a.every((s) => s.level >= 0 && s.level <= 1)).toBe(true);
  });
  it('another fleet gets another picture, and the colour runs green to red', () => {
    expect(heatSpots(nav, 'asrs')[0].units).not.toBe(heatSpots(nav, 'line-side')[0].units);
    expect(heatColor(0)).toContain('140');
    expect(heatColor(1)).toContain('hsl(0 ');
  });
  it('pointers go to the busiest spots that are not on top of each other', () => {
    const a = heatSpots(nav, 'line-side');
    const p = pickPointers(a, 5, 10);
    expect(p[0]).toBe(a[0]);
    for (const x of p)
      for (const y of p) if (x !== y) expect(Math.hypot(x.x - y.x, x.y - y.y)).toBeGreaterThanOrEqual(10);
  });
});
