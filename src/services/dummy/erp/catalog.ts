import type { ErpQuery, ErpResult, ErpRow } from '@/features/master-data/sources/types';

/** The slim file written by `npm run build:dummy-erp` (public/dummy-api/materials.json). */
export interface CatalogFile {
  v: 1;
  groups: string[];
  /** [code, name, index into groups, type] */
  rows: [string, string, number, string][];
}

export interface Catalog {
  readonly size: number;
  search(q: ErpQuery): ErpResult;
  all(q: Omit<ErpQuery, 'limit' | 'offset'>): ErpRow[];
}

/**
 * The searchable catalogue. Pure (no DOM, no worker), so it can be tested and could also run on a server. Search keys are lowercased once; a query is one pass over them
 * (every word typed must appear in code, name or group; the prefix applies to the code). Rows stay in code order.
 */
export function createCatalog(file: CatalogFile): Catalog {
  const { groups, rows } = file;
  const hay = rows.map((r) => `${r[0]}\n${r[1]}\n${groups[r[2]]}`.toLowerCase());
  const codeLower = rows.map((r) => r[0].toLowerCase());
  const toRow = (i: number): ErpRow => ({
    code: rows[i][0],
    name: rows[i][1],
    group: groups[rows[i][2]],
    type: rows[i][3] || undefined,
  });
  const matches = (q: { text: string; prefix: string }, visit: (i: number) => boolean | void) => {
    const words = q.text.toLowerCase().split(/\s+/).filter(Boolean);
    const prefix = q.prefix.trim().toLowerCase();
    for (let i = 0; i < rows.length; i++) {
      if (prefix && !codeLower[i].startsWith(prefix)) continue;
      if (words.length && !words.every((w) => hay[i].includes(w))) continue;
      if (visit(i) === false) return;
    }
  };
  return {
    size: rows.length,
    search(q) {
      const offset = q.offset ?? 0;
      const out: ErpRow[] = [];
      let total = 0;
      matches(q, (i) => {
        if (total >= offset && out.length < q.limit) out.push(toRow(i));
        total++;
      });
      return { total, rows: out };
    },
    all(q) {
      const out: ErpRow[] = [];
      matches(q, (i) => void out.push(toRow(i)));
      return out;
    },
  };
}
