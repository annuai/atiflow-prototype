// Slims an ERP BOM export into the dummy "Import from API" catalogue.
// Usage: npm run build:dummy-erp -- <all_bom_formatted.json>   (writes public/dummy-api/materials.json)
// Keeps what the Master Data list needs (code, name, group, type); drops quantities and components (the BOM view is not used yet).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run build:dummy-erp -- <bom.json>');
  process.exit(1);
}
const out = fileURLToPath(new URL('../public/dummy-api/materials.json', import.meta.url));
const bom = JSON.parse(readFileSync(input, 'utf8'));
const seen = new Set();
const groups = [];
const groupIdx = new Map();
const rows = [];
for (const b of bom) {
  const code = String(b.material_code ?? '').trim();
  if (!code || seen.has(code)) continue;
  seen.add(code);
  const g = String(b.material_group ?? '').trim();
  if (!groupIdx.has(g)) groupIdx.set(g, groups.push(g) - 1);
  rows.push([
    code,
    String(b.material_desc ?? '').trim() || code,
    groupIdx.get(g),
    String(b.material_type ?? '').trim(),
  ]);
}
rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ v: 1, groups, rows }));
console.log(`${rows.length} materials, ${groups.length} groups -> ${out}`);
