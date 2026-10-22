import { guessBlock, guessLayer } from './classify';
import { blockBox, copiesOf, IDENT, openBlock, type Box } from './flatten';
import type { Drawing, Rules, RowStats, Summary } from './types';
import { guessUnit, POINT, unitFactor } from './units';

const segLength = (pts: [number, number][], closed: boolean) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (closed && pts.length > 2) l += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  return l;
};

/** The unit to start from: what the file says, else points for an Illustrator file, else a guess from its size. */
export function startUnit(d: Drawing, extent: Box): number {
  if (d.format === 'ai') return POINT;
  return unitFactor(d.unitCode) ?? guessUnit(extent);
}

/** The middle 98% of the drawing's points (a stray point far away must not stretch the extent). */
export function usualExtent(d: Drawing): Box {
  const xs: number[] = [],
    ys: number[] = [];
  const take = (pts: [number, number][]) => {
    for (const p of pts) {
      xs.push(p[0]);
      ys.push(p[1]);
    }
  };
  // a sample: every shape for small drawings, about 200k points for big ones
  const step = Math.max(1, Math.floor(d.shapes.length / 60000));
  for (let i = 0; i < d.shapes.length; i += step) take(d.shapes[i].pts);
  for (const ins of d.inserts) {
    xs.push(ins.x);
    ys.push(ins.y);
  }
  if (!xs.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const at = (a: number[], q: number) => a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * q)))];
  return { minX: at(xs, 0.01), maxX: at(xs, 0.99), minY: at(ys, 0.01), maxY: at(ys, 0.99) };
}

/** Rows for the blocks: copies in the drawing (nested ones count), size of one copy, what is inside. Sizes are in drawing units, scaled to metres by `unit`. */
export function blockRows(d: Drawing, unit: number): RowStats[] {
  const counts = new Map<string, number>();
  let visits = 0;
  const walk = (insName: string, mult: number, depth: number) => {
    if (depth > 6 || visits++ > 400000) return;
    counts.set(insName, (counts.get(insName) ?? 0) + mult);
    const def = d.blocks.get(insName);
    if (!def) return;
    for (const ins of def.inserts) if (d.blocks.has(ins.block)) walk(ins.block, mult * ins.cols * ins.rows, depth + 1);
  };
  for (const ins of d.inserts) if (d.blocks.has(ins.block)) walk(ins.block, ins.cols * ins.rows, 0);
  const rows: RowStats[] = [];
  for (const [name, count] of counts) {
    const b = blockBox(d, name);
    rows.push({
      name,
      count,
      inside: b.shapes,
      size: b.box ? { w: (b.box.maxX - b.box.minX) * unit, d: (b.box.maxY - b.box.minY) * unit } : { w: 0, d: 0 },
    });
  }
  return rows.sort((a, b) => b.count - a.count);
}

/** Rows for the layers: the loose shapes, plus what is inside the blocks that are opened (`explode`). Lengths are in metres. */
export function layerRows(d: Drawing, blockRules: Rules['blocks'], unit: number): RowStats[] {
  const by = new Map<string, RowStats>();
  const add = (layer: string, pts: [number, number][], closed: boolean) => {
    let r = by.get(layer);
    if (!r) by.set(layer, (r = { name: layer, count: 0, length: 0, closed: 0 }));
    r.count++;
    r.length! += segLength(pts, closed) * unit;
    if (closed) r.closed!++;
  };
  for (const s of d.shapes) add(s.layer, s.pts, s.closed);
  for (const ins of d.inserts) {
    if (blockRules[ins.block]?.kind !== 'explode') continue;
    const def = d.blocks.get(ins.block);
    if (!def) continue;
    for (const m of copiesOf(ins, def, IDENT))
      openBlock(
        d,
        def,
        m,
        ins.layer,
        (p) => add(p.layer, p.shape.pts, p.shape.closed),
        () => undefined,
      );
  }
  return [...by.values()].sort((a, b) => b.count - a.count);
}

/** Reads a drawing's layers and blocks and makes the first guess of what each is. */
export function summarise(d: Drawing): Summary {
  const extent = usualExtent(d);
  const unit = startUnit(d, extent);
  const blocks = blockRows(d, unit);
  const rules: Rules = { layers: {}, blocks: {} };
  const reasons: Record<string, string> = {};
  for (const b of blocks) {
    const g = guessBlock(b.name, b.size?.w ?? 0, b.size?.d ?? 0, b.inside ?? 0);
    rules.blocks[b.name] = { kind: g.kind };
    reasons[`block:${b.name}`] = g.why;
  }
  const layers = layerRows(d, rules.blocks, unit);
  for (const l of layers) {
    const g = guessLayer(l.name);
    // a layer of thousands of tiny pieces is a 3D detail or a hatch, not a wall
    const noisy =
      (l.count > 20000 && (l.length ?? 0) / l.count < 0.05) || (l.count > 100 && (l.length ?? 0) / l.count < 0.01);
    rules.layers[l.name] = { kind: noisy ? 'ignore' : g.kind };
    reasons[`layer:${l.name}`] = noisy ? 'noise' : g.why;
  }
  return {
    fileName: d.fileName,
    format: d.format,
    unitCode: d.unitCode,
    guessedUnit: unit,
    layers,
    blocks,
    extent,
    skipped: d.skipped,
    rules,
    reasons,
  };
}
