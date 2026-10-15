import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createValidatedDocument, type StorageBackend } from '../src/data/storage';
import { DEFAULT_CONFIG, fromEnv, getConfig, isFeatureEnabled, loadConfig, mergeConfig, setConfig } from '../src/platform/config';
import { installGlobalErrorHandlers, loggingReporter, reportError, setErrorReporter } from '../src/platform/errorReporter';
import { createLogger, setLogSinks, consoleSink, type LogEntry } from '../src/platform/logger';
import { BookingsDocumentSchema } from '../src/features/bookings/model/schema';

const memory = (initial: string | null = null): StorageBackend & { text: string | null } => { const b = { text: initial, read: () => b.text, write: (t: string) => { b.text = t; }, remove: () => { b.text = null; } }; return b; };

describe('runtime configuration', () => {
  afterEach(() => setConfig({}));
  it('has safe defaults: development, dummy data, no API urls, no flags', () => {
    expect(DEFAULT_CONFIG).toMatchObject({ environment: 'development', dataMode: 'dummy', logLevel: 'info', api: {}, features: {}, errorReporting: { enabled: false } });
    expect(isFeatureEnabled('anything')).toBe(false);
  });
  it('layers: defaults < VITE_ variables < config.json; nested keys merge; a missing config.json is fine', async () => {
    const env = { VITE_DATA_MODE: 'api', VITE_FLEET_MANAGER_URL: 'https://fm.example.com', VITE_ENVIRONMENT: 'staging' };
    const c = await loadConfig({ env, fetchJson: async () => ({ release: '1.4.2', api: { deploymentManager: 'https://dm.example.com' }, features: { newMaps: true }, environment: 'production' }) });
    expect(c).toMatchObject({ dataMode: 'api', environment: 'production', release: '1.4.2', api: { fleetManager: 'https://fm.example.com', deploymentManager: 'https://dm.example.com' } }); expect(isFeatureEnabled('newMaps')).toBe(true); expect(getConfig()).toBe(c);
    const problems: string[] = []; const d = await loadConfig({ fetchJson: async () => { throw new Error('HTTP 404'); }, onProblem: (m) => problems.push(m) }); expect(d).toEqual(DEFAULT_CONFIG); expect(problems[0]).toMatch(/404/);
  });
  it('an invalid configuration is reported and ignored as a whole, never half used', async () => {
    const problems: string[] = []; const c = await loadConfig({ fetchJson: async () => ({ dataMode: 'cloud', api: { fleetManager: 'not a url' } }), onProblem: (m) => problems.push(m) });
    expect(c).toEqual(DEFAULT_CONFIG); expect(problems[0]).toMatch(/dataMode|fleetManager/);
  });
  it('maps env variables and merges layers key by key', () => {
    expect(fromEnv({ VITE_LOG_LEVEL: 'debug', VITE_AUTH_URL: 'https://auth' })).toEqual({ logLevel: 'debug', api: { auth: 'https://auth' } }); expect(fromEnv({})).toEqual({});
    expect(mergeConfig({ api: { a: 1 }, x: 1 }, { api: { b: 2 }, x: 2 })).toEqual({ api: { a: 1, b: 2 }, x: 2 });
  });
});

describe('logger and error reporting', () => {
  afterEach(() => { setLogSinks([consoleSink]); setErrorReporter(loggingReporter); });
  it('prints only what the level allows, with the scope of the module', () => {
    const lines: LogEntry[] = []; setLogSinks([(e) => lines.push(e)]); let level: 'debug' | 'warn' | 'silent' = 'warn'; const l = createLogger('bookings', () => level).child('store');
    l.debug('quiet'); l.info('quiet'); l.warn('careful', { id: 1 }); l.error('broken'); expect(lines.map((e) => [e.level, e.scope, e.message])).toEqual([['warn', 'bookings:store', 'careful'], ['error', 'bookings:store', 'broken']]);
    level = 'silent'; l.error('nobody hears'); expect(lines).toHaveLength(2); level = 'debug'; l.debug('now'); expect(lines).toHaveLength(3);
  });
  it('reports errors to the registered reporter, survives a reporter that throws, and catches uncaught errors', () => {
    const seen: unknown[] = []; setErrorReporter({ capture: (e, c) => seen.push([e, c]) }); reportError(new Error('x'), { where: 'page' }); expect(seen).toHaveLength(1);
    setLogSinks([]); setErrorReporter({ capture: () => { throw new Error('reporter down'); } }); expect(() => reportError('y')).not.toThrow();
    setErrorReporter({ capture: (e, c) => seen.push([e, c]) }); const handlers: Record<string, (e: unknown) => void> = {}; const off = installGlobalErrorHandlers({ addEventListener: (t: string, h: never) => { handlers[t] = h; }, removeEventListener: vi.fn() } as never);
    handlers.error({ error: new Error('boom') }); handlers.unhandledrejection({ reason: 'nope' }); expect(seen.slice(1).map((s) => (s as [unknown, { where: string }])[1].where)).toEqual(['window.onerror', 'unhandledrejection']); off();
  });
});

describe('a document checked against a schema', () => {
  const Schema = z.object({ items: z.array(z.object({ id: z.string(), qty: z.number() })), seq: z.number() }); const seed = () => ({ items: [], seq: 0 });
  it('uses valid saved data, falls back to the seed (keeping what was saved) when it does not match, and migrates older shapes', () => {
    const good = memory(JSON.stringify({ items: [{ id: 'a', qty: 2 }], seq: 1 })); expect(createValidatedDocument({ backend: good, schema: Schema, seed }).load()).toEqual({ items: [{ id: 'a', qty: 2 }], seq: 1 });
    const bad = memory(JSON.stringify({ items: 'oops' })); const why: string[] = []; const d = createValidatedDocument({ backend: bad, schema: Schema, seed, onInvalid: (r) => why.push(r) }); expect(d.load()).toEqual(seed()); expect(why[0]).toMatch(/items/); expect(bad.text).toContain('oops');
    const old = memory(JSON.stringify({ list: [{ id: 'z', qty: 5 }] })); const m = createValidatedDocument({ backend: old, schema: Schema, seed, migrate: (raw) => ({ items: (raw as { list: unknown[] }).list, seq: 0 }) }); expect(m.load()).toEqual({ items: [{ id: 'z', qty: 5 }], seq: 0 });
    expect(createValidatedDocument({ backend: memory('not json'), schema: Schema, seed }).load()).toEqual(seed()); expect(createValidatedDocument({ backend: memory(), schema: Schema, seed }).load()).toEqual(seed());
  });
  it('saves, exports, parses with an error message, and resets', () => {
    const b = memory(); const d = createValidatedDocument({ backend: b, schema: Schema, seed }); d.save({ items: [], seq: 3 }); expect(JSON.parse(b.text!)).toEqual({ items: [], seq: 3 }); expect(d.parse('{"items":[],"seq":"x"}')).toHaveProperty('error'); expect(d.parse('{')).toEqual({ error: 'This is not valid JSON.' });
    expect(d.reset()).toEqual(seed()); expect(b.text).toBeNull();
  });
  it('the booked-trips document: an empty one and one trip are valid; a trip with a wrong status is not', () => {
    const trip = { id: 'BKG-0001', tripId: 'TRP-001', fleet: 'F', fleetLive: 'f', robotType: 'r', robotLabel: 'R', from: 'A', to: 'B', fromName: 'A', toName: 'B', status: 'approved', history: [{ status: 'approved', at: 1 }], bookedBy: 'u', bookedByName: 'U', createdAt: 1 };
    expect(BookingsDocumentSchema.safeParse({ trips: [], seq: 0 }).success).toBe(true); expect(BookingsDocumentSchema.safeParse({ trips: [trip], seq: 1 }).success).toBe(true); expect(BookingsDocumentSchema.safeParse({ trips: [{ ...trip, status: 'flying' }], seq: 1 }).success).toBe(false);
  });
});
