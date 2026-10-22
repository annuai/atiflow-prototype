import type { BlockDef, Drawing, DrawingText, Insert, P, Shape } from './types';

/** A move in the plane: x' = a x + c y + e, y' = b x + d y + f. */
export type M = [number, number, number, number, number, number];
export const IDENT: M = [1, 0, 0, 1, 0, 0];
/** `p` then `q` (q is applied first): the move that does q and then p. */
export const mul = (p: M, q: M): M => [
  p[0] * q[0] + p[2] * q[1],
  p[1] * q[0] + p[3] * q[1],
  p[0] * q[2] + p[2] * q[3],
  p[1] * q[2] + p[3] * q[3],
  p[0] * q[4] + p[2] * q[5] + p[4],
  p[1] * q[4] + p[3] * q[5] + p[5],
];
export const apply = (m: M, [x, y]: P): P => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
/** Which way a move turns things (radians) and how much it stretches along x and y. */
export const turnOf = (m: M) => Math.atan2(m[1], m[0]);
export const stretchOf = (m: M): [number, number] => [Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3])];

/** Where copy (`col`, `row`) of an insert puts its block: scaled, turned, moved, with the block's base point on the insert position. */
export function insertMatrix(ins: Insert, def: BlockDef, col = 0, row = 0): M {
  const c = Math.cos(ins.rot),
    s = Math.sin(ins.rot);
  const R: M = [c, s, -s, c, ins.x, ins.y];
  const A: M = [1, 0, 0, 1, col * ins.dx, row * ins.dy];
  const S: M = [ins.sx, 0, 0, ins.sy, 0, 0];
  const B: M = [1, 0, 0, 1, -def.base[0], -def.base[1]];
  return mul(mul(mul(R, A), S), B);
}

export const MAX_DEPTH = 8;
const MAX_COPIES = 20000; // a runaway array insert is cut here

/** The copies of an insert as moves (an array insert is cols x rows copies). */
export function* copiesOf(ins: Insert, def: BlockDef, base: M): Generator<M> {
  const n = Math.min(MAX_COPIES, ins.cols * ins.rows);
  for (let i = 0; i < n; i++) yield mul(base, insertMatrix(ins, def, i % ins.cols, Math.floor(i / ins.cols)));
}

export interface Placed {
  shape: Shape;
  /** the layer to judge it by: a shape on layer 0 inside a block takes the layer of the block's insert */
  layer: string;
}
const placeShape = (s: Shape, m: M, layer: string): Placed => ({
  shape: { layer: s.layer, pts: s.pts.map((p) => apply(m, p)), closed: s.closed },
  layer: s.layer === '0' ? layer : s.layer,
});

/** Every shape and text of a block placed by `m`, nested blocks included (they are opened too). */
export function openBlock(
  drawing: Drawing,
  def: BlockDef,
  m: M,
  layer: string,
  onShape: (p: Placed) => void,
  onText: (t: DrawingText, layer: string) => void,
  depth = 0,
): void {
  for (const s of def.shapes) onShape(placeShape(s, m, layer));
  for (const t of def.texts) {
    const [x, y] = apply(m, [t.x, t.y]);
    onText({ ...t, x, y }, t.layer === '0' ? layer : t.layer);
  }
  if (depth >= MAX_DEPTH) return;
  for (const ins of def.inserts) {
    const inner = drawing.blocks.get(ins.block);
    if (!inner) continue;
    const l = ins.layer === '0' ? layer : ins.layer;
    for (const c of copiesOf(ins, inner, m)) openBlock(drawing, inner, c, l, onShape, onText, depth + 1);
  }
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export const EMPTY: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
export const grow = (b: Box, [x, y]: P): void => {
  if (x < b.minX) b.minX = x;
  if (x > b.maxX) b.maxX = x;
  if (y < b.minY) b.minY = y;
  if (y > b.maxY) b.maxY = y;
};
export const isEmpty = (b: Box) => b.minX > b.maxX;

/** The box round a block's own geometry in its own frame (nested blocks included), or null when it holds nothing. Remembered per drawing. */
const boxes = new WeakMap<Drawing, Map<string, { box: Box | null; shapes: number }>>();
export function blockBox(drawing: Drawing, name: string, depth = 0): { box: Box | null; shapes: number } {
  let memo = boxes.get(drawing);
  if (!memo) boxes.set(drawing, (memo = new Map()));
  const known = memo.get(name);
  if (known) return known;
  const def = drawing.blocks.get(name);
  const out = { box: null as Box | null, shapes: 0 };
  if (!def || depth > MAX_DEPTH) return out;
  memo.set(name, out); // (a block that holds itself ends here)
  const b: Box = { ...EMPTY };
  for (const s of def.shapes) {
    out.shapes++;
    for (const p of s.pts) grow(b, p);
  }
  for (const ins of def.inserts) {
    const inner = drawing.blocks.get(ins.block);
    if (!inner) continue;
    const ib = blockBox(drawing, ins.block, depth + 1);
    out.shapes += ib.shapes * Math.min(ins.cols * ins.rows, 50);
    if (!ib.box) continue;
    const corners: P[] = [
      [ib.box.minX, ib.box.minY],
      [ib.box.maxX, ib.box.minY],
      [ib.box.maxX, ib.box.maxY],
      [ib.box.minX, ib.box.maxY],
    ];
    for (const m of copiesOf(ins, inner, IDENT)) for (const c of corners) grow(b, apply(m, c));
  }
  out.box = isEmpty(b) ? null : b;
  return out;
}
