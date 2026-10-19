import { removeImportedMap, type FleetMap } from '@/data/maps';
import { mapVersionsStore } from '@/features/map-editor';
import { services } from '@/services';

export type DeleteRefusal = 'assigned' | 'built-in';

/** Why a map cannot be deleted (null = it can): a fleet still runs on it, or it is one of the built-in maps (code, not saved data). */
export const deleteRefusal = (map: FleetMap, fleets: string[]): DeleteRefusal | null =>
  fleets.length ? 'assigned' : map.source === 'imported' ? null : 'built-in';

/**
 * Deletes a map for good: its entry, every version and draft, and the stored files it used (the floor pictures and the original zip). Refuses (returns the reason) when a fleet runs on it.
 */
export async function deleteMap(map: FleetMap, fleets: string[]): Promise<DeleteRefusal | null> {
  const no = deleteRefusal(map, fleets);
  if (no) return no;
  const assets = new Set<string>();
  for (const v of mapVersionsStore.getState().byMap[map.id]?.versions ?? []) {
    for (const l of v.data.base?.levels ?? []) assets.add(l.assetId);
    if (v.data.source?.assetId) assets.add(v.data.source.assetId);
  }
  removeImportedMap(map.id);
  mapVersionsStore.getState().removeMap(map.id);
  await Promise.all(
    [...assets].map((id) =>
      services()
        .mapAssets.remove(id)
        .catch(() => undefined),
    ),
  );
  return null;
}
