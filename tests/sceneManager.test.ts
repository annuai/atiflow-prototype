import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { composeCollision, SceneManager, type SceneSource } from '../src/engine/SceneManager';
import type { LoadedScene } from '../src/engine/SceneRenderer';
import { CollisionWorld } from '../src/engine/walk';
import type { NavGraph, SiteLayout } from '../src/core/types';

const site = {
  bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
  walls: [],
  equipment: [],
  floorPolygons: [],
  zones: [],
} as unknown as SiteLayout;
const nav = {
  nodes: [],
  lanes: [],
  stations: [],
  fleets: [],
  trafficZones: [],
  forbiddenZones: [],
} as unknown as NavGraph;
const src = (key: string, fleets: string[] = []): SceneSource => ({ key, site, nav, fleets });

/** scenes that are a group with one mesh, counting how often each is built and freed */
function rig(capacity = 3) {
  const parent = new THREE.Scene();
  const log = { built: [] as string[], freed: [] as string[], evicted: [] as string[] };
  const mgr = new SceneManager({
    capacity,
    parent,
    build: (s) => {
      log.built.push(s.key);
      const group = new THREE.Group();
      group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
      return {
        group,
        dispose: () => {
          log.freed.push(s.key);
          group.removeFromParent();
        },
      } as unknown as LoadedScene;
    },
    onEvict: (e) => log.evicted.push(e.source.key),
  });
  return { mgr, parent, log };
}

describe('SceneManager', () => {
  it('loads a scene once and keeps it', () => {
    const { mgr, log } = rig();
    const a = mgr.ensure(src('a'));
    expect(mgr.ensure(src('a'))).toBe(a);
    expect(log.built).toEqual(['a']);
  });

  it('shows exactly the asked scenes and hides the rest without unloading them', () => {
    const { mgr } = rig();
    mgr.ensure(src('a'));
    mgr.ensure(src('b'));
    const shown = mgr.show(['b']);
    expect(shown.map((e) => e.source.key)).toEqual(['b']);
    expect(mgr.get('a')!.root.visible).toBe(false);
    expect(mgr.get('b')!.root.visible).toBe(true);
    mgr.show(['a', 'b']);
    expect(mgr.loaded().every((e) => e.root.visible)).toBe(true);
  });

  it('keeps at most `capacity` scenes: the least recently shown is freed, a shown one never is', () => {
    const { mgr, log } = rig(3);
    const { freed, evicted } = log;
    for (const k of ['a', 'b', 'c']) {
      mgr.ensure(src(k));
      mgr.show([k]);
    }
    mgr.ensure(src('d'));
    mgr.show(['d']); // a is the oldest
    expect(evicted).toEqual(['a']);
    expect(freed).toEqual(['a']);
    expect(mgr.has('a')).toBe(false);
    expect([...'bcd'].every((k) => mgr.has(k))).toBe(true);
    mgr.show(['b']); // b becomes the newest: c is now the oldest
    mgr.ensure(src('e'));
    mgr.show(['e']);
    expect(evicted).toEqual(['a', 'c']);
  });

  it('never evicts what is on screen, even over the budget (All fleets with many maps)', () => {
    const { mgr, log } = rig(2);
    const { evicted } = log;
    for (const k of ['a', 'b', 'c', 'd']) mgr.ensure(src(k));
    mgr.show(['a', 'b', 'c', 'd']);
    expect(evicted).toEqual([]);
    expect(mgr.loaded()).toHaveLength(4);
    mgr.show(['d']);
    expect(mgr.loaded()).toHaveLength(2); // back within the budget
    expect(mgr.has('d')).toBe(true);
  });

  it('a freed scene can be loaded again when it is needed', () => {
    const { mgr, log } = rig(1);
    mgr.ensure(src('a'));
    mgr.show(['a']);
    mgr.ensure(src('b'));
    mgr.show(['b']);
    expect(mgr.has('a')).toBe(false);
    mgr.ensure(src('a'));
    expect(log.built).toEqual(['a', 'b', 'a']);
  });

  it('remembers the camera of each combination of shown scenes', () => {
    const { mgr } = rig();
    const k1 = SceneManager.setKey(['b', 'a']);
    expect(k1).toBe(SceneManager.setKey(['a', 'b']));
    mgr.remember(k1, { pos: new THREE.Vector3(1, 2, 3), target: new THREE.Vector3(4, 5, 6) });
    expect(mgr.recall(k1)!.pos.toArray()).toEqual([1, 2, 3]);
    expect(mgr.recall('a')).toBeUndefined();
  });

  it('dispose frees every scene', () => {
    const { mgr, parent, log } = rig();
    mgr.ensure(src('a'));
    mgr.ensure(src('b'));
    mgr.dispose();
    expect(log.freed.sort()).toEqual(['a', 'b']);
    expect(parent.children).toHaveLength(0);
  });

  it('robots sit beside the map, so freeing the map never touches them', () => {
    const { mgr } = rig();
    const e = mgr.ensure(src('a'));
    const robot = new THREE.Group();
    e.robots.add(robot);
    expect(e.scene.group.children).not.toContain(robot);
    expect(e.root.children).toContain(e.robots);
  });
});

describe('collision across the shown scenes', () => {
  const room = (x0: number) =>
    new CollisionWorld({
      ...site,
      walls: [{ a: [x0, 0], b: [x0, 10], t: 0.2, h: 3, layer: 'w' }],
    } as unknown as SiteLayout);
  it('blocks where any scene has a wall, and slides along it', () => {
    const c = composeCollision(() => [room(5), room(30)]);
    expect(c.hits(5, 5, 0.4)).toBe(true);
    expect(c.hits(30, 5, 0.4)).toBe(true);
    expect(c.hits(15, 5, 0.4)).toBe(false);
    const [nx, ny] = c.move(4.2, 5, 1, 1, 0.4); // into the wall at x = 5: slides up along it
    expect(nx).toBeCloseTo(4.2);
    expect(ny).toBeCloseTo(6);
  });
});
