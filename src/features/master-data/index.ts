/** Public entry of the master-data feature: what other features may import. Everything else in the feature is internal. */
export { MaterialPicker } from './components/MaterialPicker';
export type { PickerRow } from './components/MaterialPicker';
export { filterByPrefix, filterMaterials } from './model/logic';
export { masterDataStore, useMasterData } from './model/store';
export type { Material, MaterialGroup } from './model/types';
export { fleetMaterialCodes, useFleetMaterialCodes } from './model/selectors';
export { fleetAreas, findFleetArea, isAreaId, useFleetAreas, usableAreas } from './model/lookup';
export { stockOf } from './model/cells';
export type { CellPlan, StagingArea } from './model/types';
