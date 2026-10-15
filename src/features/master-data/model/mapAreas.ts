import type { MapHistory } from '@/features/map-editor/model/types';
import { latestOf } from '@/features/map-editor/model/store';
import type { CellState, StagingArea } from './types';

/**
 * Staging areas in Master Data come from MAPS: a fleet shows the areas of its assigned map's latest PUBLISHED version (never a draft). The map decides where an area is and how big
 * (rows x columns); Master Data keeps only the state of each cell (Filled / Reserved / Blocked), keyed by the area id, so states survive new map versions.
 * Rules: areas are created, resized and deleted only in the Map Editor; a new cell is Available; cells outside the current size are hidden (publishing is blocked before Filled / Reserved ones would go).
 */
export interface FleetAreas {
  fleet: string;
  mapId: string | null;
  mapName: string;
  version: number | null;
  areas: StagingArea[];
}

export function areasOfHistory(
  history: MapHistory | undefined,
  cellsOf: (areaId: string) => Record<string, CellState>,
): { version: number; areas: StagingArea[] } | null {
  const v = latestOf(history);
  if (!v) return null;
  return {
    version: v.number ?? 0,
    areas: v.data.stagingAreas.map((d) => ({
      id: d.id,
      name: d.name,
      rows: d.rows,
      cols: d.cols,
      cells: visibleCells(cellsOf(d.id), d.rows, d.cols),
    })),
  };
}

/** Only the cells that exist in the current grid. */
export function visibleCells(cells: Record<string, CellState>, rows: number, cols: number): Record<string, CellState> {
  return Object.fromEntries(
    Object.entries(cells).filter(([k]) => {
      const [r, c] = k.split('-').map(Number);
      return r >= 1 && r <= rows && c >= 1 && c <= cols;
    }),
  );
}

export function areasByFleet(
  fleets: string[],
  mapIdOf: (fleet: string) => string | null,
  mapName: (mapId: string) => string,
  byMap: Record<string, MapHistory>,
  cellsOf: (areaId: string) => Record<string, CellState>,
): FleetAreas[] {
  return fleets.map((fleet) => {
    const mapId = mapIdOf(fleet);
    const r = mapId ? areasOfHistory(byMap[mapId], cellsOf) : null;
    return { fleet, mapId, mapName: mapId ? mapName(mapId) : '', version: r?.version ?? null, areas: r?.areas ?? [] };
  });
}
