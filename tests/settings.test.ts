import { describe, expect, it } from 'vitest';
import { canOpen } from '../src/features/access';
import { CONNECTIONS, connectionById } from '../src/features/settings/model/connections';
import { statusOf } from '../src/features/settings/model/status';
import { connectionErrors, fieldError } from '../src/features/settings/model/validate';
import { seedSettings } from '../src/fixtures/settings';
import { mockTester, setConnectionTester } from '../src/features/settings/data/tester';
import { settingsStore } from '../src/features/settings/data/store';

const fm = connectionById('fleet-manager'),
  mes = connectionById('mes');

describe('settings: connection catalog and validation', () => {
  it('Fleet Manager has a host and credentials and syncs; MES has the AMR and BOM URLs', () => {
    expect(CONNECTIONS.map((c) => c.id)).toEqual(['fleet-manager', 'mes']);
    expect(fm.fields.map((f) => f.key)).toEqual(['host', 'clientId', 'clientSecret']);
    expect(fm.syncs).toBe(true);
    expect(mes.fields.map((f) => f.key)).toEqual(['amrUrl', 'bomUrl']);
    expect(mes.syncs).toBe(false);
  });
  it('hosts are an IPv4 address or a host name (port allowed); URLs are full http(s) addresses; empty is only fine when optional', () => {
    const host = fm.fields[0],
      url = mes.fields[0];
    for (const ok of ['192.168.100.31', '192.168.0.1:8080', 'fleet.example.com', 'fm-01.local:443'])
      expect(fieldError(host, ok), ok).toBe('');
    for (const bad of ['', '999.1.1.1.1', 'not a host', 'http://x.y']) expect(fieldError(host, bad), bad).not.toBe('');
    expect(fieldError(url, 'https://mes.example.com/amr')).toBe('');
    expect(fieldError(url, 'mes.example.com')).not.toBe('');
    expect(fieldError(url, 'ftp://mes.example.com')).not.toBe('');
    expect(fieldError({ ...url, required: false }, '')).toBe('');
    expect(connectionErrors(mes, { amrUrl: 'bad', bomUrl: 'https://ok.example.com' })).toEqual({
      amrUrl: expect.any(String),
    });
  });
});

describe('settings: status says what is wrong', () => {
  it('missing fields come first (named), then invalid ones, then a failed test; complete and untested counts as connected', () => {
    expect(statusOf(mes, { values: { amrUrl: '', bomUrl: '' } })).toMatchObject({
      status: 'issues',
      detail: 'AMR URL and BOM URL are not set.',
    });
    expect(statusOf(mes, { values: { amrUrl: 'https://a.example.com', bomUrl: '' } }).detail).toBe(
      'BOM URL is not set.',
    );
    expect(statusOf(mes, { values: { amrUrl: 'nope', bomUrl: 'https://b.example.com' } }).detail).toBe(
      'AMR URL is not valid.',
    );
    const ok = { amrUrl: 'https://a.example.com', bomUrl: 'https://b.example.com' };
    expect(statusOf(mes, { values: ok }).status).toBe('connected');
    expect(statusOf(mes, { values: ok, lastTest: { ok: false, message: 'Timed out', at: 1 } })).toMatchObject({
      status: 'issues',
      detail: 'Timed out',
    });
    expect(statusOf(fm, seedSettings().connections['fleet-manager']).status).toBe('connected');
    expect(statusOf(fm, { values: { host: '192.168.100.31' } }).detail).toBe(
      'Client ID and Client secret are not set.',
    );
  });
});

describe('settings: mock tester and store', () => {
  it('the mock test answers for good and bad values; saving new values clears the last test; sync records the time', async () => {
    const t = mockTester(0);
    const creds = { clientId: 'id', clientSecret: 'secret' };
    expect(await t.test(fm, { host: '192.168.100.31', ...creds })).toMatchObject({ ok: true });
    expect((await t.test(fm, { host: 'x.invalid', ...creds })).message).toMatch(/No answer/);
    expect((await t.test(fm, { host: '192.168.100.31' })).message).toBe('Client ID: Required');
    setConnectionTester(t);
    const s = settingsStore.getState();
    s.reset();
    const r = await s.test('fleet-manager');
    expect(r.ok).toBe(true);
    expect(settingsStore.getState().connections['fleet-manager'].lastTest?.ok).toBe(true);
    settingsStore.getState().saveConnection('fleet-manager', { host: '10.0.0.5' });
    expect(settingsStore.getState().connections['fleet-manager'].lastTest).toBeUndefined();
    const before = settingsStore.getState().connections['fleet-manager'].lastSynced!;
    await settingsStore.getState().sync('fleet-manager');
    expect(settingsStore.getState().connections['fleet-manager'].lastSynced!).toBeGreaterThan(before);
    settingsStore.getState().saveGeneral({ ...settingsStore.getState().general, siteName: 'Plant B' });
    expect(settingsStore.getState().general.siteName).toBe('Plant B');
  });
});

describe('settings: access', () => {
  it('a configurator opens Settings, a supervisor does not, and it is a permission that can be ticked for anyone', () => {
    expect(canOpen({ role: 'configurator' }, '/configurator/settings/connections')).toBe(true);
    expect(canOpen({ role: 'supervisor' }, '/configurator/settings')).toBe(false);
    expect(
      canOpen(
        { role: 'supervisor', custom: { add: ['configurator.settings'], remove: [] } },
        '/configurator/settings/general',
      ),
    ).toBe(true);
    expect(
      canOpen(
        { role: 'configurator', custom: { add: [], remove: ['configurator.settings'] } },
        '/configurator/settings',
      ),
    ).toBe(false);
  });
});
