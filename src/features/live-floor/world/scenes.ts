import type { SceneModel } from '@/core/scene';
import type { SceneSource } from '@/engine/SceneManager';
import type { World } from './buildWorld';

/** The scene of a fleet (null: the fleet is not on the floor). Two fleets on one map have two scenes. */
export const sceneOfFleet = (w: World, fleetId: string): SceneModel | null =>
  w.scenes.find((s) => s.fleetId === fleetId) ?? null;

/** What to show for the chosen fleet: its own scene (nothing, when the fleet is not on the floor: the page says why). */
export function visibleScenes(w: World, fleetId: string): SceneModel[] {
  const own = sceneOfFleet(w, fleetId);
  return own ? [own] : [];
}

/** A scene as the engine takes it: its building, its network and the fleets whose robots belong to it. */
export const toSource = (m: SceneModel): SceneSource => ({
  key: m.key,
  site: m.site,
  nav: m.network,
  fleets: m.fleets,
});

/** Tells the engine what to show for the chosen fleet: its own scene (loaded the first time it is chosen, kept after). */
export function showFor(eng: { setScenes(s: SceneSource[], show: string[]): void }, w: World, fleetId: string) {
  eng.setScenes(
    w.scenes.map(toSource),
    visibleScenes(w, fleetId).map((m) => m.key),
  );
}
