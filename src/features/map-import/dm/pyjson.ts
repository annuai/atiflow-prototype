/**
 * JSON the way the Deployment Manager (Python) writes it, so a file we change differs from the original only where we changed it: `json.dumps(indent=n)` puts every array item on its own line,
 * writes `: ` after keys, floats that are whole numbers as `1.0` (a plain JS number would lose the `.0`), and non-ASCII text as \\uXXXX. `parsePy` keeps the text of those whole floats;
 * `stringifyPy` writes them back. Objects are Maps (to keep key order); the rest is ordinary JSON.
 */
export class PyFloat {
  constructor(
    readonly value: number,
    readonly text: string,
  ) {}
}
/** A number to write as a float (`5` as `5.0`), the way Python writes the positions and lengths of a map. */
export const pyFloat = (v: number): number | PyFloat => (Number.isInteger(v) ? new PyFloat(v, v.toFixed(1)) : v);
/** The plain number inside a value read by `parsePy`. */
export const num = (v: unknown): number => (v instanceof PyFloat ? v.value : (v as number));

/** An object keeps the order of its keys (Python's does; a JS object puts numeric keys first), so objects are Maps. */
export type PyObj = Map<string, PyValue>;
export type PyValue = null | boolean | number | string | PyFloat | PyValue[] | PyObj;

/** Reads JSON text. Whole-number floats (`0.0`, `3.0`, `1e5`) become `PyFloat`s that remember how they were written. */
export function parsePy(text: string): PyValue {
  let i = 0;
  const ws = () => {
    while (i < text.length && ' \n\r\t'.includes(text[i])) i++;
  };
  const value = (): PyValue => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++;
      const o: PyObj = new Map();
      ws();
      if (text[i] === '}') return (i++, o);
      for (;;) {
        ws();
        const k = str();
        ws();
        i++; // :
        o.set(k, value());
        ws();
        if (text[i++] === '}') return o;
      }
    }
    if (c === '[') {
      i++;
      const a: PyValue[] = [];
      ws();
      if (text[i] === ']') return (i++, a);
      for (;;) {
        a.push(value());
        ws();
        if (text[i++] === ']') return a;
      }
    }
    if (c === '"') return str();
    if (text.startsWith('true', i)) return ((i += 4), true);
    if (text.startsWith('false', i)) return ((i += 5), false);
    if (text.startsWith('null', i)) return ((i += 4), null);
    if (text.startsWith('NaN', i) || text.startsWith('Infinity', i) || text.startsWith('-Infinity', i))
      throw new Error('NaN and Infinity are not supported');
    const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i, i + 40));
    if (!m) throw new Error(`Unexpected character at ${i}`);
    i += m[0].length;
    const v = Number(m[0]);
    return Number.isInteger(v) && /[.eE]/.test(m[0]) ? new PyFloat(v, m[0]) : v;
  };
  const str = (): string => {
    let j = i + 1;
    while (text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
    const s = JSON.parse(text.slice(i, j + 1)) as string;
    i = j + 1;
    return s;
  };
  const out = value();
  ws();
  if (i < text.length) throw new Error('Unexpected text after the JSON');
  return out;
}

const esc = (s: string) =>
  JSON.stringify(s).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
/** Python's float text for a JS number (JS and Python agree for everything but exponents, which maps do not use). */
const numText = (n: number) => (Number.isInteger(n) ? String(n) : String(n));

/** Writes JSON like `json.dumps(value, indent=indent)`. */
export function stringifyPy(v: PyValue, indent = 4): string {
  const go = (x: PyValue, level: number): string => {
    if (x === null) return 'null';
    if (typeof x === 'boolean') return x ? 'true' : 'false';
    if (typeof x === 'number') return numText(x);
    if (x instanceof PyFloat) return x.text;
    if (typeof x === 'string') return esc(x);
    const pad = ' '.repeat(indent * (level + 1)),
      end = ' '.repeat(indent * level);
    if (Array.isArray(x)) return x.length ? `[\n${x.map((e) => pad + go(e, level + 1)).join(',\n')}\n${end}]` : '[]';
    return x.size ? `{\n${[...x].map(([k, e]) => `${pad}${esc(k)}: ${go(e, level + 1)}`).join(',\n')}\n${end}}` : '{}';
  };
  return go(v, 0);
}

/** The indent a file was written with (the first indented line), 4 when there is none. */
export const indentOf = (text: string): number => /\n( +)\S/.exec(text)?.[1].length ?? 4;
