import type { SceneModel } from '@/core/scene';
import type { SceneSource } from '@/engine/SceneManager';
import type { World } from './buildWorld';

/** The scene of a fleet (null: the fleet is not on the floor). Two fleets on one map have two scenes. */
export const sceneOfFleet = (w: World, fleetId: string): SceneModel | null =>
  w.scenes.find((s) => s.fleetId === fleetId) ?? null;

/** What to show for the chosen fleet: its own scene, or the whole floor ("All fleets", and a fleet that is not on the floor, which has nothing of its own to show). */
export function visibleScenes(w: World, fleetId: string): SceneModel[] {
  const own = fleetId === 'all' ? null : sceneOfFleet(w, fleetId);
  return [own ?? w.all];
}

/** A scene as the engine takes it: its building, its network and the fleets whose robots belong to it. */
export const toSource = (m: SceneModel): SceneSource => ({
  key: m.key,
  site: m.site,
  nav: m.network,
  fleets: m.fleets,
});

/** Tells the engine what to show for the chosen fleet: its own scene (loaded the first time it is chosen, kept after) or the whole floor. */
export function showFor(eng: { setScenes(s: SceneSource[], show: string[]): void }, w: World, fleetId: string) {
  eng.setScenes(
    [w.all, ...w.scenes].map(toSource),
    visibleScenes(w, fleetId).map((m) => m.key),
  );
}
