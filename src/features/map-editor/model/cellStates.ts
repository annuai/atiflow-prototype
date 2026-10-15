import { masterDataStore } from '@/features/master-data/model/store';
import type { CellStatesOf } from './validate';

/** The cell states Master Data keeps for a staging area (where the publish rules look). */
export const cellStatesFromMasterData: CellStatesOf = (areaId) =>
  masterDataStore.getState().areas.find((a) => a.id === areaId)?.cells ?? {};
