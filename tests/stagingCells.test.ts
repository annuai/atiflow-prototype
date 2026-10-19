import { describe, expect, it } from 'vitest';
import {
  applyEdit,
  chooseCells,
  cellsHolding,
  freeCells,
  normaliseCells,
  pickOrder,
  pushLog,
  releaseCells,
  stockOf,
  unknownCodes,
  LOG_LIMIT,
} from '../src/features/master-data/model/cells';
import type { StagingCell } from '../src/features/master-data/model/types';

const known = new Set(['M1', 'M2', 'M3']);
const ctx = { known, allowed: new Set(['M1', 'M2']) };
const NOW = 1_000_000;
const filled = (code: string, storedAt: number, quantity = 1): StagingCell => ({
  state: 'filled',
  materialCode: code,
  quantity,
  storedAt,
  updatedAt: storedAt,
  updatedBy: 'x',
});

describe('editing cells', () => {
  it('fills an empty cell with a material and a quantity, logs it, and can empty it again', () => {
    const r = applyEdit({}, ['1-1'], { state: 'filled', materialCode: 'M1', quantity: 5 }, 'meera', NOW, ctx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.cells['1-1']).toMatchObject({
      state: 'filled',
      materialCode: 'M1',
      quantity: 5,
      storedAt: NOW,
      updatedBy: 'meera',
    });
    expect(r.log).toEqual([
      {
        at: NOW,
        by: 'meera',
        key: '1-1',
        from: { state: 'available' },
        to: { state: 'filled', materialCode: 'M1', quantity: 5 },
      },
    ]);
    const e = applyEdit(r.cells, ['1-1'], { state: 'available' }, 'meera', NOW + 1, ctx);
    expect(e).toMatchObject({ ok: true, cells: {} });
  });
  it('changing only the quantity keeps the storing time; changing the material restarts it', () => {
    const base = { '1-1': filled('M1', 100, 5) };
    const q = applyEdit(base, ['1-1'], { state: 'filled', materialCode: 'M1', quantity: 9 }, 'a', NOW, ctx);
    const m = applyEdit(base, ['1-1'], { state: 'filled', materialCode: 'M2', quantity: 5 }, 'a', NOW, ctx);
    expect(q.ok && q.cells['1-1'].storedAt).toBe(100);
    expect(m.ok && m.cells['1-1'].storedAt).toBe(NOW);
  });
  it('blocks with an optional reason, and a blocked cell holds no material', () => {
    const r = applyEdit(
      { '1-1': filled('M1', 1) },
      ['1-1'],
      { state: 'blocked', reason: ' wet floor ' },
      'a',
      NOW,
      ctx,
    );
    expect(r.ok && r.cells['1-1']).toMatchObject({ state: 'blocked', reason: 'wet floor' });
    expect(r.ok && r.cells['1-1'].materialCode).toBeUndefined();
  });
  it('a filled cell may have no material: it is filled, holds nothing a request can take, and drops a stray quantity', () => {
    const r = applyEdit({}, ['1-1'], { state: 'filled', materialCode: '', quantity: 5 }, 'a', NOW, ctx);
    expect(r.ok && r.cells['1-1']).toMatchObject({ state: 'filled', materialCode: undefined, quantity: undefined });
  });
  it('refuses, and changes nothing, for a missing / unknown / unassigned material or a bad quantity', () => {
    const base = { '2-2': filled('M1', 1) };
    const bad = (edit: Parameters<typeof applyEdit>[2]) => applyEdit(base, ['1-1', '2-2'], edit, 'a', NOW, ctx);
    expect(bad({ state: 'filled', materialCode: 'ZZ' })).toMatchObject({ ok: false, error: 'unknown-material' });
    expect(bad({ state: 'filled', materialCode: 'M3' })).toMatchObject({ ok: false, error: 'not-assigned' }); // exists, but not this fleet's
    expect(bad({ state: 'filled', materialCode: 'M1', quantity: 0 })).toMatchObject({
      ok: false,
      error: 'bad-quantity',
    });
    expect(bad({ state: 'filled', materialCode: 'M1', quantity: 1.5 })).toMatchObject({
      ok: false,
      error: 'bad-quantity',
    });
  });
  it('a reserved cell cannot be edited by hand, only released; releasing frees it and logs who held it', () => {
    const base: Record<string, StagingCell> = {
      '1-1': { state: 'reserved', materialCode: 'M1', reservedFor: 'TRP-9', updatedAt: 1, updatedBy: 'system' },
    };
    expect(applyEdit(base, ['1-1'], { state: 'available' }, 'a', NOW, ctx)).toMatchObject({
      ok: false,
      error: 'reserved',
    });
    const r = releaseCells(base, ['1-1'], 'meera', NOW);
    expect(r).toMatchObject({ ok: true, cells: {} });
    expect(r.ok && r.log[0]).toMatchObject({
      key: '1-1',
      ref: 'TRP-9',
      from: { state: 'reserved' },
      to: { state: 'available' },
    });
  });
  it('bulk: the same edit on several cells is one all-or-nothing change; cells that already match are skipped', () => {
    const r = applyEdit(
      { '1-2': filled('M1', 5, 3) },
      ['1-1', '1-2', '1-3'],
      { state: 'filled', materialCode: 'M1', quantity: 3 },
      'a',
      NOW,
      ctx,
    );
    expect(r.ok && Object.keys(r.cells).sort()).toEqual(['1-1', '1-2', '1-3']);
    expect(r.ok && r.log.map((l) => l.key)).toEqual(['1-1', '1-3']); // 1-2 was already like that
  });
  it('the activity log keeps the newest entries and is capped', () => {
    const e = (n: number) => ({
      at: n,
      by: 'a',
      key: '1-1',
      from: { state: 'available' as const },
      to: { state: 'available' as const },
    });
    const log = Array.from({ length: LOG_LIMIT }, (_, i) => e(i));
    const more = pushLog(log, [e(9999)]);
    expect(more).toHaveLength(LOG_LIMIT);
    expect(more[0].at).toBe(9999);
  });
});

describe('FIFO and LIFO', () => {
  const cells = {
    '1-1': filled('M1', 300, 2),
    '1-2': filled('M1', 100, 2),
    '2-1': filled('M1', 200, 2),
    '3-3': filled('M2', 50, 7),
  };
  it('FIFO gives the material that has been in longest first; LIFO the one put in last', () => {
    expect(pickOrder({ cells, retrieval: 'fifo' }, 'M1')).toEqual(['1-2', '2-1', '1-1']);
    expect(pickOrder({ cells, retrieval: 'lifo' }, 'M1')).toEqual(['1-1', '2-1', '1-2']);
    expect(pickOrder({ cells }, 'M1')).toEqual(['1-2', '2-1', '1-1']); // no setting = FIFO
  });
  it("take-out by position follows the area's own sequence, whatever the arrival times", () => {
    const area = { cells, rows: 3, cols: 3, emptyBy: 'position' as const };
    expect(pickOrder({ ...area, emptyPosition: { by: 'row', lines: 'asc', cells: 'asc' } }, 'M1')).toEqual([
      '1-1',
      '1-2',
      '2-1',
    ]);
    expect(pickOrder({ ...area, emptyPosition: { by: 'column', lines: 'desc', cells: 'desc' } }, 'M1')).toEqual([
      '1-2',
      '2-1',
      '1-1',
    ]);
  });
  it("free cells are used in the area's fill order", () => {
    const a = { rows: 2, cols: 2, cells: {} as Record<string, never> };
    expect(freeCells(a)).toEqual(['1-1', '1-2', '2-1', '2-2']);
    expect(freeCells({ ...a, fill: { by: 'column', lines: 'desc', cells: 'asc' } })).toEqual([
      '1-2',
      '2-2',
      '1-1',
      '2-1',
    ]);
  });
  it('cells stored at the same moment (or older data without a time) go in row, then column order', () => {
    const same = { '2-1': filled('M1', 1), '1-2': filled('M1', 1), '1-1': filled('M1', 1) };
    expect(pickOrder({ cells: same, retrieval: 'fifo' }, 'M1')).toEqual(['1-1', '1-2', '2-1']);
  });
  it('a request takes as many cells as it needs, in that order, or none when there is not enough', () => {
    expect(chooseCells({ cells, retrieval: 'fifo' }, 'M1', 3)).toEqual(['1-2', '2-1']); // 2 + 2 >= 3
    expect(chooseCells({ cells, retrieval: 'lifo' }, 'M1', 2)).toEqual(['1-1']);
    expect(chooseCells({ cells, retrieval: 'fifo' }, 'M1', 7)).toBeNull(); // only 6 in the area
    expect(chooseCells({ cells, retrieval: 'fifo' }, 'M2', 7)).toEqual(['3-3']);
  });
  it('only filled cells give material out (reserved and blocked ones do not)', () => {
    const mixed: Record<string, StagingCell> = {
      ...cells,
      '4-4': { state: 'reserved', materialCode: 'M1', quantity: 9, updatedAt: 0, updatedBy: 's' },
    };
    expect(cellsHolding({ cells: mixed }, 'M1')).not.toContain('4-4');
    expect(stockOf({ cells: mixed })).toEqual({ M1: 6, M2: 7 });
  });
});

describe('reading and upgrading', () => {
  it('free cells come row by row; unknown materials are found', () => {
    expect(freeCells({ rows: 2, cols: 2, cells: { '1-1': filled('M1', 1) } })).toEqual(['1-2', '2-1', '2-2']);
    expect(unknownCodes({ cells: { '1-1': filled('GONE', 1), '1-2': filled('M1', 1) } }, known)).toEqual(['GONE']);
  });
  it('data saved before cells held materials becomes cells without a material', () => {
    const up = normaliseCells({ '1-1': 'filled', '1-2': 'blocked', '1-3': 'reserved' } as never);
    expect(up['1-1']).toMatchObject({ state: 'filled', updatedBy: 'system' });
    expect(up['1-1'].materialCode).toBeUndefined();
    expect(Object.keys(up)).toHaveLength(3);
    const again = normaliseCells(up);
    expect(again).toEqual(up); // upgrading twice changes nothing
  });
});
