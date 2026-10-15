import { afterEach, describe, expect, it } from 'vitest';
import {
  loggingMetricsSink,
  metrics,
  runtimeContext,
  setErrorReporter,
  setLogSinks,
  setMetricsSink,
  setRuntimeContext,
  reportError,
  log,
  type LogEntry,
} from '../src/platform';
import { instrumentServices } from '../src/services/instrument';
import { createDummyServices } from '../src/services/dummy';
import { memoryStorage } from './helpers/memoryStorage';

afterEach(() => {
  setMetricsSink(loggingMetricsSink);
  setRuntimeContext(() => ({}));
  setLogSinks([]);
});

describe('runtime context', () => {
  it('goes onto log lines, error reports and metrics', () => {
    setRuntimeContext(() => ({ user: 'arjun' }));
    const lines: LogEntry[] = [];
    setLogSinks([(e) => void lines.push(e)]);
    log.info('hello');
    expect(lines[0].context).toMatchObject({ user: 'arjun', release: 'dev' });
    const reports: unknown[] = [];
    setErrorReporter({ capture: (_e, ctx) => void reports.push(ctx) });
    reportError(new Error('x'), { where: 'test' });
    expect(reports[0]).toMatchObject({ where: 'test', extra: { user: 'arjun' } });
    const seen: unknown[] = [];
    setMetricsSink({ event: (n, p) => void seen.push([n, p]), timing: () => {}, vital: () => {} });
    metrics.track('page_view', { path: '/x' });
    expect(seen[0]).toEqual(['page_view', expect.objectContaining({ path: '/x', user: 'arjun' })]);
    expect(runtimeContext().user).toBe('arjun');
  });
});

describe('metrics', () => {
  it('times an operation, also when it fails, and a broken sink never breaks the app', async () => {
    const t: [string, boolean][] = [];
    setMetricsSink({
      event: () => {},
      timing: (n, _ms, p) => void t.push([n, Boolean(p.ok ?? true)]),
      vital: () => {},
    });
    expect(await metrics.time('a', async () => 5)).toBe(5);
    await expect(
      metrics.time('b', async () => {
        throw new Error('x');
      }),
    ).rejects.toThrow('x');
    expect(t.map(([n]) => n)).toEqual(['a', 'b']);
    setMetricsSink({
      event: () => {
        throw new Error('sink down');
      },
      timing: () => {},
      vital: () => {},
    });
    expect(() => metrics.track('still fine')).not.toThrow();
  });
});

describe('instrumented services', () => {
  it('times asynchronous calls, logs a failed one by name and passes results and errors through unchanged', async () => {
    const svc = createDummyServices({ backend: memoryStorage().backend });
    const timed: string[] = [];
    setMetricsSink({ event: () => {}, timing: (n, _ms, p) => void timed.push(`${n}:${p.ok}`), vital: () => {} });
    const lines: LogEntry[] = [];
    setLogSinks([(e) => void lines.push(e)]);
    const wrapped = instrumentServices(svc);
    expect(wrapped.users.snapshot()).toEqual(svc.users.snapshot()); // synchronous calls are untouched
    await wrapped.robotOps.config.get({ name: 'AMR-1', type: 'sherpa-xt-lite' });
    expect(timed).toContain('service.robotOps.config.get:true');
    await expect(wrapped.robotOps.software.install({ name: 'AMR-1', type: 'x', firmware: 'v3.2.2' })).rejects.toThrow(
      /newest version/,
    );
    expect(timed).toContain('service.robotOps.software.install:false');
    expect(
      lines.some((l) => l.level === 'warn' && l.message.includes('service.robotOps.software.install failed')),
    ).toBe(true);
  });
});
