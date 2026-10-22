import { DrawingError, type BlockDef, type Drawing, type DrawingText, type Insert, type P, type Shape } from './types';

/**
 * A DXF reader for what a floor plan needs: lines, polylines (with arcs in them), circles, arcs, ellipses, splines, solids, text and block references. Everything else (hatches, dimensions,
 * leaders...) is counted and skipped. It reads the ASCII form every CAD program writes (R12 to 2018 and later); the binary form is refused with a hint.
 */
const ARC_STEP = Math.PI / 16; // a curve is cut into pieces of at most 11 degrees

type Pair = [number, string];

/** Walks the file as (group code, value) pairs without making an array of the whole file. */
class Pairs {
  private pos = 0;
  constructor(private text: string) {}
  next(): Pair | null {
    const t = this.text;
    if (this.pos >= t.length) return null;
    let e = t.indexOf('\n', this.pos);
    if (e < 0) e = t.length;
    const code = parseInt(t.slice(this.pos, e), 10);
    this.pos = e + 1;
    if (this.pos > t.length) return null;
    let v = t.indexOf('\n', this.pos);
    if (v < 0) v = t.length;
    let val = t.slice(this.pos, v);
    if (val.endsWith('\r')) val = val.slice(0, -1);
    this.pos = v + 1;
    return [Number.isNaN(code) ? -1 : code, val];
  }
  /** one entity: its type and all its pairs up to the next code 0 (which is left for the next call) */
  private peeked: Pair | null = null;
  peek(): Pair | null {
    return (this.peeked ??= this.next());
  }
  take(): Pair | null {
    const p = this.peek();
    this.peeked = null;
    return p;
  }
}

interface Ent {
  type: string;
  p: Pair[];
}
function readEntity(src: Pairs): Ent | null {
  const head = src.peek();
  if (!head || head[0] !== 0) return null;
  src.take();
  const p: Pair[] = [];
  for (;;) {
    const n = src.peek();
    if (!n || n[0] === 0) break;
    p.push(n);
    src.take();
  }
  return { type: head[1], p };
}

const num = (e: Ent, code: number, fallback = 0): number => {
  for (const [c, v] of e.p) if (c === code) return parseFloat(v);
  return fallback;
};
const str = (e: Ent, code: number, fallback = ''): string => {
  for (const [c, v] of e.p) if (c === code) return v;
  return fallback;
};
const all = (e: Ent, code: number): number[] => e.p.filter(([c]) => c === code).map(([, v]) => parseFloat(v));

/** Points along an arc from `a0` to `a1` (radians, counter-clockwise), at least two. */
function arcPoints(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, rot = 0): P[] {
  let span = a1 - a0;
  while (span <= 0) span += Math.PI * 2;
  const n = Math.max(2, Math.ceil(span / ARC_STEP) + 1);
  const c = Math.cos(rot),
    s = Math.sin(rot);
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + (span * i) / (n - 1);
    const x = rx * Math.cos(a),
      y = ry * Math.sin(a);
    return [cx + x * c - y * s, cy + x * s + y * c] as P;
  });
}
/** The points of a polyline segment from `p` to `q` with a bulge (the tangent of a quarter of the arc's angle; positive = counter-clockwise). */
function bulgeSegment(p: P, q: P, bulge: number): P[] {
  const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (!bulge || d < 1e-9) return [q];
  const theta = 4 * Math.atan(bulge);
  const r = d / (2 * Math.sin(Math.abs(theta) / 2));
  const mx = (p[0] + q[0]) / 2,
    my = (p[1] + q[1]) / 2;
  const nx = -(q[1] - p[1]) / d,
    ny = (q[0] - p[0]) / d;
  const off = d / 2 / Math.tan(theta / 2); // signed: left of the chord for a counter-clockwise arc under half a turn
  const cx = mx + nx * off,
    cy = my + ny * off;
  const a0 = Math.atan2(p[1] - cy, p[0] - cx);
  const n = Math.max(2, Math.ceil(Math.abs(theta) / ARC_STEP));
  const out: P[] = [];
  for (let i = 1; i <= n; i++) {
    const a = a0 + (theta * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  out[out.length - 1] = q;
  return out;
}

interface Vertex {
  x: number;
  y: number;
  bulge: number;
}
function polyShape(layer: string, vs: Vertex[], closed: boolean): Shape | null {
  if (vs.length < 2) return null;
  const pts: P[] = [[vs[0].x, vs[0].y]];
  const count = closed ? vs.length : vs.length - 1;
  for (let i = 0; i < count; i++) {
    const a = vs[i],
      b = vs[(i + 1) % vs.length];
    pts.push(...bulgeSegment([a.x, a.y], [b.x, b.y], a.bulge));
  }
  if (closed && pts.length > 1) pts.pop(); // the closing point repeats the first
  return { layer, pts, closed };
}

/** MTEXT without its formatting codes: paragraph format (\pxqc;), font and size (\fArial|b0;, \H2.5;), colour, underline toggles, and \P / \~ become a space. */
const cleanText = (s: string) =>
  s
    .replace(/\\p[^;\\]*;/g, '')
    .replace(/\\[Pp~]/g, ' ')
    .replace(/\\[A-Za-z][^;\\]*;/g, '')
    .replace(/\\[LlOoKk]/g, '')
    .replace(/\\\\/g, '\\')
    .replace(/[{}]/g, '')
    .replace(/%%[uUoOdDpPcC]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

interface Target {
  shapes: Shape[];
  texts: DrawingText[];
  inserts: Insert[];
}

type Handler = (e: Ent, layer: string, t: Target, src: Pairs) => void;

const lwpolyline: Handler = (e, layer, t) => {
  const vs: Vertex[] = [];
  for (const [c, v] of e.p) {
    if (c === 10) vs.push({ x: parseFloat(v), y: 0, bulge: 0 });
    else if (c === 20 && vs.length) vs[vs.length - 1].y = parseFloat(v);
    else if (c === 42 && vs.length) vs[vs.length - 1].bulge = parseFloat(v);
  }
  const s = polyShape(layer, vs, (num(e, 70) & 1) === 1);
  if (s) t.shapes.push(s);
};
/** POLYLINE is followed by its VERTEX entities and a SEQEND. */
const polyline: Handler = (e, layer, t, src) => {
  const flags = num(e, 70);
  const vs: Vertex[] = [];
  for (;;) {
    const n = src.peek();
    if (!n || n[0] !== 0 || n[1] !== 'VERTEX') break;
    const v = readEntity(src)!;
    if ((num(v, 70) & (16 | 128)) === 16) continue; // a spline control point
    vs.push({ x: num(v, 10), y: num(v, 20), bulge: num(v, 42) });
  }
  const end = src.peek();
  if (end && end[1] === 'SEQEND') readEntity(src);
  if ((flags & (16 | 64)) !== 0) return; // a 3D mesh
  const s = polyShape(layer, vs, (flags & 1) === 1);
  if (s) t.shapes.push(s);
};
const circle: Handler = (e, layer, t) => {
  const r = num(e, 40);
  if (r <= 0) return;
  const pts = arcPoints(num(e, 10), num(e, 20), r, r, 0, Math.PI * 2);
  pts.pop();
  t.shapes.push({ layer, pts, closed: true });
};
const arc: Handler = (e, layer, t) => {
  const r = num(e, 40);
  if (r > 0)
    t.shapes.push({
      layer,
      pts: arcPoints(num(e, 10), num(e, 20), r, r, (num(e, 50) * Math.PI) / 180, (num(e, 51) * Math.PI) / 180),
      closed: false,
    });
};
const ellipse: Handler = (e, layer, t) => {
  const mx = num(e, 11),
    my = num(e, 21);
  const rx = Math.hypot(mx, my),
    ry = rx * num(e, 40, 1);
  const a0 = num(e, 41, 0),
    a1 = num(e, 42, Math.PI * 2);
  const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
  const pts = arcPoints(num(e, 10), num(e, 20), rx, ry, a0, a1, Math.atan2(my, mx));
  if (full) pts.pop();
  t.shapes.push({ layer, pts, closed: full });
};
/** The curve through its fit points, else the control polygon (a good enough outline for a floor plan). */
const spline: Handler = (e, layer, t) => {
  const xs = all(e, 11).length ? all(e, 11) : all(e, 10);
  const ys = all(e, 21).length ? all(e, 21) : all(e, 20);
  const pts = xs.map((x, i) => [x, ys[i] ?? 0] as P);
  if (pts.length >= 2) t.shapes.push({ layer, pts, closed: (num(e, 70) & 1) === 1 });
};
const solid: Handler = (e, layer, t) => {
  const q: P[] = [
    [num(e, 10), num(e, 20)],
    [num(e, 11), num(e, 21)],
    [num(e, 13), num(e, 23)],
    [num(e, 12), num(e, 22)],
  ];
  t.shapes.push({ layer, pts: q, closed: true });
};
const insertEntity: Handler = (e, layer, t) => {
  t.inserts.push({
    block: str(e, 2),
    layer,
    x: num(e, 10),
    y: num(e, 20),
    rot: (num(e, 50) * Math.PI) / 180,
    sx: num(e, 41, 1) || 1,
    sy: num(e, 42, 1) || 1,
    cols: Math.max(1, num(e, 70, 1) | 0),
    rows: Math.max(1, num(e, 71, 1) | 0),
    dx: num(e, 44),
    dy: num(e, 45),
  });
};
const textEntity: Handler = (e, layer, t) => {
  const raw =
    e.type === 'MTEXT'
      ? e.p
          .filter(([c]) => c === 3 || c === 1)
          .map(([, v]) => v)
          .join('')
      : str(e, 1);
  const text = cleanText(raw);
  if (text) t.texts.push({ layer, x: num(e, 10), y: num(e, 20), text, height: num(e, 40) });
};
const HANDLERS: Record<string, Handler> = {
  LINE: (e, layer, t) =>
    void t.shapes.push({
      layer,
      pts: [
        [num(e, 10), num(e, 20)],
        [num(e, 11), num(e, 21)],
      ],
      closed: false,
    }),
  LWPOLYLINE: lwpolyline,
  POLYLINE: polyline,
  CIRCLE: circle,
  ARC: arc,
  ELLIPSE: ellipse,
  SPLINE: spline,
  SOLID: solid,
  TRACE: solid,
  INSERT: insertEntity,
  TEXT: textEntity,
  MTEXT: textEntity,
};

function addEntity(e: Ent, t: Target, skipped: Record<string, number>, src: Pairs) {
  const h = HANDLERS[e.type];
  if (h) h(e, str(e, 8, '0'), t, src);
  else skipped[e.type] = (skipped[e.type] ?? 0) + 1;
}

/** One BLOCK definition: its entities up to ENDBLK. */
function readBlock(src: Pairs, head: Ent, drawing: Drawing): void {
  const def: BlockDef = {
    name: str(head, 2),
    base: [num(head, 10), num(head, 20)],
    shapes: [],
    texts: [],
    inserts: [],
  };
  for (;;) {
    const n = src.peek();
    if (!n) break;
    if (n[0] === 0 && n[1] === 'ENDBLK') {
      readEntity(src);
      break;
    }
    const c = readEntity(src);
    if (!c) src.take();
    else addEntity(c, def, drawing.skipped, src);
  }
  if (!def.name.startsWith('*') || def.shapes.length || def.inserts.length) drawing.blocks.set(def.name, def);
}

/** What one step of the file means, by the section it is in; it consumes what it reads. */
function step(src: Pairs, section: string, drawing: Drawing): void {
  const p = src.peek()!;
  if (section === 'HEADER') {
    src.take();
    if (p[0] === 9 && p[1] === '$INSUNITS') {
      const v = src.peek();
      if (v && v[0] === 70) drawing.unitCode = parseInt(v[1], 10);
    }
    return;
  }
  if (section === 'BLOCKS' || section === 'ENTITIES') {
    const e = readEntity(src);
    if (!e) src.take();
    else if (section === 'ENTITIES') addEntity(e, drawing, drawing.skipped, src);
    else if (e.type === 'BLOCK') readBlock(src, e, drawing);
    return;
  }
  src.take(); // TABLES, CLASSES, OBJECTS, THUMBNAILIMAGE: not needed
}

/** Reads DXF text into a drawing. */
export function parseDxf(text: string, fileName: string): Drawing {
  if (text.slice(0, 22).startsWith('AutoCAD Binary DXF'))
    throw new DrawingError(
      'binary-dxf',
      'This is a binary DXF. Save it as an ASCII DXF, or run it through the converter.',
    );
  const src = new Pairs(text);
  const drawing: Drawing = {
    fileName,
    format: 'dxf',
    unitCode: null,
    blocks: new Map(),
    shapes: [],
    texts: [],
    inserts: [],
    skipped: {},
  };
  let section = '';
  let seenSection = false;
  for (;;) {
    const p = src.peek();
    if (!p || (p[0] === 0 && p[1] === 'EOF')) break;
    if (p[0] === 0 && p[1] === 'SECTION') {
      src.take();
      const n = src.take();
      section = n && n[0] === 2 ? n[1] : '';
      seenSection = true;
    } else if (p[0] === 0 && p[1] === 'ENDSEC') {
      src.take();
      section = '';
    } else step(src, section, drawing);
  }
  if (!seenSection) throw new DrawingError('broken', 'This does not look like a DXF file.');
  if (!drawing.shapes.length && !drawing.inserts.length)
    throw new DrawingError('empty', 'The drawing has no lines or blocks in model space.');
  return drawing;
}
