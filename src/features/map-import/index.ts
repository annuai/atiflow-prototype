/** Public entry of the map-import feature: reading a map file and turning it into the editor's data. (The dialog lives in the maps feature.) */
export { importInWorker } from './worker/client';
export { prepareImport, type PreparedImport } from './core/prepare';
export { buildMapData, newMapId } from './build';
export { ImportError, type ImportWarning, type ImportedStation } from './core/types';
export { exportMapZip } from './export';
export {
  alignmentScore,
  applyPoint,
  autoAlign,
  IDENTITY,
  parseLayout,
  refineAlignment,
  samplePoints,
  solveSimilarity,
  transformLayout,
  type Layout,
  type Similarity,
} from './core/dwg';
