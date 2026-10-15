import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RobotAlertWatcher } from '../src/features/notifications/robotAlerts';
import { DashboardEngine } from '../src/features/dashboard/data/engine';
import {
  DEFAULT_ALERTS,
  DEFAULT_PREFERENCES,
  validatePreferences,
  withDefaults,
} from '../src/features/preferences/model/defaults';
import { preferencesStore, prefsOf } from '../src/features/preferences/data/store';
import { landingFor } from '../src/app/lastPage';
import { canOpen } from '../src/features/access';
import { findUser } from '../src/features/auth/authService';
import type { DashboardInput } from '../src/features/dashboard/data/types';
import type { RobotTelemetry, Station } from '../src/core/types';

const bot = (o: Partial<RobotTelemetry>): RobotTelemetry => ({
  id: 'AMR-001',
  model: 'm',
  fleetId: 'f1',
  siteId: 's',
  pose: { x: 0, y: 0, theta: 0 },
  speed: 0,
  state: 'moving',
  battery: 80,
  ts: 0,
  ...o,
});
const input = (now: number, robots: RobotTelemetry[], thresholds?: DashboardInput['thresholds']): DashboardInput => ({
  now,
  robots,
  stations: [] as Station[],
  fleets: [{ id: 'f1', name: 'F', color: '#000' }],
  site: null,
  thresholds,
});

describe('preferences: defaults', () => {
  it('saved preferences are completed with the defaults; an urgent wait before the first warning is refused', () => {
    expect(withDefaults({ alerts: { ...DEFAULT_ALERTS, batteryLow: 30 } }).alerts).toMatchObject({
      batteryLow: 30,
      notifyAfterS: 90,
    });
    expect(withDefaults(null)).toEqual(DEFAULT_PREFERENCES);
    expect(
      validatePreferences({ ...DEFAULT_PREFERENCES, alerts: { ...DEFAULT_ALERTS, waitWarnS: 120, waitUrgentS: 60 } })
        .waitUrgentS,
    ).toBeTruthy();
    expect(validatePreferences(DEFAULT_PREFERENCES)).toEqual({});
  });
});

describe('preferences drive the alerts', () => {
  it('a problem the user switched off does not notify; thresholds change when it notifies', () => {
    const off = (patch: Partial<typeof DEFAULT_ALERTS>) =>
      new RobotAlertWatcher(undefined, () => ({ ...DEFAULT_ALERTS, ...patch }));
    expect(off({ blocked: false }).ingest(0, [bot({ state: 'blocked' })])).toHaveLength(0);
    expect(off({}).ingest(0, [bot({ state: 'blocked' })])).toHaveLength(1);
    expect(off({ fault: false }).ingest(0, [bot({ state: 'error' })])).toHaveLength(0);
    expect(off({ battery: false }).ingest(0, [bot({ battery: 5 })])).toHaveLength(0);
    expect(off({ batteryLow: 40 }).ingest(0, [bot({ battery: 35 })])).toHaveLength(1);
    expect(off({}).ingest(0, [bot({ battery: 35 })])).toHaveLength(0);
    const w = off({ notifyAfterS: 30 });
    w.ingest(0, [bot({ state: 'waiting' })]);
    expect(w.ingest(31_000, [bot({ state: 'waiting' })]).map((n) => n.kind)).toEqual(['stuck']);
    const d = off({});
    d.ingest(0, [bot({ state: 'waiting' })]);
    expect(d.ingest(31_000, [bot({ state: 'waiting' })])).toHaveLength(0);
    const s = off({ stuck: false });
    s.ingest(0, [bot({ state: 'waiting' })]);
    expect(s.ingest(200_000, [bot({ state: 'waiting' })])).toHaveLength(0);
  });
  it("the Dashboard's needs-attention list uses the thresholds of the user", () => {
    const e = new DashboardEngine();
    const r = bot({ state: 'waiting', waitReason: 'headway' });
    e.ingest(input(0, [r]));
    e.ingest(input(50_000, [r]));
    expect(e.snapshot()!.attention.map((a) => a.kind)).toEqual(['waiting']); // default: after 45 s
    const lazy = new DashboardEngine();
    lazy.ingest(input(0, [r], { waitWarnS: 120, waitUrgentS: 240, batteryLow: 25 }));
    lazy.ingest(input(50_000, [r], { waitWarnS: 120, waitUrgentS: 240, batteryLow: 25 }));
    expect(lazy.snapshot()!.attention).toEqual([]);
    const batt = new DashboardEngine();
    batt.ingest(input(0, [bot({ battery: 30 })], { waitWarnS: 45, waitUrgentS: 120, batteryLow: 40 }));
    expect(batt.snapshot()!.attention.map((a) => a.kind)).toEqual(['battery']);
  });
});

describe('preferences: where the app opens', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };
  beforeEach(() => {
    vi.stubGlobal('localStorage', memory());
    preferencesStore.setState({ byUser: {} });
  });
  it("opens on the page the user chose, if they may open it; otherwise the remembered page, then the role's home", () => {
    const arjun = findUser('arjun')!;
    expect(landingFor(arjun)).toBe('/supervisor/dashboard');
    preferencesStore.getState().save('arjun', { ...DEFAULT_PREFERENCES, startPage: '/supervisor/reports' });
    expect(landingFor(arjun)).toBe('/supervisor/reports');
    expect(prefsOf('arjun').startPage).toBe('/supervisor/reports');
    preferencesStore.getState().save('arjun', { ...DEFAULT_PREFERENCES, startPage: '/configurator/robots' });
    expect(landingFor(arjun)).toBe('/supervisor/dashboard'); // not allowed: ignored
    preferencesStore.getState().save('arjun', { ...DEFAULT_PREFERENCES, startPage: 'last' });
    expect(landingFor(arjun)).toBe('/supervisor/dashboard');
    expect(prefsOf(null)).toEqual(DEFAULT_PREFERENCES);
  });
  it("Settings is a supervisor permission (and the configurator's Settings stays a different page)", () => {
    expect(canOpen({ role: 'supervisor' }, '/supervisor/settings/alerts')).toBe(true);
    expect(
      canOpen({ role: 'supervisor', custom: { add: [], remove: ['supervisor.settings'] } }, '/supervisor/settings'),
    ).toBe(false);
    expect(canOpen({ role: 'supervisor' }, '/configurator/settings')).toBe(false);
  });
});
