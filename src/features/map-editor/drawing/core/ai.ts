import { unzlibSync } from 'fflate';
import { apply, IDENT, mul, type M } from './flatten';
import { DrawingError, type Drawing, type P, type Shape } from './types';

/**
 * An Adobe Illustrator file as a drawing. An .ai saved with "Create PDF Compatible File" (the default) is a PDF, and a PDF page is a list of path operators: that is read here (moves, lines,
 * curves, rectangles, the transforms that place them, form objects, and the layer names Illustrator writes as optional-content groups). There are no blocks in an AI file, so there is nothing to
 * classify but its layers. Older files saved without PDF content are PostScript and are refused with a hint.
 */
const dec = new TextDecoder('latin1');

interface Obj {
  dict: string;
  stream?: Uint8Array;
}

const refNum = (s: string, key: string): number | null => {
  const m = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(s);
  return m ? parseInt(m[1], 10) : null;
};

/** Everything in the file that is an object: top-level ones and the ones packed inside object streams. */
function readObjects(raw: string, bytes: Uint8Array): Map<number, Obj> {
  const objs = new Map<number, Obj>();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const num = parseInt(m[1], 10);
    const start = m.index + m[0].length;
    const end = raw.indexOf('endobj', start);
    if (end < 0) break;
    let body = raw.slice(start, end);
    const si = body.indexOf('stream');
    let stream: Uint8Array | undefined;
    if (si >= 0 && /^\s*<<[\s\S]*>>\s*stream/.test(body.slice(0, si + 6))) {
      let from = start + si + 6;
      if (raw[from] === '\r') from++;
      if (raw[from] === '\n') from++;
      const to = raw.indexOf('endstream', from);
      stream = bytes.subarray(from, to < 0 ? end : to);
      body = body.slice(0, si);
    }
    const dict = body;
    let data = stream;
    if (data && /\/FlateDecode|\/Fl\b/.test(dict)) {
      try {
        data = unzlibSync(trimEol(data));
      } catch {
        data = undefined; // damaged or an unsupported filter chain: this stream is skipped
      }
    } else if (data && /\/Filter/.test(dict)) data = undefined; // another filter (LZW, ASCII85...): not read
    objs.set(num, { dict, stream: data });
    re.lastIndex = end + 6;
  }
  // objects inside object streams
  for (const o of [...objs.values()]) {
    if (!/\/Type\s*\/ObjStm/.test(o.dict) || !o.stream) continue;
    const n = parseInt(/\/N\s+(\d+)/.exec(o.dict)?.[1] ?? '0', 10);
    const first = parseInt(/\/First\s+(\d+)/.exec(o.dict)?.[1] ?? '0', 10);
    const txt = dec.decode(o.stream);
    const head = txt
      .slice(0, first)
      .trim()
      .split(/\s+/)
      .map((v) => parseInt(v, 10));
    for (let i = 0; i < n; i++) {
      const id = head[i * 2],
        off = head[i * 2 + 1];
      const next = i + 1 < n ? head[(i + 1) * 2 + 1] : txt.length - first;
      if (!Number.isNaN(id) && !objs.has(id)) objs.set(id, { dict: txt.slice(first + off, first + next) });
    }
  }
  return objs;
}
const trimEol = (b: Uint8Array) => {
  let e = b.length;
  while (e > 0 && (b[e - 1] === 10 || b[e - 1] === 13)) e--;
  return b.subarray(0, e);
};

/** The `/Name N 0 R` pairs inside a resource dictionary entry like /XObject or /Properties. */
function nameMap(dict: string, key: string, objs: Map<number, Obj>): Record<string, number> {
  const out: Record<string, number> = {};
  let sub: string | null = null;
  const direct = new RegExp(`/${key}\\s*<<([^]*?)>>`).exec(dict);
  if (direct) sub = direct[1];
  else {
    const r = refNum(dict, key);
    if (r !== null) sub = objs.get(r)?.dict ?? null;
  }
  if (!sub) return out;
  const re = /\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sub))) out[m[1]] = parseInt(m[2], 10);
  return out;
}

function resourcesOf(dict: string, objs: Map<number, Obj>, depth = 0): string {
  const direct = /\/Resources\s*<<([^]*)>>/.exec(dict);
  if (direct) return direct[1];
  const r = refNum(dict, 'Resources');
  if (r !== null) return objs.get(r)?.dict ?? '';
  const parent = refNum(dict, 'Parent');
  if (parent !== null && depth < 6) return resourcesOf(objs.get(parent)?.dict ?? '', objs, depth + 1);
  return '';
}

function layerName(o: Obj | undefined): string | null {
  const m = /\/Name\s*\(((?:\\.|[^\\)])*)\)/.exec(o?.dict ?? '');
  if (m) return m[1].replace(/\\(.)/g, '$1');
  const hex = /\/Name\s*<([0-9A-Fa-f]+)>/.exec(o?.dict ?? '');
  if (hex) {
    // UTF-16 with a byte order mark
    const bytes = hex[1].match(/../g)!.map((h) => parseInt(h, 16));
    const s = bytes[0] === 0xfe && bytes[1] === 0xff ? bytes.slice(2) : bytes;
    let out = '';
    for (let i = 0; i + 1 < s.length; i += 2) out += String.fromCharCode((s[i] << 8) | s[i + 1]);
    return out || null;
  }
  return null;
}

const TOKEN =
  /\((?:\\.|[^\\)])*\)|<<|>>|\[|\]|\/[^\s/[\]()<>]*|[-+]?(?:\d+\.?\d*|\.\d+)|<[0-9a-fA-F\s]*>|[A-Za-z'"*]+/g;

interface State {
  objs: Map<number, Obj>;
  shapes: Shape[];
  budget: number;
}
interface Gfx {
  ctm: M;
  layer: string | null;
}
type Sub = P[] & { closed?: boolean };

function curve(a: P, b: P, c: P, d: P): P[] {
  const out: P[] = [];
  for (let i = 1; i <= 8; i++) {
    const t = i / 8,
      u = 1 - t;
    out.push([
      u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
    ]);
  }
  return out;
}

/** Walks a content stream: the graphics state (q / Q / cm), the path being built, the layer marks, and form objects (Do). Each operator is one small method. */
class Interpreter {
  private stack: Gfx[] = [];
  private g: Gfx;
  private marks: (string | null)[] = [];
  private ops: string[] = [];
  private path: Sub[] = [];
  private cur: Sub | null = null;
  private at: P = [0, 0];
  private xobjects: Record<string, number>;
  private props: Record<string, number>;
  constructor(
    private state: State,
    private resources: string,
    start: Gfx,
    private depth: number,
  ) {
    this.g = { ...start };
    this.xobjects = nameMap(resources, 'XObject', state.objs);
    this.props = nameMap(resources, 'Properties', state.objs);
  }
  private n(i: number) {
    return parseFloat(this.ops[i] ?? '0');
  }
  private layer(): string {
    for (let i = this.marks.length - 1; i >= 0; i--) if (this.marks[i]) return this.marks[i]!;
    return this.g.layer ?? 'AI';
  }
  private emit(closeAll: boolean): void {
    for (const sub of this.path) {
      if (sub.length < 2) continue;
      const pts = sub.map((p) => apply(this.g.ctm, p));
      // a path that returns to its first point is closed whatever the operator said
      const same = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6;
      if (same && pts.length > 2) pts.pop();
      this.state.shapes.push({ layer: this.layer(), pts, closed: closeAll || sub.closed === true || same });
      this.state.budget--;
    }
    this.path = [];
    this.cur = null;
  }
  private line(x: number, y: number) {
    if (!this.cur) {
      this.cur = [this.at];
      this.path.push(this.cur);
    }
    this.cur.push([x, y]);
    this.at = [x, y];
  }
  private bezier(b: P, c: P, d: P) {
    if (!this.cur) return;
    this.cur.push(...curve(this.at, b, c, d));
    this.at = d;
  }
  private rect() {
    const [x, y, w, h] = [this.n(0), this.n(1), this.n(2), this.n(3)];
    const r: Sub = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ];
    r.closed = true;
    this.path.push(r);
    this.cur = null;
  }
  private begin() {
    // `/OC /MC0 BDC` names an optional-content group (a layer) through the Properties resources
    const tag = this.ops[this.ops.length - 2],
      prop = this.ops[this.ops.length - 1];
    let name: string | null = null;
    if (tag === '/OC' && prop?.startsWith('/')) {
      const id = this.props[prop.slice(1)];
      if (id !== undefined) name = layerName(this.state.objs.get(id));
    }
    this.marks.push(name);
  }
  private form() {
    const name = this.ops[this.ops.length - 1]?.replace(/^\//, '');
    const id = name ? this.xobjects[name] : undefined;
    const o = id !== undefined ? this.state.objs.get(id) : undefined;
    if (!o?.stream || !/\/Subtype\s*\/Form/.test(o.dict) || this.depth >= 6) return;
    const mm = /\/Matrix\s*\[([^\]]*)\]/.exec(o.dict);
    const m: M = mm ? (mm[1].trim().split(/\s+/).map(Number) as unknown as M) : IDENT;
    const res = resourcesOf(o.dict, this.state.objs) || this.resources;
    new Interpreter(this.state, res, { ctm: mul(this.g.ctm, m), layer: this.layer() }, this.depth + 1).run(
      dec.decode(o.stream),
    );
  }
  private operator(op: string): void {
    const n = (i: number) => this.n(i);
    switch (op) {
      case 'q':
        return void this.stack.push({ ...this.g });
      case 'Q':
        return void (this.g = this.stack.pop() ?? this.g);
      case 'cm':
        return void (this.g = { ...this.g, ctm: mul(this.g.ctm, [n(0), n(1), n(2), n(3), n(4), n(5)]) });
      case 'm':
        this.cur = [[n(0), n(1)]];
        this.path.push(this.cur);
        this.at = [n(0), n(1)];
        return;
      case 'l':
        return this.line(n(0), n(1));
      case 'c':
        return this.bezier([n(0), n(1)], [n(2), n(3)], [n(4), n(5)]);
      case 'v':
        return this.bezier(this.at, [n(0), n(1)], [n(2), n(3)]);
      case 'y':
        return this.bezier([n(0), n(1)], [n(2), n(3)], [n(2), n(3)]);
      case 'h':
        if (this.cur) this.cur.closed = true;
        return;
      case 're':
        return this.rect();
      case 'S':
      case 'B':
      case 'B*':
        return this.emit(false);
      case 's':
      case 'b':
      case 'b*':
      case 'f':
      case 'F':
      case 'f*':
        return this.emit(true);
      case 'n':
        this.path = [];
        this.cur = null;
        return;
      case 'BDC':
        return this.begin();
      case 'BMC':
        return void this.marks.push(null);
      case 'EMC':
        return void this.marks.pop();
      case 'Do':
        return this.form();
      default:
    }
  }
  run(content: string): void {
    for (const t of content.matchAll(TOKEN)) {
      if (this.state.budget <= 0) return;
      const tok = t[0];
      if (/^[A-Za-z'"*]/.test(tok) && !/^\/|^</.test(tok)) {
        this.operator(tok);
        this.ops = [];
      } else this.ops.push(tok);
    }
  }
}

function run(state: State, content: string, resources: string, start: Gfx, depth: number): void {
  new Interpreter(state, resources, start, depth).run(content);
}

/** Reads an Illustrator (PDF compatible) file. */
export function parseAi(bytes: Uint8Array, fileName: string): Drawing {
  const head = dec.decode(bytes.subarray(0, 1024));
  if (!head.includes('%PDF')) {
    if (head.includes('%!PS')) {
      throw new DrawingError(
        'ai-no-pdf',
        'This Illustrator file was saved without PDF content. Open it in Illustrator and save again with "Create PDF Compatible File", or export it as DXF.',
      );
    }
    throw new DrawingError('broken', 'This does not look like an Illustrator file.');
  }
  const raw = dec.decode(bytes);
  const objs = readObjects(raw, bytes);
  // the first page that has content
  let page: Obj | undefined;
  for (const o of objs.values()) {
    if (/\/Type\s*\/Page\b(?!s)/.test(o.dict) && /\/Contents/.test(o.dict)) {
      page = o;
      break;
    }
  }
  if (!page) throw new DrawingError('ai-empty', 'No drawing was found in this file.');
  const refs: number[] = [];
  const arr = /\/Contents\s*\[([^\]]*)\]/.exec(page.dict);
  if (arr) for (const m of arr[1].matchAll(/(\d+)\s+\d+\s+R/g)) refs.push(parseInt(m[1], 10));
  else {
    const one = refNum(page.dict, 'Contents');
    if (one !== null) refs.push(one);
  }
  const content = refs.map((r) => (objs.get(r)?.stream ? dec.decode(objs.get(r)!.stream!) : '')).join('\n');
  const state: State = { objs, shapes: [], budget: 400000 };
  run(state, content, resourcesOf(page.dict, objs), { ctm: IDENT, layer: null }, 0);
  if (!state.shapes.length) throw new DrawingError('ai-empty', 'No lines or shapes were found in this file.');
  return {
    fileName,
    format: 'ai',
    unitCode: null,
    blocks: new Map(),
    shapes: state.shapes,
    texts: [],
    inserts: [],
    skipped: {},
  };
}
