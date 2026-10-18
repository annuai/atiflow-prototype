import type { FleetId } from '@/data/fleets';
export interface Material {
  code: string;
  name: string;
  /** MaterialGroup id, '' = no group. */
  group: string;
  /** Ids of the fleets this material is assigned to (assignment happens from the fleets page; empty = not assigned yet). */
  fleets: FleetId[];
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
/** The order a staging area gives its material out in: FIFO = the material that has been in the longest, LIFO = the material that was put in last. Always followed when material is requested. */
export type Retrieval = 'fifo' | 'lifo';
/** What a cell holds. An available cell is not stored (a missing key = available). */
export interface StagingCell {
  state: Exclude<CellState, 'available'>;
  /** filled: what is in it (missing only in data saved before cells held materials); reserved: what it is held for. */
  materialCode?: string;
  /** pieces (whole number >= 1) */
  quantity?: number;
  /** blocked: why (free text, optional) */
  reason?: string;
  /** reserved: the request / trip that holds it */
  reservedFor?: string;
  /** when this material was put in: the clock of FIFO / LIFO (changing only the quantity does not change it) */
  storedAt?: number;
  updatedAt: number;
  /** a username, or 'system' (a workflow, a migration) */
  updatedBy: string;
}
/** A cell reduced to what the activity list shows. */
export interface CellSnapshot {
  state: CellState;
  materialCode?: string;
  quantity?: number;
}
/** One change, kept per area (newest first, capped). `key` is "row-col". */
export interface CellLogEntry {
  at: number;
  by: string;
  key: string;
  from: CellSnapshot;
  to: CellSnapshot;
  /** the request / trip behind a change made by the system */
  ref?: string;
}
export interface StagingArea {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** Cells that are not available, keyed "row-col" (1-based). A missing key means available. */
  cells: Record<string, StagingCell>;
  /** the station robots drive to for this area: from the map, not stored here */
  stationId?: string;
  /** how the area gives material out: NOT stored here, it is set in the Map Editor with the area (default FIFO) */
  retrieval?: Retrieval;
  log?: CellLogEntry[];
}

/** The cells a request holds, kept ON the request so they can be given back or committed later. Pick-up: the pieces taken out of cells at request time (nothing can be taken twice). Drop-off: one cell reserved for what arrives. */
export interface CellPlan {
  pick?: { areaId: string; code: string; items: { key: string; take: number; storedAt?: number }[] };
  drop?: { areaId: string; code: string; key: string; qty: number };
  /** set once it has been settled, so a late report cannot do it twice */
  settled?: 'committed' | 'released';
}
