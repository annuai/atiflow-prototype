// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderScene } from '../src/engine/SceneRenderer';
import type { NavGraph, SiteLayout } from '../src/core/types';

const site = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8')) as SiteLayout;
const nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;

/** jsdom has no 2D canvas: labels only need a context that accepts drawing calls. */
beforeAll(() => {
  const ctx: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get: (t: Record<string | symbol, unknown>, k) =>
        k === 'measureText' ? () => ({ width: 10 }) : k in t ? t[k] : () => ctx,
      set: (t: Record<string | symbol, unknown>, k, v) => ((t[k] = v), true),
    },
  );
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
});

const created = new Set<unknown>(),
  freed = new Set<unknown>();
const spy = (proto: { dispose(): void }) => {
  const orig = proto.dispose;
  proto.dispose = function (this: unknown) {
    freed.add(this);
    return orig.call(this);
  };
  return () => (proto.dispose = orig);
};
const restore: (() => void)[] = [];
beforeAll(() => {
  restore.push(spy(THREE.BufferGeometry.prototype), spy(THREE.Material.prototype), spy(THREE.Texture.prototype));
});
afterEach(() => {
  created.clear();
  freed.clear();
});
/** Everything a scene holds that must be freed: its geometries, materials and textures. */
const resources = (root: THREE.Object3D) => {
  const out = new Set<unknown>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) out.add(m.geometry);
    for (const mat of (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) as THREE.Material[]) {
      out.add(mat);
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) out.add(v);
    }
  });
  return out;
};

describe('SceneRenderer', () => {
  it('draws the building, zones, labels and lanes under ONE group', () => {
    const s = renderScene(structuredClone(site), nav, { plan: false });
    expect(s.group.children.length).toBeGreaterThan(10);
    expect(s.group.children).toContain(s.rules.root); // the lane layer is part of the scene
    expect(s.zoneMeshes.length).toBe(site.zones.length);
    expect(s.planLines.visible).toBe(false);
    expect(s.frame.W).toBeCloseTo(site.bounds.maxX - site.bounds.minX);
    expect(renderScene(structuredClone(site), nav, { plan: true }).planLines.visible).toBe(true);
  });

  it('dispose() frees every geometry, material and texture it made, and leaves the scene', () => {
    const parent = new THREE.Scene();
    const s = renderScene(structuredClone(site), nav, { plan: false });
    parent.add(s.group);
    const all = resources(s.group);
    expect(all.size).toBeGreaterThan(20);
    s.dispose();
    for (const r of all) expect(freed.has(r)).toBe(true);
    expect(parent.children).toHaveLength(0);
  });

  it('dispose() twice is harmless', () => {
    const s = renderScene(structuredClone(site), nav, { plan: false });
    s.dispose();
    expect(() => s.dispose()).not.toThrow();
  });

  it('twenty loads and disposals leave nothing behind', () => {
    const parent = new THREE.Scene();
    for (let i = 0; i < 20; i++) {
      const s = renderScene(structuredClone(site), nav, { plan: i % 2 === 0 });
      parent.add(s.group);
      for (const r of resources(s.group)) created.add(r);
      s.dispose();
    }
    expect(parent.children).toHaveLength(0);
    for (const r of created) expect(freed.has(r)).toBe(true);
    expect(created.size).toBeGreaterThan(400);
  });
});
