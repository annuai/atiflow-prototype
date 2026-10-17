import type { SceneModel } from '@/core/scene';
import type { World } from './buildWorld';

/** The scene a fleet's robots and lanes belong to (null: the fleet is not on the floor). Two fleets on one map are in the same scene. */
export const sceneOfFleet = (w: World, fleetId: string): SceneModel | null =>
  w.scenes.find((s) => s.fleets.includes(fleetId)) ?? null;

/**
 * The scenes to show for the chosen fleet: its own map, or every map ("All fleets", and a fleet that is not on the floor, which has nothing of its own to show). Each scene sits at its
 * placement, so "all" is the maps side by side.
 */
export function visibleScenes(w: World, fleetId: string): SceneModel[] {
  const own = fleetId === 'all' ? null : sceneOfFleet(w, fleetId);
  return own ? [own] : w.scenes;
}
