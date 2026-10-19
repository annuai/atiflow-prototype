import { exportMapZip } from '@/features/map-import';
import { services } from '@/services';
import type { MapData } from './types';

/** Builds the zip for the Deployment Manager from a map's data (the original upload from the asset store is the base, so every file we do not edit stays as it was). */
export async function buildMapZip(map: { name: string; version: number }, data: MapData): Promise<Uint8Array> {
  const original = data.source ? ((await services().mapAssets.get(data.source.assetId))?.bytes ?? null) : null;
  return exportMapZip({ original, data, name: map.name, version: `v${map.version}` });
}

export { download } from '@/utils/download';
