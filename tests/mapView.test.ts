import { describe, expect, it } from 'vitest';
import { wheelZoomFactor, zoomStep } from '@/components/map/useMapView';

describe('map zoom feel', () => {
  it('a mouse wheel notch zooms about 1.5x and the opposite notch undoes it', () => {
    const f = wheelZoomFactor({ deltaY: -100, deltaMode: 0, ctrlKey: false });
    expect(f).toBeGreaterThan(1.4);
    expect(f).toBeLessThan(1.7);
    expect(f * wheelZoomFactor({ deltaY: 100, deltaMode: 0, ctrlKey: false })).toBeCloseTo(1, 6);
  });
  it('a trackpad pinch (ctrl + small deltas) is fast enough: a second of pinching reaches 4x or more', () => {
    let z = 1;
    for (let i = 0; i < 60; i++) z *= wheelZoomFactor({ deltaY: -4, deltaMode: 0, ctrlKey: true });
    expect(z).toBeGreaterThan(4);
  });
  it('line-based wheels count as lines and one huge event cannot jump across the whole map', () => {
    expect(wheelZoomFactor({ deltaY: -3, deltaMode: 1, ctrlKey: false })).toBeGreaterThan(1.1);
    expect(wheelZoomFactor({ deltaY: -5000, deltaMode: 0, ctrlKey: false })).toBeLessThan(3);
  });
  it('the glide reaches its target, never overshoots, and takes the same time at any frame rate', () => {
    const run = (ms: number) => {
      let z = 1,
        t = 0;
      while (z !== 4 && t < 2000) {
        const n = zoomStep(z, 4, ms);
        expect(n).toBeLessThanOrEqual(4);
        z = n;
        t += ms;
      }
      return t;
    };
    expect(run(16)).toBeLessThan(600);
    expect(Math.abs(run(8) - run(33))).toBeLessThan(120);
  });
  it('zooming out glides the same way', () => {
    let z = 8;
    for (let i = 0; i < 100 && z !== 1; i++) z = zoomStep(z, 1, 16);
    expect(z).toBe(1);
  });
});
