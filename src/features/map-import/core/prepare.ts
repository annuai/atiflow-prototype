import { pyramid } from './grid';
import { extractStructure, type Structure } from './walls';
import { encodePngLevel, type PngLevel } from './levels';
import { readZip } from './zip';
import { importEntries } from '../formats/registry';
import type { ImportedMap, ImportOptions } from './types';

/** What the worker hands back: the map's facts (no raw grid) and the floor picture as ready-to-store PNGs, biggest first. */
export interface PreparedImport {
  map: Omit<ImportedMap, 'grid'>;
  levels: PngLevel[];
  /** Walls and machines estimated from the grid (for the 3D view). */
  structure: Structure;
}

/** The whole off-screen job: unzip, read, clean the noise, build the zoom levels and compress them. Pure, so the worker is a thin shell and tests run it directly. */
export function prepareImport(zip: Uint8Array, options: ImportOptions = {}): PreparedImport {
  const { grid, ...map } = importEntries(readZip(zip), options);
  return {
    map,
    levels: grid ? pyramid(grid).map(encodePngLevel) : [],
    structure: grid ? extractStructure(grid) : { walls: [], equipment: [] },
  };
}
