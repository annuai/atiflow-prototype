import type { PyObj, PyValue } from '../pyjson';
import { maxNum, num, obj, pt, put, str, xy } from '../tree';
import { HEADING, near, type LineChange, type P, type V5 } from './context';

/** The file nodes that lie on the line t1 -> t2, in order along it. */
function nodesOn(c: V5, t1: P, t2: P): string[] {
  const dx = t2[0] - t1[0],
    dy = t2[1] - t1[1],
    l2 = dx * dx + dy * dy;
  const on: { t: number; id: string }[] = [];
  for (const [id, v] of c.nodesInfo) {
    const p = xy(obj(v).get('pos'));
    const t = l2 ? ((p[0] - t1[0]) * dx + (p[1] - t1[1]) * dy) / l2 : 0;
    const q: P = [t1[0] + t * dx, t1[1] + t * dy];
    if (t > -1e-6 && t < 1 + 1e-6 && Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.02) on.push({ t, id });
  }
  return on.sort((a, b) => a.t - b.t).map((o) => o.id);
}

const connections = (): PyValue =>
  new Map<string, PyValue>([
    ['0', new Map()],
    ['1', new Map()],
  ]);

/** Lines that exist in the file: moved, turned the other way, one-way / two-way changed, renamed, or gone (no road has their id any more). */
function syncExisting(c: V5, changes: LineChange[]) {
  const byExt = new Map(c.groups.filter((g) => g.ext !== undefined).map((g) => [g.ext!, g]));
  const removed: string[] = [];
  for (const [id, line] of [...c.lines]) {
    const m = obj(line);
    const g = byExt.get(id);
    const was: [P, P] = [xy(m.get('t1')), xy(m.get('t2'))];
    if (!g) {
      changes.push({ id, oldChain: nodesOn(c, ...was) });
      removed.push(id);
      continue;
    }
    const moved = !near(was[0], g.t1) || !near(was[1], g.t2);
    const dir = m.get('bidirectional') !== !g.oneWay || str(m.get('heading_direction')) !== HEADING[g.heading];
    if (moved || dir) changes.push({ id, oldChain: nodesOn(c, ...was), group: g });
    if (moved) {
      put(c.gmaj, m, 't1', pt(...g.t1));
      put(c.gmaj, m, 't2', pt(...g.t2));
    }
    put(c.gmaj, m, 'bidirectional', !g.oneWay);
    put(c.gmaj, m, 'heading_direction', HEADING[g.heading]);
    if (g.name) put(c.gmaj, m, 'lane_name', g.name);
  }
  for (const id of removed) {
    c.lines.delete(id);
    c.gmaj.dirty = true;
  }
  return removed;
}

/** Roads the file has no line for (drawn here): a new line each, and the road remembers its id so the next export finds it. */
function addNew(c: V5, changes: LineChange[], next: () => number) {
  for (const g of c.groups.filter((q) => q.ext === undefined || !c.lines.has(q.ext))) {
    const id = String(next());
    changes.push({ id, oldChain: [], group: g });
    for (const r of g.roads) r.extra = { ...r.extra, dm: { ...(r.extra?.dm as object), externalId: id } };
    c.lines.set(
      id,
      new Map<string, PyValue>([
        ['id', Number(id)],
        ['t1', pt(...g.t1)],
        ['t2', pt(...g.t2)],
        ['lane_name', g.name],
        ['regime', 'default'],
        ['related_lines', connections()],
        ['pre_segment_action', null],
        ['bidirectional', !g.oneWay],
        ['bidirectional_line', null],
        ['heading_direction', HEADING[g.heading]],
        ['custom_weight', null],
      ]),
    );
    c.gmaj.dirty = true;
  }
}

/** `grid_map_attributes.json` holds the same lines (related lines as a list of three) and a reverse line for every two-way line. */
function syncAttributes(c: V5, removed: string[], next: () => number) {
  const { attrs, attrLines } = c;
  if (!attrs) return;
  const reverseOf = new Map<string, string>();
  for (const [rid, l] of attrLines) {
    const of = obj(l).get('bidirectional_line');
    if (of !== null && of !== undefined) reverseOf.set(String(num(of)), rid);
  }
  for (const id of removed) {
    attrLines.delete(id);
    const r = reverseOf.get(id);
    if (r) attrLines.delete(r);
    attrs.dirty = true;
  }
  for (const [id, line] of c.lines) {
    const g = obj(line);
    const t1 = xy(g.get('t1')),
      t2 = xy(g.get('t2'));
    const two = g.get('bidirectional') === true;
    if (!attrLines.has(id)) {
      const copy = new Map(g) as PyObj;
      copy.set('related_lines', [
        obj(obj(g.get('related_lines')).get('0')),
        obj(obj(g.get('related_lines')).get('1')),
        new Map(),
      ]);
      attrLines.set(id, copy);
      attrs.dirty = true;
    } else {
      for (const k of ['t1', 't2', 'bidirectional', 'heading_direction', 'lane_name'] as const)
        put(attrs, obj(attrLines.get(id)), k, g.get(k) as PyValue);
    }
    const rid = reverseOf.get(id);
    if (two && !rid) {
      const nid = String(next());
      attrLines.set(
        nid,
        new Map<string, PyValue>([
          ['id', Number(nid)],
          ['t1', pt(...t2)],
          ['t2', pt(...t1)],
          ['lane_name', g.get('lane_name') ?? ''],
          ['regime', 'default'],
          ['related_lines', [new Map(), new Map(), new Map()]],
          ['pre_segment_action', null],
          ['bidirectional', true],
          ['bidirectional_line', Number(id)],
          ['heading_direction', g.get('heading_direction') ?? 'both'],
          ['custom_weight', null],
        ]),
      );
      attrs.dirty = true;
    } else if (!two && rid) {
      attrLines.delete(rid);
      attrs.dirty = true;
    } else if (two && rid) {
      const r = obj(attrLines.get(rid));
      put(attrs, r, 't1', pt(...t2));
      put(attrs, r, 't2', pt(...t1));
    }
  }
}

/**
 * The lines that changed meet other lines at their ends: forget every link to a line that went or changed, then link what now meets each changed line (both ways). Links of lines nobody
 * touched stay exactly as the file has them (the Deployment Manager keeps these links itself and they do not always follow the geometry).
 */
function relate(c: V5, changes: LineChange[]) {
  const touched = new Set(changes.map((q) => q.id));
  if (!touched.size) return;
  const rel = (m: PyObj) => obj(m.get('related_lines'));
  for (const [, l] of c.lines)
    for (const key of ['0', '1'])
      for (const k of [...obj(rel(obj(l)).get(key)).keys()]) if (touched.has(k)) obj(rel(obj(l)).get(key)).delete(k);
  const link = (terminal: string): PyValue =>
    new Map<string, PyValue>([
      ['terminal', terminal],
      ['radius', null],
    ]);
  for (const id of touched) {
    const m = c.lines.has(id) ? obj(c.lines.get(id)) : null;
    if (!m) continue;
    for (const [key, end] of [
      ['0', 't1'],
      ['1', 't2'],
    ] as const) {
      const here = xy(m.get(end));
      const mine = obj(rel(m).get(key));
      mine.clear();
      for (const [oid, ol] of c.lines) {
        if (oid === id) continue;
        const o = obj(ol);
        for (const t of ['t1', 't2'] as const) {
          if (!near(here, xy(o.get(t)), 0.05)) continue;
          mine.set(oid, link(t));
          obj(rel(o).get(t === 't1' ? '0' : '1')).set(id, link(end));
        }
      }
    }
    c.gmaj.dirty = true;
  }
  if (c.attrs)
    for (const [id, l] of c.lines) {
      const a = obj(c.attrLines.get(id));
      if (!a.size) continue;
      put(c.attrs, a, 'related_lines', [obj(rel(obj(l)).get('0')), obj(rel(obj(l)).get('1')), new Map()]);
    }
}

/** Brings the lines of both files up to date with our roads; returns what changed (the graph is patched from it). */
export function patchLines(c: V5): LineChange[] {
  const changes: LineChange[] = [];
  const removed = syncExisting(c, changes);
  let last = Math.max(maxNum(c.lines.keys()), maxNum(c.attrLines.keys()));
  const next = () => ++last;
  addNew(c, changes, next);
  syncAttributes(c, removed, next);
  relate(c, changes);
  return changes;
}
