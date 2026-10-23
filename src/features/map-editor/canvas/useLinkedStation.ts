import { useMemo } from 'react';
import { CELL_STATION, withCellStation } from '../model/stagingCells';
import type { MapData, Selection } from '../model/types';

/**
 * The station whose nodes and approach paths the map draws, with the map to draw them in: the selected station, or (for picked cells of a staging area) a stand-in station for the first picked
 * cell. A point-to-point map has none.
 */
export function useLinkedStation(data: MapData, selection: Selection): { data: MapData; id: string | null } {
  return useMemo(() => {
    if (data.p2p) return { data, id: null };
    if (selection?.kind === 'station') return { data, id: selection.id };
    if (selection?.kind === 'staging' && selection.cells?.length) {
      const a = data.stagingAreas.find((s) => s.id === selection.id);
      const stand = a && withCellStation(data, a, selection.cells[0]);
      if (stand) return { data: stand.data, id: CELL_STATION };
    }
    return { data, id: null };
  }, [data, selection]);
}
