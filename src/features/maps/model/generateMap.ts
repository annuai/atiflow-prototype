import { generateSampleMap, mapVersionsStore } from '@/features/map-editor';
import { newMapId } from '@/features/map-import';
import { addImportedMap } from './maps';

/**
 * Makes a map from a robot's run data and starts it as a DRAFT (nothing reaches the floor until it is published). With no real run data in the prototype the hall is an example
 * (`generateSampleMap`); it has no stations or routes yet: those are drawn in the Map Editor. Returns the new map's id.
 */
export function createGeneratedMap(o: {
  name: string;
  routing: number;
  robot: string;
  runData: string;
  by: string;
}): string {
  const id = newMapId(o.name);
  const data = generateSampleMap({ seed: `${o.robot}|${o.runData}|${o.name.trim()}`, routing: o.routing });
  addImportedMap({
    id,
    name: o.name.trim(),
    version: o.routing,
    tag: `Waypoint v${o.routing}`,
    fleetLive: '',
    updatedAt: Date.now(),
    stations: [],
    source: 'imported', // (it uses the same pipeline as an imported map: no built-in floor underneath)
  });
  mapVersionsStore.getState().createImported(id, o.routing, data, o.by);
  return id;
}
