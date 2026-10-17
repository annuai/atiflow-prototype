import { pyramid } from './grid';
import { encodePngLevel, type PngLevel } from './levels';
import { readZip } from './zip';
import { importEntries } from '../formats/registry';
import type { ImportedMap, ImportOptions } from './types';

/** What the worker hands back: the map's facts (no raw grid) and the floor picture as ready-to-store PNGs, biggest first. */
export interface PreparedImport {
  map: Omit<ImportedMap, 'grid'>;
  levels: PngLevel[];
}

/** The whole off-screen job: unzip, read, clean the noise, build the zoom levels and compress them. Pure, so the worker is a thin shell and tests run it directly. */
export function prepareImport(zip: Uint8Array, options: ImportOptions = {}): PreparedImport {
  const { grid, ...map } = importEntries(readZip(zip), options);
  return { map, levels: grid ? pyramid(grid).map(encodePngLevel) : [] };
}
