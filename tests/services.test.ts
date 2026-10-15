import { describe, it, expect, vi } from 'vitest';
import { createServices, setServices, services } from '../src/services';
import { createDummyServices } from '../src/services/dummy';
import { BOOKINGS_KEY } from '../src/services/dummy/bookings';
import { REQUESTS_KEY } from '../src/services/dummy/requests';
import { TRIP_SEQ_KEY } from '../src/services/dummy/tripIds';
import { WORKFLOWS_KEY } from '../src/services/dummy/workflows';
import { ACTIONLOG_KEY, DATASET_KEY, MASTERDATA_KEY, notificationsKey } from '../src/services/dummy/state';
import { setLogSinks } from '../src/platform';
import { memoryStorage } from './helpers/memoryStorage';

const build = (initial?: Record<string, string>) => {
  const m = memoryStorage(initial);
  return { ...m, svc: createDummyServices({ backend: m.backend, sessionBackend: memoryStorage().backend }) };
};

describe('dummy services', () => {
  it('requests and bookings start empty, save, and go back to the seed', async () => {
    const { svc, data } = build();
    expect(svc.requests.snapshot()).toEqual({ requests: [], seq: 0 });
    await svc.bookings.save({ trips: [], seq: 3 });
    expect(JSON.parse(data.get(BOOKINGS_KEY)!).seq).toBe(3);
    expect(svc.bookings.snapshot().seq).toBe(3);
    expect(svc.bookings.resetToSeed?.().seq).toBe(0);
    expect(data.has(BOOKINGS_KEY)).toBe(false);
  });
  it('a damaged requests document is ignored (and logged) without erasing what is saved', () => {
    const seen: string[] = [];
    setLogSinks([(r) => seen.push(r.message)]);
    const { svc, data } = build({ [REQUESTS_KEY]: JSON.stringify({ requests: 'oops' }) });
    expect(svc.requests.snapshot()).toEqual({ requests: [], seq: 0 });
    expect(data.get(REQUESTS_KEY)).toContain('oops');
    expect(seen.some((m) => m.includes('saved requests ignored'))).toBe(true);
  });
  it('the trip-id counter persists the last number', () => {
    const { svc, data } = build();
    expect(svc.tripIds.read()).toBe(0);
    svc.tripIds.write(41);
    expect(data.get(TRIP_SEQ_KEY)).toBe('41');
    expect(svc.tripIds.read()).toBe(41);
  });
  it('workflows are null until saved; older versions are offered to the store through readLegacy', async () => {
    const { svc } = build({ 'atiflow.workflows.v5': JSON.stringify({ workflows: { a: { id: 'a', nodes: [] } } }) });
    expect(svc.workflows.snapshot()).toBeNull();
    expect(svc.workflows.readLegacy?.()).toMatchObject({ version: 5 });
    await svc.workflows.save({ a: { id: 'a', name: 'A', fleet: 'f', nodes: [] } });
    expect(svc.workflows.snapshot()).toMatchObject({ a: { id: 'a' } });
  });
  it('a document changed in another tab reaches subscribers', () => {
    const { svc, data } = build();
    const listeners: ((e: StorageEvent) => void)[] = [];
    vi.stubGlobal('window', {
      addEventListener: (_: string, f: (e: StorageEvent) => void) => listeners.push(f),
      removeEventListener: () => {},
    });
    const got: number[] = [];
    svc.requests.subscribe((d) => got.push(d.seq));
    const next = JSON.stringify({ requests: [], seq: 9 });
    data.set(REQUESTS_KEY, next);
    listeners.forEach((f) => f({ key: REQUESTS_KEY, newValue: next } as StorageEvent));
    vi.unstubAllGlobals();
    expect(got).toEqual([9]);
  });
  it('the saved workflows use the current key', () => {
    expect(WORKFLOWS_KEY).toBe('atiflow.workflows.v7');
  });
});

describe('saved-state services (dummy)', () => {
  it('read null until something valid is saved; save then read round-trips; clear forgets', async () => {
    const { svc } = build();
    expect(svc.fleetProfiles.read()).toBeNull();
    await svc.fleetProfiles.save({ 'Line Side Fleet': { mapId: 'm1', groups: [] } });
    expect(svc.fleetProfiles.read()).toEqual({ 'Line Side Fleet': { mapId: 'm1', groups: [] } });
    svc.fleetProfiles.clear();
    expect(svc.fleetProfiles.read()).toBeNull();
  });
  it('data that does not match is ignored and logged, never erased', () => {
    const seen: string[] = [];
    setLogSinks([(r) => seen.push(r.message)]);
    const bad = JSON.stringify({ materials: 'x' });
    const { svc, data } = build({ [MASTERDATA_KEY]: bad, [DATASET_KEY]: '{"version":2}', [ACTIONLOG_KEY]: 'nope' });
    expect(svc.masterData.read()).toBeNull();
    expect(svc.dataset.read()).toBeNull();
    expect(svc.actionLog.read()).toBeNull();
    expect(data.get(MASTERDATA_KEY)).toBe(bad);
    expect(seen.filter((m) => m.includes('ignored'))).toHaveLength(3);
  });
  it('the notification cache is kept per person', async () => {
    const { svc, data } = build();
    const note = { id: 'n1', title: 'T', at: 1, kind: 'mes', level: 'info', read: false } as never;
    await svc.notificationCache.forUser('arjun').save([note]);
    expect(data.has(notificationsKey('arjun'))).toBe(true);
    expect(svc.notificationCache.forUser('arjun').read()).toHaveLength(1);
    expect(svc.notificationCache.forUser('kavin').read()).toBeNull();
  });
  it('device preferences are plain per-device values', () => {
    const { svc } = build();
    expect(svc.device.get('sb-collapsed')).toBeNull();
    svc.device.set('sb-collapsed', '1');
    expect(svc.device.get('sb-collapsed')).toBe('1');
  });
  it('a saved user without fleets is given every fleet, including ones added after the start', async () => {
    const seed = (await import('../src/data/dataset.json')).default;
    const { users } = createDummyServices({
      backend: memoryStorage({
        [DATASET_KEY]: JSON.stringify({
          ...seed,
          fleets: [...seed.fleets, { id: 'new-fleet', name: 'New', color: '#000' }],
        }),
        'atiflow.users.v1': JSON.stringify([
          { username: 'zed', firstName: 'Z', lastName: '', email: 'z@x.co', role: 'supervisor', title: 'T' },
        ]),
      }).backend,
    });
    expect(users.snapshot().find((u) => u.username === 'zed')?.fleets).toContain('new-fleet');
  });
});

describe('the composition root', () => {
  it('dummy mode builds every service; api mode warns per service and falls back to the dummy ones', () => {
    const seen: string[] = [];
    setLogSinks([(r) => seen.push(r.message)]);
    expect(createServices({ dataMode: 'dummy', api: {} })).toHaveProperty('workflows');
    expect(seen).toEqual([]);
    const s = createServices({ dataMode: 'api', api: {} });
    const names = Object.keys(createDummyServices()).sort();
    expect(Object.keys(s).sort()).toEqual(names);
    expect(seen.filter((m) => m.includes('no HTTP adapter yet'))).toHaveLength(names.length);
  });
  it('setServices replaces what services() returns', () => {
    const mine = createDummyServices({ backend: memoryStorage().backend });
    setServices(mine);
    expect(services()).toBe(mine);
  });
});
