import { ACCEPTED_EXTENSIONS, IMPORT_COLUMNS, MAX_FILE_BYTES, mapHeaders } from './columns';
import { copy } from '../copy';
import type { IncomingMaterial } from '../model/types';

export type ParseOutcome = { ok: true; rows: IncomingMaterial[] } | { ok: false; title: string; message: string };

/** Minimal RFC-4180 CSV reader: quoted cells, escaped quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      out.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim()));
}

/** Turn a table (first row = headers) into material rows, or explain what is wrong with it. */
export function tableToMaterials(table: unknown[][]): ParseOutcome {
  if (table.length === 0) return { ok: false, ...copy.upload.errors.empty };
  const keys = mapHeaders(table[0]);
  const missing = IMPORT_COLUMNS.filter((c) => c.required && !keys.includes(c.key));
  if (missing.length)
    return {
      ok: false,
      title: copy.upload.errors.columns.title,
      message: copy.upload.errors.columns.message(missing.map((c) => c.header)),
    };
  const rows = table
    .slice(1)
    .map((cells) => {
      const r: Record<string, string> = {};
      keys.forEach((k, i) => {
        if (k) r[k] = String(cells[i] ?? '').trim();
      });
      return r as unknown as IncomingMaterial;
    })
    .filter((r) => r.code || r.name);
  return rows.length ? { ok: true, rows } : { ok: false, ...copy.upload.errors.empty };
}

const extOf = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase();

/** Read a CSV or XLSX file. `onProgress` reports 0-100 while the file is being read. */
export async function parseMaterialFile(file: File, onProgress: (pct: number) => void): Promise<ParseOutcome> {
  if (!ACCEPTED_EXTENSIONS.includes(extOf(file.name))) return { ok: false, ...copy.upload.errors.format };
  if (file.size > MAX_FILE_BYTES) return { ok: false, ...copy.upload.errors.size };
  try {
    if (extOf(file.name) === '.csv') {
      const text = await new Promise<string>((resolve, reject) => {
        const rd = new FileReader();
        rd.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
        rd.onload = () => resolve(String(rd.result));
        rd.onerror = () => reject(rd.error);
        rd.readAsText(file);
      });
      onProgress(100);
      return tableToMaterials(parseCsv(text));
    }
    const { readSheet } = await import('read-excel-file/browser');
    onProgress(50);
    const table = await readSheet(file);
    onProgress(100);
    return tableToMaterials(table as unknown[][]);
  } catch {
    return { ok: false, ...copy.upload.errors.format };
  }
}
