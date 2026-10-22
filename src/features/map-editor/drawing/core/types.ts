/**
 * What the drawing importer works with. A drawing (DXF, DWG converted to DXF, or an Illustrator AI file) is read into plain shapes, texts and block references in the file's own units; the
 * rest (what each layer and block is, where it stands on the map) is decided later, so a file is read once and re-interpreted as the person changes the review table.
 */
export type P = [number, number];

/** A polyline or polygon (an arc, circle or curve is already cut into short lines). */
export interface Shape {
  layer: string;
  pts: P[];
  closed: boolean;
}
export interface DrawingText {
  layer: string;
  x: number;
  y: number;
  text: string;
  height: number;
}
/** A block placed in the drawing (or inside another block): where, turned (radians) and scaled; `cols` x `rows` copies `dx` / `dy` apart (an array insert). */
export interface Insert {
  block: string;
  layer: string;
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  cols: number;
  rows: number;
  dx: number;
  dy: number;
}
export interface BlockDef {
  name: string;
  /** the point of the block that sits on the insert's position */
  base: P;
  shapes: Shape[];
  texts: DrawingText[];
  inserts: Insert[];
}
export interface Drawing {
  fileName: string;
  format: 'dxf' | 'ai';
  /** the file's own unit code (DXF $INSUNITS; 0 or null = not said) */
  unitCode: number | null;
  blocks: Map<string, BlockDef>;
  shapes: Shape[];
  texts: DrawingText[];
  inserts: Insert[];
  /** entity types that were seen and not used (hatches, dimensions...), with how many */
  skipped: Record<string, number>;
}

/** What a layer or a block becomes. `explode` (blocks only) opens the block and sorts its contents by their own layers. */
export type DrawingKind = 'wall' | 'partition' | 'machine' | 'pillar' | 'door' | 'area' | 'explode' | 'ignore';
export interface Rule {
  kind: DrawingKind;
  /** metres; empty = the kind's usual height */
  height?: number;
}
export interface Rules {
  layers: Record<string, Rule>;
  blocks: Record<string, Rule>;
}

/** One row of the review table: a layer or a block with what is in it. */
export interface RowStats {
  name: string;
  /** shapes on the layer, or copies of the block */
  count: number;
  /** layer: total drawn length in metres; block: size of one copy (metres) */
  length?: number;
  size?: { w: number; d: number };
  /** layer: how many of its shapes are closed */
  closed?: number;
  /** block: what is inside (shape count) */
  inside?: number;
}
export interface Summary {
  fileName: string;
  format: Drawing['format'];
  unitCode: number | null;
  /** a unit guessed from the size of the drawing, in metres per drawing unit */
  guessedUnit: number;
  layers: RowStats[];
  blocks: RowStats[];
  /** the drawing's usual extent in drawing units (the middle 98%) */
  extent: { minX: number; minY: number; maxX: number; maxY: number };
  skipped: Record<string, number>;
  rules: Rules;
  /** why each guess was made (layer or block name -> short reason key) */
  reasons: Record<string, string>;
}

/** A wall or partition: a line through points with a thickness (metres). */
export interface BuiltLine {
  kind: 'wall' | 'partition';
  points: P[];
  thickness: number;
  height: number;
}
export interface BuiltBox {
  kind: 'machine' | 'pillar';
  x: number;
  y: number;
  w: number;
  d: number;
  rot: number;
  height: number;
  label?: string;
  /** the block it came from (for the name) */
  from?: string;
}
export interface BuiltDoor {
  x: number;
  y: number;
  w: number;
  rot: number;
  height: number;
}
export interface BuiltArea {
  points: P[];
  label?: string;
}
/** What the rules make of a drawing, in metres in the drawing's own frame (not yet placed on the map). */
export interface Built {
  lines: BuiltLine[];
  boxes: BuiltBox[];
  doors: BuiltDoor[];
  areas: BuiltArea[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  /** what was left out and why, for the review ("12 boxes too big", ...) */
  notes: Record<string, number>;
}

export class DrawingError extends Error {
  constructor(
    public code: 'empty' | 'binary-dxf' | 'dwg' | 'ai-no-pdf' | 'ai-empty' | 'unsupported' | 'too-big' | 'broken',
    message: string,
  ) {
    super(message);
  }
}
