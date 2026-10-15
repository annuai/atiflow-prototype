import { describe, it, expect } from 'vitest';
import { CollisionWorld } from '../src/engine/walk';
import type { SiteLayout } from '../src/core/types';

const site = {
  walls: [{ a: [0, 0], b: [10, 0], t: 0.2, h: 3, layer: 'w' }],
  equipment: [{ kind: 'm', x: 5, y: 5, w: 2, d: 2, h: 1.5, layer: 'e' }],
} as unknown as SiteLayout;
describe('CollisionWorld', () => {
  const w = new CollisionWorld(site);
  it('blocks walking through a wall but slides along it', () => {
    expect(w.move(5, 0.55, 0, -0.2, 0.4)).toEqual([5, 0.55]);
    expect(w.move(5, 0.55, 0.2, -0.2, 0.4)).toEqual([5.2, 0.55]);
  });
  it('blocks equipment footprints', () => {
    expect(w.hits(5, 5, 0.4)).toBe(true);
    expect(w.hits(8, 8, 0.4)).toBe(false);
  });
});
