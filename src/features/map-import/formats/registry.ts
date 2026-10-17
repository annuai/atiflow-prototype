import { ImportError, type Entries, type ImportedMap, type ImportOptions, type MapImporter } from '../core/types';
import { deploymentManager } from './deploymentManager';

/** Every map file format we can read. Add a format = write its importer file and list it here. */
export const IMPORTERS: MapImporter[] = [deploymentManager];

/** Picks the importer that recognises the files best and reads them. A zip nobody recognises is refused with a clear reason. */
export function importEntries(entries: Entries, options: ImportOptions = {}, importers = IMPORTERS): ImportedMap {
  const scored = importers.map((i) => ({ i, score: i.detect(entries) })).sort((a, b) => b.score - a.score);
  if (!scored.length || scored[0].score <= 0)
    throw new ImportError('format.unknown', 'These files are not a map we can read');
  return scored[0].i.parse(entries, options);
}
