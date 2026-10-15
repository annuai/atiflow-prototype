import { describe, it, expect } from 'vitest';
import { CONFIG_SCHEMA, LATEST_FIRMWARE } from '../src/fixtures/robotOps';
import { calibrationBlocked, describeCalibration } from '../src/features/robot-ops/model/calibration';
import {
  changedKeys,
  configErrors,
  customised,
  groupParams,
  normaliseDraft,
  paramError,
} from '../src/features/robot-ops/model/config';
import { compareVersions, formatCheck, updateAvailable } from '../src/features/robot-ops/model/software';
import type { NumberParam, RobotRef } from '../src/features/robot-ops/model/types';
import { createDummyServices } from '../src/services/dummy';
import { fleetsStore } from '../src/features/fleets/model/store';
import { memoryStorage } from './helpers/memoryStorage';

const robot: RobotRef = { name: 'AMR-004', type: 'sherpa-xt-lite', firmware: 'v3.2.1' };
const fresh = () => createDummyServices({ backend: memoryStorage().backend }).robotOps;
const maxEvents = CONFIG_SCHEMA.categories[0].params[0] as NumberParam;

describe('configuration rules (pure)', () => {
  it('numbers are checked for being a number, whole, and within min / max', () => {
    expect(paramError(maxEvents, '15')).toBe('');
    expect(paramError(maxEvents, '')).toMatch(/number/i);
    expect(paramError(maxEvents, 'abc')).toMatch(/number/i);
    expect(paramError(maxEvents, '1.5')).toMatch(/whole/i);
    expect(paramError(maxEvents, '0')).toMatch(/or more/);
    expect(paramError(maxEvents, '101')).toMatch(/or less/);
  });
  it('a draft is checked as a whole, typed numbers become numbers, and changes are found by value', () => {
    const saved = { ...CONFIG_SCHEMA.defaults };
    const draft = { ...saved, max_exception_events: '20', horn_volume: 500 };
    expect(Object.keys(configErrors(CONFIG_SCHEMA, draft))).toEqual(['horn_volume']);
    expect(normaliseDraft(CONFIG_SCHEMA, { max_exception_events: '20' }).max_exception_events).toBe(20);
    expect(changedKeys(saved, { ...saved, max_exception_events: '15' })).toEqual([]); // the same number typed as text is not a change
    expect(changedKeys(saved, draft).sort()).toEqual(['horn_volume', 'max_exception_events']);
  });
  it('parameters are grouped under their headings and categories count what differs from the default', () => {
    expect(groupParams(CONFIG_SCHEMA.categories[0]).map((g) => [g.heading, g.params.length])).toEqual([
      ['Runaway Monitor', 2],
    ]);
    expect(
      customised(
        CONFIG_SCHEMA.categories[0],
        { ...CONFIG_SCHEMA.defaults, max_exception_events: 20 },
        CONFIG_SCHEMA.defaults,
      ),
    ).toBe(1);
  });
});

describe('calibration and software rules (pure)', () => {
  it('describes a calibration in words and says why one cannot start', () => {
    const now = 1_000_000_000_000;
    expect(describeCalibration({ lastRunAt: now - 120 * 86_400_000, running: false }, now)).toBe(
      'Calibrated 120 days ago',
    );
    expect(describeCalibration({ lastRunAt: null, running: false }, now)).toBe('Never calibrated');
    expect(describeCalibration({ lastRunAt: now - 5_000, running: false }, now)).toBe('Calibrated just now');
    expect(describeCalibration({ lastRunAt: null, running: true }, now)).toBe('Calibrating…');
    expect(calibrationBlocked(true, false)).toBe('');
    expect(calibrationBlocked(false, false)).toMatch(/online/);
    expect(calibrationBlocked(true, true)).toMatch(/already running/);
  });
  it('compares versions numerically and knows when an update is on offer', () => {
    expect(compareVersions('v3.2.1', 'v3.2.2')).toBeLessThan(0);
    expect(compareVersions('v3.10.0', 'v3.9.9')).toBeGreaterThan(0);
    expect(compareVersions('v3.2', 'v3.2.0')).toBe(0);
    expect(updateAvailable({ installed: 'v3.2.1', latest: 'v3.2.2' })).toBe(true);
    expect(updateAvailable({ installed: 'v3.2.2', latest: 'v3.2.2' })).toBe(false);
    expect(updateAvailable({ installed: null, latest: 'v3.2.2' })).toBe(true);
    expect(formatCheck(null, Date.now())).toBe('Never');
    expect(formatCheck(Date.now(), Date.now())).toMatch(/^Today, /);
  });
});

describe('the dummy robot service', () => {
  it('serves the schema and defaults, saves values per robot, and restores factory settings', async () => {
    const o = fresh();
    expect((await o.config.schema(robot)).categories.length).toBeGreaterThan(5);
    expect((await o.config.get(robot)).max_exception_events).toBe(15);
    const saved = await o.config.save(robot, { ...CONFIG_SCHEMA.defaults, max_exception_events: 20 });
    expect(saved.max_exception_events).toBe(20);
    expect((await o.config.get({ ...robot, name: 'AMR-005' })).max_exception_events).toBe(15); // another robot is untouched
    expect((await o.config.restoreDefaults(robot)).max_exception_events).toBe(15);
  });
  it('keeps what it saved across instances (same storage)', async () => {
    const m = memoryStorage();
    const a = createDummyServices({ backend: m.backend }).robotOps;
    await a.config.save(robot, { ...CONFIG_SCHEMA.defaults, horn_volume: 10 });
    const b = createDummyServices({ backend: m.backend }).robotOps;
    expect((await b.config.get(robot)).horn_volume).toBe(10);
  });
  it('lists both calibrations (sensor done long ago, steering never) and records a run', async () => {
    const o = fresh();
    const before = await o.calibration.list(robot);
    expect(before.map((c) => [c.kind, c.lastRunAt === null])).toEqual([
      ['sensor', false],
      ['steering', true],
    ]);
    const done = await o.calibration.run(robot, 'steering');
    expect(done.lastRunAt).not.toBeNull();
    expect((await o.calibration.list(robot)).find((c) => c.kind === 'steering')?.lastRunAt).toBe(done.lastRunAt);
  });
  it("reports the robot's own firmware, installs the newest once, then refuses a second install", async () => {
    const o = fresh();
    const s = await o.software.status(robot);
    expect(s).toMatchObject({ installed: 'v3.2.1', latest: LATEST_FIRMWARE, installing: false });
    expect(s.history.map((h) => h.version)).toEqual(['v3.2.1', 'v3.1.0', 'v3.0.2']);
    const after = await o.software.install(robot);
    expect(after.installed).toBe(LATEST_FIRMWARE);
    expect(after.history[0]).toMatchObject({ version: LATEST_FIRMWARE, result: 'success' });
    await expect(o.software.install(robot)).rejects.toThrow(/newest version/);
    expect((await o.software.checkForUpdates(robot)).lastCheckedAt).not.toBeNull();
  });
});

describe("unassigning a fleet's map", () => {
  it('takes the map away and clears the station groups with it', () => {
    const f = fleetsStore.getState();
    f.assignMap('Test Fleet', 'm1');
    f.createGroup('Test Fleet', { name: 'G', stationId: 'STA-101', codes: ['A'] });
    expect(fleetsStore.getState().profiles['Test Fleet'].groups).toHaveLength(1);
    fleetsStore.getState().unassignMap('Test Fleet');
    expect(fleetsStore.getState().profiles['Test Fleet']).toEqual({ mapId: null, groups: [] });
  });
});
