import type { StationType } from '@/core/types';

/** A station as a map file describes it. Metres from the map origin (x east, y north); `rotation` in degrees. */
export interface ImportedStation {
  /** The id the source system uses ("1"); kept so a later import and an export can match it again. */
  externalId: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  type: StationType;
  /** False when the file gives no real position (several stations on the origin): the editor lists it under "Needs placement". */
  placed: boolean;
  /** Every source field we have no column for, kept as it came so exporting loses nothing. */
  extra: Record<string, unknown>;
}

/**
 * The floor as a picture: `alpha` is one byte per cell (0 = nothing, 255 = surely a wall), rows top to bottom, already cropped and cleaned.
 * Cell (col, row) lies at x = (col - originCol) * res, y = (originRow - row) * res.
 */
export interface GridImage {
  res: number;
  width: number;
  height: number;
  originCol: number;
  originRow: number;
  alpha: Uint8Array;
}

export type WarningLevel = 'info' | 'warn' | 'error';
/** What the review step tells the person. `code` picks the text (translated); `args` fill it in. */
export interface ImportWarning {
  code: string;
  level: WarningLevel;
  args?: Record<string, string | number>;
}

export interface ImportedMap {
  /** The importer that read the file (`MapImporter.id`). */
  format: string;
  name: string;
  version: string | null;
  stations: ImportedStation[];
  /** The path the robot drove while it mapped, in metres from the origin (a hint for drawing roads). */
  path: [number, number][];
  grid: GridImage | null;
  /** What this app wrote into the zip's `ati_flow/map.json` on an earlier export (roads, zones, ...): reading it back means nothing is lost on a round trip to the Deployment Manager. */
  ati: Record<string, unknown> | null;
  /** Files of the zip nobody read (a better export may carry routes or zones we do not know yet). */
  unread: string[];
  /** Counts for the review step. */
  stats: { gridCells: number; keptCells: number; removedSpecks: number; pathPoints: number };
  warnings: ImportWarning[];
}

/** A zip's files by path (junk such as `__MACOSX` and dotfiles removed). */
export type Entries = Record<string, Uint8Array>;

/** One map file format. A new format = one importer registered in `formats/registry.ts`; `detect` picks it by the names of the files. */
export interface MapImporter {
  id: string;
  /** How sure this importer is that the files are its format (0 = not at all, 1 = certain). */
  detect(entries: Entries): number;
  parse(entries: Entries, options: ImportOptions): ImportedMap;
}
export interface ImportOptions {
  /** Cells with a level below this are treated as empty (default 4). */
  minLevel?: number;
  /** Connected pieces smaller than this many cells are noise and removed (default 30). */
  minSpeck?: number;
}

export class ImportError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
