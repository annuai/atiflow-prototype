/** Public entry of the map-editor feature: what other features may import. Everything else in the feature is internal. */
export { seedMapData } from './model/seed';
export { latestOf, mapVersionsStore, useMapVersions } from './model/store';
export type { MapHistory } from './model/types';
