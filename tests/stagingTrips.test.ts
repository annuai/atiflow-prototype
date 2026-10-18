import { FLEET_ID } from '../src/data/fleets';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  commitDrop,
  giveBack,
  planPick,
  releaseDrop,
  reserveDrop,
  stockOf,
  takePick,
} from '../src/features/master-data/model/cells';
import { masterDataStore } from '../src/features/master-data/model/store';
import { fleetsStore } from '../src/features/fleets/model/store';
import { mapVersionsStore } from '../src/features/map-editor/model/store';
import { seedMapData } from '../src/features/map-editor/model/seed';
import { requestsStore } from '../src/features/requests/model/store';
import { entryLegs } from '../src/features/requests/model/cells';
import type { RequestableItem } from '../src/features/requests/model/types';
import type { NavGraph, SiteLayout } from '../src/core/types';
import type { StagingArea, StagingCell } from '../src/features/master-data/model/types';

const f = (code: string, storedAt: number, quantity: number): StagingCell => ({
  state: 'filled',
  materialCode: code,
  quantity,
  storedAt,
  updatedAt: storedAt,
  updatedBy: 'x',
});

describe('taking pieces out of an area, in its order, and giving them back', () => {
  const cells = { '1-1': f('M1', 300, 10), '1-2': f('M1', 100, 4), '2-1': f('M1', 200, 6) };
  it('FIFO takes from the oldest cells first and only part of the last one', () => {
    expect(planPick({ cells, retrieval: 'fifo' }, 'M1', 7)).toEqual([
      { key: '1-2', take: 4, storedAt: 100 },
      { key: '2-1', take: 3, storedAt: 200 },
    ]);
    expect(planPick({ cells, retrieval: 'lifo' }, 'M1', 7)).toEqual([{ key: '1-1', take: 7, storedAt: 300 }]);
    expect(planPick({ cells, retrieval: 'fifo' }, 'M1', 21)).toBeNull(); // only 20 in the area
  });
  it('takePick removes the pieces now (an emptied cell is free); giveBack puts them back with their old storing time', () => {
    const plan = { areaId: 'A', code: 'M1', items: planPick({ cells, retrieval: 'fifo' }, 'M1', 7)! };
    const t = takePick(cells, plan, 'TRP-1', 1000);
    expect(t.cells['1-2']).toBeUndefined(); // 4 of 4: gone
    expect(t.cells['2-1']).toMatchObject({ quantity: 3, storedAt: 200 });
    expect(stockOf({ cells: t.cells })).toEqual({ M1: 13 });
    expect(t.log.every((l) => l.ref === 'TRP-1' && l.by === 'system')).toBe(true);
    const back = giveBack({ rows: 3, cols: 3, cells: t.cells }, plan, 'TRP-1', 2000);
    expect(back.lost).toBe(0);
    expect(back.cells['1-2']).toMatchObject({ state: 'filled', quantity: 4, storedAt: 100 });
    expect(back.cells['2-1']).toMatchObject({ quantity: 6, storedAt: 200 });
  });
  it('a cell that was filled with something else meanwhile is not overwritten: the pieces go to a free cell', () => {
    const plan = { areaId: 'A', code: 'M1', items: [{ key: '1-1', take: 5, storedAt: 50 }] };
    const other = { '1-1': f('OTHER', 999, 3) };
    const back = giveBack({ rows: 1, cols: 3, cells: other }, plan, 'TRP-2', 5);
    expect(back.cells['1-1']).toMatchObject({ materialCode: 'OTHER' });
    expect(back.cells['1-2']).toMatchObject({ materialCode: 'M1', quantity: 5, storedAt: 50 });
    expect(giveBack({ rows: 1, cols: 1, cells: other }, plan, 'TRP-2', 5).lost).toBe(5); // no room anywhere: reported, not hidden
  });
  it('a drop-off reserves the first free cell; delivery fills it (FIFO clock starts), cancel frees it', () => {
    const area = { rows: 2, cols: 2, cells: { '1-1': f('M1', 1, 1) } };
    const r = reserveDrop(area, 'M2', 8, 'TRP-3', 100)!;
    expect(r.key).toBe('1-2');
    expect(r.cells['1-2']).toMatchObject({ state: 'reserved', materialCode: 'M2', quantity: 8, reservedFor: 'TRP-3' });
    expect(commitDrop(r.cells, r.key, 'TRP-3', 500).cells['1-2']).toMatchObject({
      state: 'filled',
      storedAt: 500,
      quantity: 8,
    });
    expect(commitDrop(r.cells, r.key, 'OTHER', 500).cells).toBe(r.cells); // not its reservation
    expect(releaseDrop(r.cells, r.key, 'TRP-3', 500).cells['1-2']).toBeUndefined();
    expect(reserveDrop({ rows: 1, cols: 1, cells: { '1-1': f('M1', 1, 1) } }, 'M2', 1, 'T', 0)).toBeNull(); // full
  });
});

describe('requests that use staging areas', () => {
  const site = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8')) as SiteLayout;
  const nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
  const who = { username: 'rohan', name: 'Rohan' };
  const item = (legs: string[], legActions: string[], code = 'DCP-1003', qty = 10): RequestableItem => ({
    key: 'k',
    workflowId: 'w',
    workflowName: 'Store run',
    fleet: FLEET_ID.lineSide,
    fleetLive: 'line-side',
    code,
    name: 'Chain Sprocket 24T',
    group: '',
    qty,
    qtyEditable: false,
    approvalUsers: [],
    needsApproval: false,
    legs,
    legActions,
    loadFrom: 1,
  });
  const area = (id: string): StagingArea => masterDataStore.getState().areas.find((a) => a.id === id)!;
  beforeEach(() => {
    mapVersionsStore.getState().reset();
    mapVersionsStore.getState().ensure('main-assembly', 5, seedMapData({ fleetLive: 'line-side' }, site, nav), 1);
    fleetsStore.getState().assignMap(FLEET_ID.lineSide, 'main-assembly');
    requestsStore.getState().reset();
    masterDataStore.setState({
      areas: [
        {
          id: 'SA-001',
          name: 'SA 001',
          rows: 20,
          cols: 10,
          cells: { '1-1': f('DCP-1003', 300, 10), '1-2': f('DCP-1003', 100, 4) },
        },
        {
          id: 'SA-002',
          name: 'SA 002',
          rows: 20,
          cols: 10,
          cells: { '1-1': f('DCP-1003', 300, 10), '1-2': f('DCP-1003', 100, 4) },
        },
      ],
    });
  });
  it('a pick-up from an area takes the pieces now in the area’s order (SA-001 is FIFO, SA-002 LIFO), and a completed trip keeps them taken', () => {
    requestsStore.getState().submit(who, [{ item: item(['SA-001', 'STA-107'], ['Pick Up', 'Drop Off']), qty: 10 }]);
    const r = requestsStore.getState().requests[0];
    expect(r.status).toBe('approved');
    expect(r.cells?.pick?.items).toEqual([
      { key: '1-2', take: 4, storedAt: 100 },
      { key: '1-1', take: 6, storedAt: 300 },
    ]);
    expect(stockOf(area('SA-001'))).toEqual({ 'DCP-1003': 4 });
    requestsStore.getState().apply({ id: r.id, status: 'ongoing', tripId: r.tripId, robotId: 'AMR-001' });
    requestsStore.getState().apply({ id: r.id, status: 'completed' });
    expect(requestsStore.getState().requests[0].cells?.settled).toBe('committed');
    expect(stockOf(area('SA-001'))).toEqual({ 'DCP-1003': 4 });
    // LIFO: the newest cell goes first
    requestsStore
      .getState()
      .submit(who, [{ item: item(['SA-002', 'STA-107'], ['Pick Up', 'Drop Off'], 'DCP-1003', 8), qty: 8 }]);
    const l = requestsStore.getState().requests[1];
    expect(l.cells?.pick?.items).toEqual([{ key: '1-1', take: 8, storedAt: 300 }]);
  });
  it('cancelling gives the pieces back; a late "completed" afterwards changes nothing', () => {
    requestsStore.getState().submit(who, [{ item: item(['SA-001', 'STA-107'], ['Pick Up', 'Drop Off']), qty: 10 }]);
    const r = requestsStore.getState().requests[0];
    expect(
      requestsStore.getState().cancel(r.id, { username: 'rohan', name: 'Rohan', ...(who as object) } as never),
    ).toBe(true);
    expect(stockOf(area('SA-001'))).toEqual({ 'DCP-1003': 14 });
    expect(requestsStore.getState().requests[0].cells?.settled).toBe('released');
    requestsStore.getState().apply({ id: r.id, status: 'completed' });
    expect(stockOf(area('SA-001'))).toEqual({ 'DCP-1003': 14 });
  });
  it('a request for more than the area holds fails at once with the reason, and changes nothing', () => {
    requestsStore
      .getState()
      .submit(who, [{ item: item(['SA-001', 'STA-107'], ['Pick Up', 'Drop Off'], 'DCP-1003', 15), qty: 15 }]);
    const r = requestsStore.getState().requests[0];
    expect(r.status).toBe('failed');
    expect(r.note).toMatch(/holds 14 of the 15 pieces/);
    expect(stockOf(area('SA-001'))).toEqual({ 'DCP-1003': 14 });
  });
  it('a drop-off at an area reserves a cell, delivery fills it', () => {
    requestsStore
      .getState()
      .submit(who, [{ item: item(['STA-116', 'SA-002'], ['Pick Up', 'Drop Off'], 'DCP-1001', 5), qty: 5 }]);
    const r = requestsStore.getState().requests[0];
    const key = r.cells!.drop!.key;
    expect(area('SA-002').cells[key]).toMatchObject({
      state: 'reserved',
      reservedFor: r.tripId,
      materialCode: 'DCP-1001',
    });
    requestsStore.getState().apply({ id: r.id, status: 'completed' });
    expect(area('SA-002').cells[key]).toMatchObject({ state: 'filled', materialCode: 'DCP-1001', quantity: 5 });
  });
  it('the robot is sent to the area’s entry station', () => {
    expect(entryLegs({ fleet: FLEET_ID.lineSide, legs: ['SA-001', 'STA-107'], loadFrom: 1 })).toEqual({
      legs: ['STA-116', 'STA-107'],
      loadFrom: 1,
    });
    expect(entryLegs({ fleet: FLEET_ID.lineSide, legs: ['STA-116', 'SA-001'], loadFrom: 1 })).toEqual({
      legs: ['STA-116'],
      loadFrom: 0,
    }); // the same stop twice is one
  });
});
