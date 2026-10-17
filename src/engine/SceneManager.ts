import * as THREE from 'three';
import type { NavGraph, SiteLayout } from '../core/types';
import type { LoadedScene } from './SceneRenderer';
import type { CollisionWorld } from './walk';

/** What the engine is asked to show: a building and a network, and the fleets whose robots belong to this scene. */
export interface SceneSource {
  key: string;
  site: SiteLayout;
  nav: NavGraph;
  fleets: string[];
}
export interface SceneEntry {
  source: SceneSource;
  scene: LoadedScene;
  /** everything of this scene: the drawn map and, beside it, the robots of its fleets (shown and hidden together) */
  root: THREE.Group;
  /** robots live here, not under `scene.group`: freeing a scene must never free robot models, which are shared */
  robots: THREE.Group;
  shownAt: number;
}
export interface CameraPose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}
export interface SceneManagerOptions {
  /** how many scenes stay loaded; scenes that are on screen are never evicted */
  capacity: number;
  parent: THREE.Object3D;
  /** draws a scene (`renderScene`) */
  build(source: SceneSource): LoadedScene;
  /** a scene is about to be freed: take its robots out */
  onEvict?(entry: SceneEntry): void;
}

/**
 * The scenes in memory. `ensure` loads a scene once and keeps it; `show` makes exactly the asked scenes visible (everything else stays loaded but hidden) and frees the least recently shown
 * ones beyond `capacity`; the camera pose of each combination of shown scenes is remembered so coming back to a fleet returns to where you were. A scene is never shared: every fleet
 * has its own, even when two fleets run the same map. See docs/design/map-scenes.md.
 */
export class SceneManager {
  private entries = new Map<string, SceneEntry>();
  private poses = new Map<string, CameraPose>();
  private clock = 0;
  constructor(private o: SceneManagerOptions) {}

  /** The key of a combination of shown scenes (order does not matter). */
  static setKey = (keys: string[]) => [...keys].sort().join('|');

  has = (key: string) => this.entries.has(key);
  get = (key: string) => this.entries.get(key);
  loaded = (): SceneEntry[] => [...this.entries.values()];

  /** Loads the scene if it is not loaded (the same key is never built twice). */
  ensure(source: SceneSource): SceneEntry {
    let e = this.entries.get(source.key);
    if (e) return e;
    const scene = this.o.build(source);
    const root = new THREE.Group();
    const robots = new THREE.Group();
    root.add(scene.group, robots);
    this.o.parent.add(root);
    e = { source, scene, root, robots, shownAt: 0 };
    this.entries.set(source.key, e);
    return e;
  }

  /** Shows exactly these (already ensured) scenes, hides the rest, then frees what is over the budget. Returns the shown ones in the order asked. */
  show(keys: string[]): SceneEntry[] {
    const shown: SceneEntry[] = [];
    for (const k of keys) {
      const e = this.entries.get(k);
      if (e) {
        e.shownAt = ++this.clock;
        shown.push(e);
      }
    }
    for (const e of this.entries.values()) e.root.visible = keys.includes(e.source.key);
    const idle = [...this.entries.values()]
      .filter((e) => !keys.includes(e.source.key))
      .sort((a, b) => a.shownAt - b.shownAt);
    while (this.entries.size > this.o.capacity && idle.length) this.evict(idle.shift()!);
    return shown;
  }

  private evict(e: SceneEntry) {
    this.o.onEvict?.(e);
    e.scene.dispose();
    e.root.removeFromParent();
    this.entries.delete(e.source.key);
  }

  remember(setKey: string, pose: CameraPose) {
    this.poses.set(setKey, { pos: pose.pos.clone(), target: pose.target.clone() });
  }
  recall(setKey: string): CameraPose | undefined {
    return this.poses.get(setKey);
  }

  dispose() {
    for (const e of [...this.entries.values()]) this.evict(e);
    this.poses.clear();
  }
}

/** Collision across the shown scenes (walk mode): a point is blocked when any scene's walls or machines block it. */
export function composeCollision(worlds: () => CollisionWorld[]) {
  const hits = (x: number, y: number, r: number) => worlds().some((w) => w.hits(x, y, r));
  return {
    hits,
    /** same sliding rule as one scene: try the full step, then each axis alone */
    move(x: number, y: number, dx: number, dy: number, r: number): [number, number] {
      if (!hits(x + dx, y + dy, r)) return [x + dx, y + dy];
      if (!hits(x + dx, y, r)) return [x + dx, y];
      if (!hits(x, y + dy, r)) return [x, y + dy];
      return [x, y];
    },
  };
}
