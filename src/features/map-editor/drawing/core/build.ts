import { fitRect } from '@/core/rect';
import { guessBlock, guessLayer, heightFor } from './classify';
import { apply, blockBox, copiesOf, IDENT, openBlock, stretchOf, turnOf, type Box, type M } from './flatten';
import { chain, pairFaces, segmentsOf, type Seg } from './walls';
import type {
  Built,
  BuiltArea,
  BuiltBox,
  BuiltDoor,
  Drawing,
  DrawingKind,
  DrawingText,
  P,
  Rule,
  Rules,
  Shape,
} from './types';

/**
 * What the rules make of a drawing: walls (double lines paired, pieces joined), machines and pillars (blocks by their size, outlines by their shape), doors (blocks, snapped to the wall they
 * stand in), and work areas (closed outlines, named from the text inside). Everything is in metres in the drawing's own frame; placing it on the map is a separate step.
 */
const round2 = (v: number) => Math.round(v * 100) / 100;

const MACHINE_SIZE = { min: 0.2, max: 40 };
const PILLAR_SIZE = { min: 0.1, max: 3 };
const DOOR_WIDTH = { min: 0.7, max: 3 };
const AREA_MIN = 4; // square metres: smaller closed shapes are not areas

interface Bucket {
  wall: Shape[];
  partition: Shape[];
  machine: Shape[];
  pillar: Shape[];
  area: Shape[];
}
const emptyBucket = (): Bucket => ({ wall: [], partition: [], machine: [], pillar: [], area: [] });
type Shaped = keyof Bucket;
const isShaped = (k: DrawingKind): k is Shaped => k in emptyBucket();

/** Rule for a layer: what the person chose, else the name's guess. */
export const layerRule = (rules: Rules, layer: string): Rule => rules.layers[layer] ?? guessLayer(layer);

/** Cuts shapes into connected pieces (lines that touch end to end) and gives each piece's points: a machine drawn as four separate lines is one piece. */
function pieces(shapes: Shape[], scale: number): P[][] {
  const parent: number[] = [];
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const at = new Map<string, number>();
  const pts: P[][] = shapes.map((s) => s.pts.map(([x, y]) => [x * scale, y * scale] as P));
  pts.forEach((_, i) => (parent[i] = i));
  const k = (p: P) => `${Math.round(p[0] * 25)},${Math.round(p[1] * 25)}`; // 4 cm
  pts.forEach((poly, i) => {
    for (const p of poly) {
      const id = k(p);
      const j = at.get(id);
      if (j === undefined) at.set(id, i);
      else parent[find(i)] = find(j);
    }
  });
  const groups = new Map<number, P[]>();
  pts.forEach((poly, i) => {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(...poly);
    else groups.set(r, [...poly]);
  });
  return [...groups.values()];
}

const boxOf = (poly: P[], kind: 'machine' | 'pillar', height: number, from?: string): BuiltBox => {
  const r = fitRect(poly, 0.01);
  // the long side along x, so a 90 degree turn is not a different machine
  const turned = r.h > r.w;
  return {
    kind,
    x: round2(r.cx),
    y: round2(r.cy),
    w: round2(turned ? r.h : r.w),
    d: round2(turned ? r.w : r.h),
    rot: round2((turned ? r.rot + Math.PI / 2 : r.rot) * 1000) / 1000,
    height,
    ...(from ? { from } : {}),
  };
};

/** Keeps the outermost of overlapping boxes of one kind (a machine drawn with inner outlines is one machine). */
function outermost(boxes: BuiltBox[], notes: Record<string, number>): BuiltBox[] {
  const sorted = [...boxes].sort((a, b) => b.w * b.d - a.w * a.d);
  const kept: BuiltBox[] = [];
  const grid = new Map<string, BuiltBox[]>();
  const cell = 4;
  const inside = (b: BuiltBox, o: BuiltBox) => {
    const c = Math.cos(o.rot),
      s = Math.sin(o.rot);
    const dx = b.x - o.x,
      dy = b.y - o.y;
    const lx = Math.abs(dx * c + dy * s),
      ly = Math.abs(-dx * s + dy * c);
    return lx <= o.w / 2 + 0.05 && ly <= o.d / 2 + 0.05;
  };
  for (const b of sorted) {
    const cx = Math.floor(b.x / cell),
      cy = Math.floor(b.y / cell);
    let covered = false;
    for (let dx = -1; dx <= 1 && !covered; dx++)
      for (let dy = -1; dy <= 1 && !covered; dy++)
        for (const o of grid.get(`${cx + dx},${cy + dy}`) ?? []) if (inside(b, o)) covered = true;
    if (covered) {
      notes.nested = (notes.nested ?? 0) + 1;
      continue;
    }
    kept.push(b);
    const key = `${cx},${cy}`;
    const l = grid.get(key);
    if (l) l.push(b);
    else grid.set(key, [b]);
  }
  return kept;
}

const inPoly = (p: P, poly: P[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const polyArea = (poly: P[]) => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
};

const usefulLabel = (t: string) => t.length <= 40 && /[A-Za-z]/.test(t);

/** Moves each door onto the nearest wall within reach and turns it along that wall; a door that stands in no wall is dropped. */
function snapDoors(doors: BuiltDoor[], lines: { points: P[] }[], notes: Record<string, number>): BuiltDoor[] {
  const out: BuiltDoor[] = [];
  for (const d of doors) {
    let best: { at: P; rot: number; dist: number } | null = null;
    for (const l of lines)
      for (let i = 1; i < l.points.length; i++) {
        const [ax, ay] = l.points[i - 1],
          [bx, by] = l.points[i];
        const dx = bx - ax,
          dy = by - ay,
          l2 = dx * dx + dy * dy;
        if (!l2) continue;
        const t = Math.max(0, Math.min(1, ((d.x - ax) * dx + (d.y - ay) * dy) / l2));
        const q: P = [ax + t * dx, ay + t * dy];
        const dist = Math.hypot(d.x - q[0], d.y - q[1]);
        if (dist <= 1 && (!best || dist < best.dist)) best = { at: q, rot: Math.atan2(dy, dx), dist };
      }
    if (!best) {
      notes.doorNoWall = (notes.doorNoWall ?? 0) + 1;
      continue;
    }
    out.push({ ...d, x: round2(best.at[0]), y: round2(best.at[1]), rot: best.rot });
  }
  return out;
}

/** Everything the drawing holds, sorted by what the rules say it is, before any geometry is made. */
interface Collected {
  loose: Bucket;
  blockShapes: Record<'wall' | 'partition' | 'area', Shape[]>;
  boxes: BuiltBox[];
  doors: BuiltDoor[];
  texts: DrawingText[];
  heightOf: Map<DrawingKind, number | undefined>;
  notes: Record<string, number>;
}
const count = (c: Collected, k: string) => void (c.notes[k] = (c.notes[k] ?? 0) + 1);

/** A block placed once, as a box (machine, pillar) or a door; too big or too small ones are counted and left out. */
function placeBlock(c: Collected, ins: { block: string }, rule: Rule, m: M, box: Box, unit: number): void {
  const [px, py] = apply(m, [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2]);
  const [sx, sy] = stretchOf(m);
  const bw = (box.maxX - box.minX) * sx * unit,
    bd = (box.maxY - box.minY) * sy * unit;
  const rot = turnOf(m);
  if (rule.kind === 'door') {
    c.doors.push({
      x: px * unit,
      y: py * unit,
      w: Math.min(DOOR_WIDTH.max, Math.max(DOOR_WIDTH.min, Math.max(bw, bd))),
      rot,
      height: rule.height ?? heightFor('door', ins.block),
    });
    return;
  }
  const kind = rule.kind as 'machine' | 'pillar';
  const size = kind === 'machine' ? MACHINE_SIZE : PILLAR_SIZE;
  if (Math.max(bw, bd) < size.min) return count(c, 'tooSmall');
  if (Math.max(bw, bd) > size.max) return count(c, 'tooBig');
  c.boxes.push({
    kind,
    x: round2(px * unit),
    y: round2(py * unit),
    w: round2(bw),
    d: round2(bd),
    rot: round2(rot * 1000) / 1000,
    height: rule.height ?? heightFor(kind, ins.block),
    ...(/^(\*|a\$c|\$)/i.test(ins.block) ? {} : { from: ins.block }),
  });
}

function collect(d: Drawing, rules: Rules, unit: number): Collected {
  const c: Collected = {
    loose: emptyBucket(),
    blockShapes: { wall: [], partition: [], area: [] },
    boxes: [],
    doors: [],
    texts: [],
    heightOf: new Map(),
    notes: {},
  };
  const sortShape = (s: Shape, layer: string) => {
    const r = layerRule(rules, layer);
    if (!isShaped(r.kind)) return;
    c.loose[r.kind].push(s);
    if (r.height !== undefined && !c.heightOf.has(r.kind)) c.heightOf.set(r.kind, r.height);
  };
  const addText = (t: DrawingText) => c.texts.push({ ...t, x: t.x * unit, y: t.y * unit, height: t.height * unit });
  for (const s of d.shapes) sortShape(s, s.layer);
  d.texts.forEach(addText);
  for (const ins of d.inserts) {
    const def = d.blocks.get(ins.block);
    if (!def) {
      count(c, 'missingBlock');
      continue;
    }
    const b = blockBox(d, ins.block);
    const w = b.box ? (b.box.maxX - b.box.minX) * unit : 0,
      dd = b.box ? (b.box.maxY - b.box.minY) * unit : 0;
    const rule: Rule = rules.blocks[ins.block] ?? guessBlock(ins.block, w, dd, b.shapes);
    if (rule.kind === 'ignore') continue;
    for (const m of copiesOf(ins, def, IDENT)) {
      if (rule.kind === 'explode') openBlock(d, def, m, ins.layer, (p) => sortShape(p.shape, p.layer), addText);
      else if (rule.kind === 'wall' || rule.kind === 'partition' || rule.kind === 'area')
        openBlock(
          d,
          def,
          m,
          ins.layer,
          (p) => c.blockShapes[rule.kind as 'wall'].push(p.shape),
          () => undefined,
        );
      else if (b.box) placeBlock(c, ins, rule, m, b.box, unit);
    }
  }
  return c;
}

/** Walls and partitions: double lines paired, pieces joined. */
const makeLines = (c: Collected, unit: number) =>
  (['wall', 'partition'] as const).flatMap((kind) => {
    const segs: Seg[] = pairFaces(
      segmentsOf([...c.loose[kind], ...c.blockShapes[kind]], kind === 'wall' ? 0.2 : 0.1, unit),
    );
    return chain(segs, kind, c.heightOf.get(kind) ?? heightFor(kind, '')).filter((l) => l.points.length >= 2);
  });

/** Boxes from outlines (closed shapes, and lines that meet end to end), plus the blocks' boxes; inner outlines are merged into the outer one. */
function makeBoxes(c: Collected, unit: number): BuiltBox[] {
  for (const kind of ['machine', 'pillar'] as const) {
    const size = kind === 'machine' ? MACHINE_SIZE : PILLAR_SIZE;
    const made: BuiltBox[] = [];
    for (const poly of pieces(c.loose[kind], unit)) {
      const b = boxOf(poly, kind, c.heightOf.get(kind) ?? heightFor(kind, ''));
      const big = Math.max(b.w, b.d);
      if (big < size.min) count(c, 'tooSmall');
      else if (big > size.max) count(c, 'tooBig');
      else made.push(b);
    }
    c.boxes.push(...outermost(made, c.notes));
  }
  const solid = outermost(
    c.boxes.filter((b) => b.kind === 'machine' && !b.from),
    c.notes,
  );
  const all = [...c.boxes.filter((b) => b.kind !== 'machine' || b.from), ...solid];
  for (const b of all) {
    if (b.label || b.kind !== 'machine') continue;
    const t = c.texts.find(
      (q) => usefulLabel(q.text) && Math.abs(q.x - b.x) <= b.w / 2 && Math.abs(q.y - b.y) <= b.d / 2,
    );
    if (t) b.label = t.text;
  }
  return all;
}

/** Work areas from closed outlines, named by the biggest text inside. */
function makeAreas(c: Collected, unit: number): BuiltArea[] {
  const polys = [...c.loose.area, ...c.blockShapes.area]
    .filter((s) => s.closed && s.pts.length >= 3)
    .map((s) => s.pts.map(([x, y]) => [x * unit, y * unit] as P))
    .filter((p) => polyArea(p) >= AREA_MIN)
    .sort((a, b) => polyArea(b) - polyArea(a))
    .slice(0, 400);
  return polys.map((poly) => {
    const inside = c.texts
      .filter((t) => usefulLabel(t.text) && inPoly([t.x, t.y], poly))
      .sort((a, b) => b.height - a.height);
    return { points: poly, ...(inside[0] ? { label: inside[0].text } : {}) };
  });
}

const boundsOf = (parts: P[][]): Built['bounds'] => {
  const g = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const ps of parts)
    for (const p of ps) {
      g.minX = Math.min(g.minX, p[0]);
      g.maxX = Math.max(g.maxX, p[0]);
      g.minY = Math.min(g.minY, p[1]);
      g.maxY = Math.max(g.maxY, p[1]);
    }
  return g.minX <= g.maxX ? g : null;
};

export function buildDrawing(d: Drawing, rules: Rules, unit: number): Built {
  const c = collect(d, rules, unit);
  const lines = makeLines(c, unit);
  const boxes = makeBoxes(c, unit);
  const areas = makeAreas(c, unit);
  const doors = snapDoors(c.doors, lines, c.notes);
  const bounds = boundsOf([
    ...lines.map((l) => l.points),
    ...boxes.map((b) => [[b.x, b.y]] as P[]),
    ...areas.map((a) => a.points),
  ]);
  return { lines, boxes, doors, areas, bounds, notes: c.notes };
}
