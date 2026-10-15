import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPersister, flushAll, persistOnce, persistence } from '../src/data/persist';
import { setErrorReporter, setLogSinks } from '../src/platform';

const reported: unknown[] = [];
beforeEach(() => {
  reported.length = 0;
  setLogSinks([]); // the failures here are on purpose: keep the test output quiet
  setErrorReporter({ capture: (e) => void reported.push(e) });
  persistence.setState({ failed: {} });
});

describe('persister', () => {
  it('saves only the newest value of a burst, once, after the delay', async () => {
    vi.useFakeTimers();
    const saved: number[] = [];
    const p = createPersister<number>('t1', async (v) => void saved.push(v), { delayMs: 100 });
    p.queue(1);
    p.queue(2);
    p.queue(3);
    await vi.advanceTimersByTimeAsync(99);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(saved).toEqual([3]);
    vi.useRealTimers();
  });
  it('saves one at a time and the latest value wins while one is in flight', async () => {
    const saved: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const p = createPersister<number>('t2', async (v) => {
      if (v === 1) await gate;
      saved.push(v);
    });
    p.queue(1);
    const first = p.flush();
    p.queue(2);
    p.queue(3);
    release();
    await first;
    await p.flush();
    expect(saved).toEqual([1, 3]);
  });
  it('retries a failed save, then succeeds without reporting anything', async () => {
    let calls = 0;
    const p = createPersister<string>(
      't3',
      async () => {
        if (++calls < 3) throw new Error('offline');
      },
      { backoffMs: 1 },
    );
    p.queue('x');
    await p.flush();
    expect(calls).toBe(3);
    expect(persistence.getState().failed).toEqual({});
    expect(reported).toEqual([]);
  });
  it('gives up after the retries: reports, marks failed, and a retry saves the value again', async () => {
    let ok = false;
    const saved: string[] = [];
    const p = createPersister<string>(
      't4',
      async (v) => {
        if (!ok) throw new Error('server said no');
        saved.push(v);
      },
      { retries: 1, backoffMs: 1 },
    );
    p.queue('keep me');
    await p.flush();
    expect(persistence.getState().failed).toEqual({ t4: 'server said no' });
    expect(reported).toHaveLength(1);
    ok = true;
    p.retry();
    await p.flush();
    expect(saved).toEqual(['keep me']);
    expect(persistence.getState().failed).toEqual({});
  });
  it('flushAll saves what is waiting without waiting for the delay', async () => {
    const saved: string[] = [];
    const p = createPersister<string>('t5', async (v) => void saved.push(v), { delayMs: 60_000 });
    p.queue('last words');
    await flushAll();
    expect(saved).toEqual(['last words']);
  });
  it('persistOnce retries an operation and reports when it cannot be done', async () => {
    let n = 0;
    const flaky = async () => {
      if (++n < 2) throw new Error('flaky');
    };
    expect(await persistOnce('op1', flaky, { backoffMs: 1 })).toBe(true);
    expect(n).toBe(2);
    const broken = async () => {
      throw new Error('nope');
    };
    expect(await persistOnce('op2', broken, { retries: 1, backoffMs: 1 })).toBe(false);
    expect(persistence.getState().failed.op2).toBe('nope');
    expect(reported).toHaveLength(1);
  });
});
