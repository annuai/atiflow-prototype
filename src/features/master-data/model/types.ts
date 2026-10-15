export interface Material {
  code: string;
  name: string;
  /** MaterialGroup id, '' = no group. */
  group: string;
  /** Fleet names this material is assigned to (assignment happens from the fleets page; empty = not assigned yet). */
  fleets: string[];
  updatedAt: number;
}
export interface MaterialGroup {
  id: string;
  name: string;
  prefix: string;
  updatedAt: number;
}

/** A material coming from outside (ERP row or file row) before it is merged into the list. */
export interface IncomingMaterial {
  code: string;
  name: string;
  groupName?: string;
}

export type CellState = 'available' | 'reserved' | 'blocked' | 'filled';
export interface StagingArea {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** Cells that are not available, keyed "row-col" (1-based). A missing key means available. */
  cells: Record<string, CellState>;
}
