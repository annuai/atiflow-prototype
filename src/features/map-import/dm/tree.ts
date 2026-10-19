import { parsePy, stringifyPy, indentOf, pyFloat, PyFloat, type PyObj, type PyValue } from './pyjson';

/** A Deployment Manager JSON file opened for patching: `dirty` becomes true only when something really changed, so untouched files stay byte for byte. */
export interface Doc {
  key: string;
  tree: PyObj;
  indent: number;
  dirty: boolean;
}
const dec = (b: Uint8Array) => new TextDecoder().decode(b);
const enc = (s: string) => new TextEncoder().encode(s);

export function openDoc(files: Record<string, Uint8Array>, key: string): Doc | null {
  if (!files[key]) return null;
  try {
    const text = dec(files[key]);
    const tree = parsePy(text);
    return tree instanceof Map ? { key, tree, indent: indentOf(text), dirty: false } : null;
  } catch {
    return null; // damaged: left byte for byte
  }
}
export function commit(files: Record<string, Uint8Array>, d: Doc | null) {
  if (d?.dirty) files[d.key] = enc(stringifyPy(d.tree, d.indent));
}

export const obj = (v: PyValue | undefined): PyObj => (v instanceof Map ? v : new Map());
export const list = (v: PyValue | undefined): PyValue[] => (Array.isArray(v) ? v : []);
export const num = (v: PyValue | undefined): number =>
  v instanceof PyFloat ? v.value : typeof v === 'number' ? v : NaN;
export const str = (v: PyValue | undefined): string => (typeof v === 'string' ? v : '');
export const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** A coordinate as the Deployment Manager writes it: three decimals, whole numbers as `5.0`. */
export const co = (v: number): PyValue => pyFloat(r3(v));
export const pt = (x: number, y: number): PyValue => [co(x), co(y)];
export const xy = (v: PyValue | undefined): [number, number] => {
  const a = list(v);
  return [num(a[0]), num(a[1])];
};

/** Same value (a whole float and the same number are equal; objects compare by content). */
export function same(a: PyValue | undefined, b: PyValue | undefined): boolean {
  if (a instanceof PyFloat || typeof a === 'number' || b instanceof PyFloat || typeof b === 'number')
    return num(a) === num(b);
  if (a instanceof Map && b instanceof Map)
    return a.size === b.size && [...a].every(([k, v]) => b.has(k) && same(v, b.get(k)));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  return a === b;
}
/** Set a key when its value really differs (marks the document changed). */
export function put(d: Doc, m: PyObj, key: string, value: PyValue) {
  if (!m.has(key) || !same(m.get(key), value)) {
    m.set(key, value);
    d.dirty = true;
  }
}
export function drop(d: Doc, m: PyObj, key: string) {
  if (m.delete(key)) d.dirty = true;
}
/** Rename a key keeping its place in the order. */
export function rekey(d: Doc, m: PyObj, from: string, to: string) {
  if (from === to || !m.has(from)) return;
  const entries = [...m].map(([k, v]) => [k === from ? to : k, v] as [string, PyValue]);
  m.clear();
  for (const [k, v] of entries) m.set(k, v);
  d.dirty = true;
}
export const maxNum = (keys: Iterable<string>, prefix = ''): number =>
  Math.max(0, ...[...keys].map((k) => parseInt(k.slice(prefix.length), 10) || 0));
