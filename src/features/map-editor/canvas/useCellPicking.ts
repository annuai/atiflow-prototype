import { cellAt, togglePick } from '../model/stagingCells';
import type { MapData, Selection } from '../model/types';
import type { useViewport } from './useViewport';

/** Picking cells of a staging area on the map: which are picked, picking some (Shift adds them), and picking the one under a pointer. */
export function useCellPicking(
  data: MapData,
  selection: Selection,
  vp: Pick<ReturnType<typeof useViewport>, 'toSite'>,
  onSelect: (sel: Selection) => void,
) {
  const cellsOf = (id: string) => (selection?.kind === 'staging' && selection.id === id ? (selection.cells ?? []) : []);
  const pickCells = (id: string, refs: string[], shift = false) =>
    onSelect({ kind: 'staging', id, cells: togglePick(cellsOf(id), refs, shift) });
  /** a press on the body of the selected area: the cell under it (between the cells: the whole area) */
  const pickAt = (id: string, clientX: number, clientY: number, shift: boolean) => {
    const a = data.stagingAreas.find((s) => s.id === id);
    const at = vp.toSite(clientX, clientY);
    const ref = a ? cellAt(a, at.x, at.y) : null;
    pickCells(id, ref ? [ref] : [], shift && !!ref);
  };
  return { cellsOf, pickCells, pickAt };
}
