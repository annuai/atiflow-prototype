/** Public entry of the map-editor feature: what other features may import. Everything else in the feature is internal. */
export { seedMapData } from './model/seed';
export { draftOf, latestOf, mapVersionsStore, useMapVersions } from './model/store';
export type { MapHistory } from './model/types';
export { applyPublishedMaps } from './model/applyMaps';
export type { MapBase, MapBaseLevel, MapData, MapRoad, MapStation, RoadHeading } from './model/types';
export { nextStationId } from './model/stations';
export { addRoad } from './model/roads';
export type { StagingAreaDef } from './model/types';
export { accessNodes, ensureNode, routable } from './model/connect';
export { addZone } from './model/zones';
export { routeLine, routeSegments } from './model/fillet';
