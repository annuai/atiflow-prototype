import { mapVersionsStore } from '@/features/map-editor';
import { buildMapData, newMapId, type PreparedImport } from '@/features/map-import';
import { services } from '@/services';
import { addImportedMap } from './maps';

/**
 * Creates a map from a prepared import: stores the floor pictures and the original zip as assets, builds the editor's data and starts the map as a DRAFT (nothing reaches the floor
 * until it is published). `routing` is the chosen map version (2, 4 or 5); the first publish becomes that version.
 */
export async function createImportedMap(
  prepared: PreparedImport,
  zip: Uint8Array,
  o: { name: string; routing: number; by: string; fileName: string; taken: string[] },
): Promise<string> {
  const assets = services().mapAssets;
  const assetIds = await Promise.all(prepared.levels.map((l) => assets.put(l.bytes, 'image/png')));
  const zipId = await assets.put(zip, 'application/zip');
  const takenAreas = Object.values(mapVersionsStore.getState().byMap).flatMap((h) =>
    h.versions.flatMap((v) => v.data.stagingAreas.map((a) => a.id)),
  );
  const data = buildMapData(
    prepared,
    assetIds,
    o.taken,
    { assetId: zipId, fileName: o.fileName, format: prepared.map.format },
    takenAreas,
  );
  const id = newMapId(o.name);
  addImportedMap({
    id,
    name: o.name.trim(),
    version: o.routing,
    tag: `Waypoint v${o.routing}`,
    fleetLive: '',
    updatedAt: Date.now(),
    stations: data.stations.map((s) => ({ id: s.id, name: s.name })),
    source: 'imported',
  });
  mapVersionsStore.getState().createImported(id, o.routing, data, o.by);
  return id;
}
