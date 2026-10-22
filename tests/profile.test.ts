import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROFILES, chooseProfile, profileBackend, resetProfile, setActiveProfile } from '../src/data/profile';
import { createDummyServices } from '../src/services/dummy';
import { memoryStorage } from './helpers/memoryStorage';

afterEach(() => {
  setActiveProfile('demo');
  vi.unstubAllGlobals();
}); // every other test file runs on the demo data

describe('data profiles', () => {
  it('chooses by address first, then the device, then the deployment, then demo', () => {
    expect(chooseProfile({ search: '?profile=blank', saved: 'demo', config: 'demo' })).toEqual({
      id: 'blank',
      fromUrl: true,
    });
    expect(chooseProfile({ search: '', saved: 'blank', config: 'demo' })).toEqual({ id: 'blank', fromUrl: false });
    expect(chooseProfile({ saved: null, config: 'blank' }).id).toBe('blank');
    expect(chooseProfile({ search: '?profile=nonsense', saved: 'junk', config: 'x' }).id).toBe('demo');
  });
  it('demo keeps the keys the app always used; blank puts its own prefix in front', () => {
    expect(PROFILES.demo.prefix).toBe('');
    expect(PROFILES.blank.prefix).not.toBe('');
    expect(PROFILES.blank.idbSuffix).not.toBe(PROFILES.demo.idbSuffix);
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const k = profileBackend(PROFILES.blank)('atiflow.dataset.v1');
    k.write('x');
    expect(localStorage.getItem('blank:atiflow.dataset.v1')).toBe('x');
    expect(localStorage.getItem('atiflow.dataset.v1')).toBeNull();
    k.remove();
  });
  it('a blank workspace starts with nothing: no fleets, robots, hardware, materials, workflows or imported maps', async () => {
    setActiveProfile('blank');
    const s = createDummyServices({ backend: memoryStorage().backend });
    const d = s.dataset.read();
    expect(d.fleets).toEqual([]);
    expect(d.robot).toEqual([]);
    expect(d.hardware).toEqual([]);
    expect(s.fleetProfiles.read()).toEqual({});
    const m = s.masterData.read();
    expect([m.materials, m.groups, m.areas]).toEqual([[], [], []]);
    expect(s.workflows.starter?.()).toEqual({});
    expect(s.mapCatalog.read()).toEqual([]);
    expect(s.settings.read().connections['fleet-manager'].values.host).toBe('');
    const users = await s.users.hydrate?.();
    expect((users ?? s.users.snapshot()).length).toBeGreaterThan(0); // people can still sign in
    expect((users ?? s.users.snapshot()).every((u) => (u.fleets ?? []).length === 0)).toBe(true);
  });
  it('the demo data is what it always was', () => {
    setActiveProfile('demo');
    const s = createDummyServices({ backend: memoryStorage().backend });
    expect(s.dataset.read().fleets.length).toBeGreaterThan(0);
    expect(s.dataset.read().robot.length).toBeGreaterThan(5);
    expect(Object.keys(s.workflows.starter?.() ?? {}).length).toBeGreaterThan(0);
  });
  it('resetting deletes only the blank workspace; the demo data is never touched', async () => {
    const make = () => {
      const m = new Map<string, string>();
      return {
        m,
        api: {
          getItem: (k: string) => m.get(k) ?? null,
          setItem: (k: string, v: string) => void m.set(k, v),
          removeItem: (k: string) => void m.delete(k),
          get length() {
            return m.size;
          },
          key: (i: number) => [...m.keys()][i] ?? null,
        },
      };
    };
    const local = make();
    const session = make();
    // Object.keys(storage) must list the keys: a Proxy over the map stands in for browser storage
    const asStorage = (s: ReturnType<typeof make>) =>
      new Proxy(s.api, {
        ownKeys: () => [...s.m.keys()],
        getOwnPropertyDescriptor: (_t, k) =>
          s.m.has(String(k)) ? { enumerable: true, configurable: true } : undefined,
      });
    vi.stubGlobal('localStorage', asStorage(local));
    vi.stubGlobal('sessionStorage', asStorage(session));
    local.m.set('atiflow.dataset.v1', 'demo-data');
    local.m.set('blank:atiflow.dataset.v1', 'blank-data');
    local.m.set('blank:onboarding:site', 'x');
    expect(await resetProfile('demo')).toBe(false);
    expect([...local.m.keys()].sort()).toEqual([
      'atiflow.dataset.v1',
      'blank:atiflow.dataset.v1',
      'blank:onboarding:site',
    ]);
    expect(await resetProfile('blank')).toBe(true);
    expect([...local.m.keys()]).toEqual(['atiflow.dataset.v1']);
  });
});
