import type { ErpQuery, ErpResult, ErpRow, MaterialSource } from './types';

/**
 * MOCK ERP. A real integration replaces this file only. The catalogue is generated (a few explicit rows from the design, the rest
 * built from word lists) so there is no big literal: TOTAL rows, searchable by name / code and filterable by code prefix.
 */
const TOTAL = 128_872;
const FEATURED: ErpRow[] = [
  { code: 'DCP-1001', name: 'Drive Chain Pin 8mm', group: 'Fasteners & Fixings' },
  { code: 'DCP-1002', name: 'Drive Chain Plate 12mm', group: 'Sub-Assemblies' },
  { code: 'DCP-1003', name: 'Chain Sprocket 24T', group: 'Sub-Assemblies' },
  { code: 'DCP-1004', name: 'DC Power Cable 2m', group: 'Electrical' },
  { code: 'DCP-1005', name: 'Drive Coupling Pad', group: 'Consumables' },
  { code: 'DCP-1006', name: 'Dust Cover Panel', group: 'Packaging' },
  { code: 'MAT-1001', name: 'Steel Bracket 40mm', group: 'Fasteners & Fixings' },
  { code: 'MAT-1002', name: 'Hex Bolt M8×30', group: 'Fasteners & Fixings' },
  { code: 'MAT-1003', name: 'Carton Box 600×400', group: 'Packaging' },
  { code: 'MAT-1004', name: 'Engine Mount Assy', group: 'Sub-Assemblies' },
];
// 'DCP' only exists in the featured rows, so filtering by it returns exactly those six (as in the design)
const PREFIXES = ['MAT', 'FST', 'PKG', 'ELC', 'RAW', 'SEA', 'PNT'];
const NOUNS = [
  'Bracket',
  'Bolt',
  'Washer',
  'Cable',
  'Gasket',
  'Panel',
  'Sprocket',
  'Bearing',
  'Coupling',
  'Carton',
  'Film',
  'Sheet',
  'Harness',
  'Seal',
];
const SPECS = ['6mm', '8mm', '10mm', '12mm', '16mm', '24T', '2m', '600×400', 'Type A', 'Type B', 'HD', 'Std'];
const GROUPS = [
  'Fasteners & Fixings',
  'Packaging',
  'Sub-Assemblies',
  'Consumables',
  'Electrical',
  'Raw Materials',
  'Seals & Gaskets',
  'Paint & Coatings',
];
const LATENCY_MS = 250;

let cache: ErpRow[] | null = null;
function catalogue(): ErpRow[] {
  if (cache) return cache;
  const used = new Set(FEATURED.map((r) => r.code));
  const rows = [...FEATURED];
  let i = 0;
  while (rows.length < TOTAL) {
    const prefix = PREFIXES[i % PREFIXES.length];
    const n = 2000 + Math.floor(i / PREFIXES.length);
    const code = `${prefix}-${n}`;
    if (!used.has(code))
      rows.push({
        code,
        name: `${NOUNS[i % NOUNS.length]} ${SPECS[Math.floor(i / NOUNS.length) % SPECS.length]}`,
        group: GROUPS[(i * 5) % GROUPS.length],
      });
    i++;
  }
  return (cache = rows);
}

export function searchCatalogue(q: ErpQuery): ErpResult {
  const text = q.text.trim().toLowerCase();
  const prefix = q.prefix.trim().toLowerCase();
  const rows: ErpRow[] = [];
  let total = 0;
  for (const r of catalogue()) {
    if (prefix && !r.code.toLowerCase().startsWith(prefix)) continue;
    if (
      text &&
      !(
        r.name.toLowerCase().includes(text) ||
        r.code.toLowerCase().includes(text) ||
        r.group.toLowerCase().includes(text)
      )
    )
      continue;
    total++;
    if (rows.length < q.limit) rows.push(r);
  }
  return { total, rows };
}

export const mockErp: MaterialSource = {
  search: (q) => new Promise((resolve) => setTimeout(() => resolve(searchCatalogue(q)), LATENCY_MS)),
};
