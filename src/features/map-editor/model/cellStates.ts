import { masterDataStore } from '@/features/master-data';
import type { CellStatesOf } from './validate';

/** The cell states Master Data keeps for a staging area (where the publish rules look: Filled / Reserved cells must not be lost). */
export const cellStatesFromMasterData: CellStatesOf = (areaId) =>
  Object.fromEntries(
    Object.entries(masterDataStore.getState().areas.find((a) => a.id === areaId)?.cells ?? {}).map(([k, c]) => [
      k,
      c.state,
    ]),
  );
