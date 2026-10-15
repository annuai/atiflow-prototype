import { describe, expect, it } from 'vitest';
import { buildArea, countState, toggleBlocked, totalCells, utilised } from '../src/features/master-data/model/areas';
import { classifyRows } from '../src/features/master-data/import/review';
import {
  closedFlow,
  flowReducer,
  stepNumber,
  type FlowAction,
  type FlowState,
} from '../src/features/master-data/import/flow';
import { mapHeaders, templateCsv } from '../src/features/master-data/import/columns';
import { parseCsv, tableToMaterials } from '../src/features/master-data/import/parseFile';
import {
  codesForFleet,
  ensureGroup,
  filterGroups,
  filterMaterials,
  groupCount,
  mergeMaterials,
  validateGroup,
  validateMaterial,
} from '../src/features/master-data/model/logic';
import { seedAreas, seedGroups, seedMaterials } from '../src/features/master-data/model/seed';
import { searchCatalogue } from '../src/features/master-data/sources/mockCatalog';
import { parsePrompt, resolveMaterial } from '../src/features/workflow-builder/model/parsePrompt';
import { fleetsUsingMaterial } from '../src/features/workflow-builder/model/usage';
import { createNode, createStart } from '../src/features/workflow-builder/model/factory';
import { timeAgo } from '../src/utils/timeAgo';

const NOW = 1_700_000_000_000;
const groups = seedGroups(NOW);
const materials = seedMaterials(NOW, groups);

describe('master data: merging and validation', () => {
  it('seed: six materials assigned to fleets, groups resolved', () => {
    expect(materials).toHaveLength(6);
    expect(materials.every((m) => m.group && m.fleets.length)).toBe(true);
  });
  it('mergeMaterials skips existing codes (any case) and never touches existing rows', () => {
    const r = mergeMaterials(
      materials,
      groups,
      [
        { code: 'dcp-1001', name: 'Dup' },
        { code: 'NEW-1', name: 'New', groupName: 'Packaging' },
      ],
      NOW + 1,
    );
    expect(r.added).toBe(1);
    expect(r.materials).toHaveLength(7);
    expect(r.materials[0]).toBe(materials[0]);
    expect(r.materials[6].group).toBe(groups.find((g) => g.name === 'Packaging')!.id);
    expect(r.materials[6].fleets).toEqual([]);
  });
  it('unknown group names create a group once (ignoring case)', () => {
    const a = ensureGroup(groups, 'Tooling', NOW);
    const b = ensureGroup(a.groups, 'tooling', NOW);
    expect(a.groups).toHaveLength(groups.length + 1);
    expect(b.groups).toBe(a.groups);
    expect(a.id).toBe(b.id);
  });
  it('validateMaterial: required + unique code, edit mode skips uniqueness', () => {
    expect(validateMaterial({ name: '', code: '' }, materials)).toEqual({
      name: 'Material name is required',
      code: 'Material code is required',
    });
    expect(validateMaterial({ name: 'x', code: ' dcp-1002 ' }, materials).code).toMatch(/already exists/);
    expect(validateMaterial({ name: 'x', code: 'DCP-1002' }, materials, 'DCP-1002')).toEqual({});
  });
  it('validateGroup: unique name, no spaces in prefix', () => {
    expect(validateGroup({ name: 'packaging', prefix: '' }, groups).name).toMatch(/already exists/);
    expect(
      validateGroup({ name: 'Packaging', prefix: '' }, groups, groups.find((g) => g.name === 'Packaging')!.id),
    ).toEqual({});
    expect(validateGroup({ name: 'Tools', prefix: 'A B' }, groups).prefix).toBeTruthy();
  });
});

describe('master data: lists and fleet assignment', () => {
  it('filters by text (code, name, group name) and group id', () => {
    expect(filterMaterials(materials, groups, { text: 'sprocket', group: '' })).toHaveLength(1);
    expect(filterMaterials(materials, groups, { text: 'electrical', group: '' }).map((m) => m.code)).toEqual([
      'DCP-1004',
    ]);
    const sub = groups.find((g) => g.name === 'Sub-Assemblies')!.id;
    expect(filterMaterials(materials, groups, { text: '', group: sub })).toHaveLength(2);
  });
  it('group counts are derived; scope filter works', () => {
    const empty = groups.find((g) => g.name === 'Paint & Coatings')!;
    expect(groupCount(materials, empty.id)).toBe(0);
    expect(filterGroups(groups, materials, { text: '', scope: 'empty' }).map((g) => g.name)).toContain(
      'Paint & Coatings',
    );
    expect(filterGroups(groups, materials, { text: '', scope: 'used' }).map((g) => g.name)).not.toContain(
      'Paint & Coatings',
    );
    expect(filterGroups(groups, materials, { text: 'pkg', scope: 'all' })).toHaveLength(1);
  });
  it('only materials assigned to a fleet are offered to its workflows', () => {
    expect(codesForFleet(materials, 'Line Side Fleet')).toEqual(['DCP-1001', 'DCP-1002', 'DCP-1003', 'DCP-1004']);
    expect(codesForFleet(materials, 'Assembly Fleet')).toEqual(['DCP-1005', 'DCP-1006']);
    expect(codesForFleet(materials, 'Nobody')).toEqual([]);
  });
  it('the Ati AI parser resolves materials from the fleet list only', () => {
    const codes = codesForFleet(materials, 'Line Side Fleet');
    expect(resolveMaterial('material dcp 1003', codes)).toBe('DCP-1003');
    expect(resolveMaterial('material 1004', codes)).toBe('DCP-1004');
    expect(resolveMaterial('material 9999', codes)).toBe('DCP-1001');
    expect(resolveMaterial('material 1', [])).toBe('');
    const steps = parsePrompt('material 1002 25 units, if quantity less than 5 go to S103', codes);
    expect(steps[0].f.code).toBe('DCP-1002');
    expect(steps[0].f.qty).toBe('25');
    expect(steps[1].f.material).toBe('DCP-1002');
  });
});

describe('master data: file import', () => {
  it('parseCsv handles quotes, commas in cells, CRLF and BOM', () => {
    expect(parseCsv('﻿name,code\r\n"Bolt, M8",MAT-1\r\n"Say ""hi""",MAT-2\r\n')).toEqual([
      ['name', 'code'],
      ['Bolt, M8', 'MAT-1'],
      ['Say "hi"', 'MAT-2'],
    ]);
  });
  it('header aliases are forgiving; the template round-trips through the parser', () => {
    expect(mapHeaders(['Material Name', 'MATERIAL_CODE', 'Category', 'Other'])).toEqual([
      'name',
      'code',
      'groupName',
      null,
    ]);
    const out = tableToMaterials(parseCsv(templateCsv()));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.rows).toHaveLength(1);
  });
  it('explains what is wrong with a file', () => {
    expect(tableToMaterials([])).toMatchObject({ ok: false, title: 'No materials found' });
    expect(
      tableToMaterials([
        ['foo', 'bar'],
        ['1', '2'],
      ]),
    ).toMatchObject({ ok: false, title: 'Missing columns' });
    expect(tableToMaterials([['name', 'code']])).toMatchObject({ ok: false });
  });
  it('classifyRows: available / added / duplicate / invalid', () => {
    const rows = [
      { code: 'A-1', name: 'A' },
      { code: 'a-1', name: 'A again' },
      { code: 'DCP-1001', name: 'Existing' },
      { code: '', name: 'No code' },
      { code: 'B-1', name: '' },
    ];
    expect(classifyRows(rows, ['DCP-1001']).map((r) => r.status)).toEqual([
      'available',
      'duplicate',
      'added',
      'invalid',
      'invalid',
    ]);
  });
});

describe('master data: add flow and mock ERP', () => {
  const run = (s: FlowState, ...a: FlowAction[]) => a.reduce(flowReducer, s);
  it('file method walks upload -> review -> progress, Back returns, finishing closes', () => {
    let s = run(closedFlow, { type: 'open' });
    expect(s.step).toBe('method');
    s = run(s, { type: 'choose', method: 'file' }, { type: 'next' });
    expect(s.step).toBe('upload');
    s = run(s, { type: 'next' });
    expect(s.step).toBe('review');
    expect(run(s, { type: 'back' }).step).toBe('upload');
    s = run(s, { type: 'next' });
    expect(s.step).toBe('progress');
    expect(run(s, { type: 'next' }).open).toBe(false);
    expect(
      run(run(closedFlow, { type: 'open' }), { type: 'choose', method: 'file' }, { type: 'next' }, { type: 'back' })
        .step,
    ).toBe('method');
  });
  it('"add more" opens straight on the API step and Back closes it', () => {
    const s = run(closedFlow, { type: 'open', mode: 'addMore' });
    expect(s).toMatchObject({ open: true, step: 'api', mode: 'addMore' });
    expect(run(s, { type: 'back' }).open).toBe(false);
  });
  it('step numbering counts only numbered steps', () => {
    expect(stepNumber('file', 'upload')).toEqual({ n: 1, total: 2 });
    expect(stepNumber('file', 'review')).toEqual({ n: 2, total: 2 });
    expect(stepNumber('file', 'progress')).toBeNull();
    expect(stepNumber('api', 'api')).toBeNull();
  });
  it('mock ERP: huge total, prefix + text filters, capped rows', () => {
    const all = searchCatalogue({ text: '', prefix: '', limit: 50 });
    expect(all.total).toBe(128_872);
    expect(all.rows).toHaveLength(50);
    const dcp = searchCatalogue({ text: '', prefix: 'dcp', limit: 50 });
    expect(dcp.rows.map((r) => r.code)).toEqual([
      'DCP-1001',
      'DCP-1002',
      'DCP-1003',
      'DCP-1004',
      'DCP-1005',
      'DCP-1006',
    ]);
    expect(searchCatalogue({ text: 'sprocket 24t', prefix: 'DCP-1003', limit: 5 }).total).toBe(1);
  });
});

describe('master data: staging areas', () => {
  it('seeded areas match the design counts', () => {
    const [a, b, c] = seedAreas();
    expect([utilised(a), totalCells(a)]).toEqual([14, 200]);
    expect([utilised(b), totalCells(b)]).toEqual([62, 200]);
    expect([utilised(c), totalCells(c)]).toEqual([48, 80]);
    expect(countState(a, 'blocked')).toBe(1);
    expect(seedAreas()[0].cells).toEqual(a.cells);
  });
  it('Manage mode toggles only Available <-> Blocked', () => {
    const a = buildArea('X', { name: 'X', rows: 2, cols: 2, filled: 1, reserved: 1, blocked: 0 }, 1);
    const free = Object.keys(a.cells).length < 4 ? ['1-1', '1-2', '2-1', '2-2'].find((k) => !a.cells[k])! : '';
    const [r, c] = free.split('-').map(Number);
    const blocked = toggleBlocked(a, r, c);
    expect(blocked.cells[free]).toBe('blocked');
    expect(toggleBlocked(blocked, r, c).cells[free]).toBeUndefined();
    const fixed = Object.keys(a.cells)[0];
    const [fr, fc] = fixed.split('-').map(Number);
    expect(toggleBlocked(a, fr, fc)).toBe(a);
  });
});

describe('timeAgo', () => {
  it('reads like the design', () => {
    expect(timeAgo(NOW - 30_000, NOW)).toBe('Just now');
    expect(timeAgo(NOW - 2 * 60_000, NOW)).toMatch(/2 min/);
    expect(timeAgo(NOW - 3 * 3_600_000, NOW)).toMatch(/3 hr/);
    expect(timeAgo(NOW - 86_400_000, NOW)).toBe('yesterday');
    expect(timeAgo(NOW - 3 * 86_400_000, NOW)).toMatch(/3 days/);
  });
});

describe('unassigning a used material', () => {
  it('finds the fleets whose workflow uses a code, in Material nodes, If Logic and branches', () => {
    const logic = createNode('logic', { material: 'B-2' });
    logic.br!.t.push(createNode('material', { code: 'C-3' }));
    const fleets = {
      a: { id: 'a', name: 'n', fleet: 'One', nodes: [createStart(), createNode('material', { code: 'A-1' }), logic] },
      b: { id: 'b', name: 'n', fleet: 'Two', nodes: [createStart()] },
      c: { id: 'c', name: 'n', fleet: null, nodes: [createNode('material', { code: 'Z-9' })] },
    };
    expect(fleetsUsingMaterial(fleets, 'A-1')).toEqual(['One']);
    expect(fleetsUsingMaterial(fleets, 'B-2')).toEqual(['One']);
    expect(fleetsUsingMaterial(fleets, 'C-3')).toEqual(['One']);
    expect(fleetsUsingMaterial(fleets, 'Z-9')).toEqual([]);
  });
});
