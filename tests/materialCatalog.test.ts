import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCatalog, type CatalogFile } from '../src/services/dummy/erp/catalog';
import { createDummyMaterialSource } from '../src/services/dummy/erp';
import { mergeMaterials } from '../src/features/master-data/model/logic';
import { classifyRows } from '../src/features/master-data/import/review';

const FILE = new URL('../public/dummy-api/materials.json', import.meta.url);
const data = JSON.parse(readFileSync(FILE, 'utf8')) as CatalogFile;
const catalog = createCatalog(data);

describe('dummy ERP catalogue (public/dummy-api/materials.json)', () => {
  it('holds the whole BOM export, one row per material code', () => {
    expect(catalog.size).toBe(47_046);
    expect(new Set(data.rows.map((r) => r[0])).size).toBe(47_046);
  });
  it('pages: total is the whole match count, pages do not overlap', () => {
    const a = catalog.search({ text: '', prefix: '', limit: 100 });
    const b = catalog.search({ text: '', prefix: '', limit: 100, offset: 100 });
    expect(a.total).toBe(47_046);
    expect(a.rows).toHaveLength(100);
    expect(new Set([...a.rows, ...b.rows].map((r) => r.code)).size).toBe(200);
    expect(catalog.search({ text: '', prefix: '', limit: 100, offset: 47_000 }).rows).toHaveLength(46);
  });
  it('code prefix and words (all must match, any of code / name / group)', () => {
    const rm = catalog.search({ text: '', prefix: 'rm64104', limit: 10 });
    expect(rm.rows[0]).toMatchObject({ code: 'RM64104', name: 'RM64104 Master Compound', group: '1CO1' });
    const words = catalog.search({ text: 'master compound 1co1', prefix: '', limit: 5 });
    expect(words.total).toBeGreaterThan(0);
    expect(words.rows.every((r) => r.group === '1CO1' && /master compound/i.test(r.name))).toBe(true);
  });
  it('all() returns every match for select-all', () => {
    const q = { text: '', prefix: 'RM6' };
    expect(catalog.all(q)).toHaveLength(catalog.search({ ...q, limit: 1 }).total);
  });
  it('a query over the whole catalogue is fast (main thread safe too)', () => {
    const t = performance.now();
    for (let i = 0; i < 20; i++) catalog.search({ text: 'compound', prefix: '', limit: 100 });
    expect((performance.now() - t) / 20).toBeLessThan(50);
  });
  it('the adapter answers through the same contract (no worker in tests)', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify(data))) as typeof fetch;
    try {
      const src = createDummyMaterialSource({ url: 'x', latencyMs: 0 });
      expect((await src.search({ text: '', prefix: 'RM7894', limit: 5 })).rows[0].code).toBe('RM7894');
      expect((await src.all({ text: '', prefix: 'RM7894' })).length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe('importing the whole catalogue stays quick', () => {
  const incoming = catalog
    .all({ text: '', prefix: '' })
    .map((r) => ({ code: r.code, name: r.name, groupName: r.group }));
  it('merges 47k materials in well under a second and makes one group per code', () => {
    const t = performance.now();
    const r = mergeMaterials([], [], incoming, 1);
    expect(performance.now() - t).toBeLessThan(1000);
    expect(r.added).toBe(47_046);
    expect(r.groups).toHaveLength(data.groups.length);
    // the same import again adds nothing
    expect(mergeMaterials(r.materials, r.groups, incoming, 2).added).toBe(0);
  });
  it('classifying 47k file rows is not quadratic', () => {
    const t = performance.now();
    const rows = classifyRows(
      incoming,
      incoming.slice(0, 20_000).map((r) => r.code),
    );
    expect(performance.now() - t).toBeLessThan(1000);
    expect(rows.filter((r) => r.status === 'added')).toHaveLength(20_000);
  });
});
