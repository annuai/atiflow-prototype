import type { FleetMap } from '@/data/maps';
import { draftOf, latestOf, mapVersionsStore } from '@/features/map-editor';
import { exportMapZip } from '@/features/map-import';
import { services } from '@/services';
import { download } from '@/utils/download';

/** Downloads a map's newest work (its draft when there is one, else the latest published version) as the zip the Deployment Manager takes. Returns false when the map has no saved version yet. */
export async function downloadMap(map: FleetMap): Promise<boolean> {
  const history = mapVersionsStore.getState().byMap[map.id];
  const newest = draftOf(history) ?? latestOf(history);
  if (!newest) return false;
  const source = newest.data.source;
  const original = source ? ((await services().mapAssets.get(source.assetId))?.bytes ?? null) : null;
  const bytes = await exportMapZip({ original, data: newest.data, name: map.name, version: `v${map.version}` });
  download(bytes, `${map.name}.zip`);
  return true;
}
