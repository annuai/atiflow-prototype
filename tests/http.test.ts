import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ContractError, HttpError, NetworkError, createHttpClient } from '../src/platform';
import { setLogSinks } from '../src/platform';

setLogSinks([]);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
type Call = { url: string; init: RequestInit };
const client = (responses: (Response | Error)[], extra: Partial<Parameters<typeof createHttpClient>[0]> = {}) => {
  const calls: Call[] = [];
  const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next ?? json({});
  });
  return {
    calls,
    api: createHttpClient({ baseUrl: 'https://fm.example.com/v1', backoffMs: 1, fetch: fetchFn as never, ...extra }),
  };
};

describe('http client', () => {
  it('builds the address from the base, the path and the query, and sends the sign-in token', async () => {
    const { api, calls } = client([json({ ok: true })], { getToken: () => 'tok-123' });
    expect(await api.get('/robots', { query: { fleet: 'line side', page: 2, skip: undefined } })).toEqual({ ok: true });
    expect(calls[0].url).toBe('https://fm.example.com/v1/robots?fleet=line+side&page=2');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });
  it('sends a body as JSON and no token when signed out', async () => {
    const { api, calls } = client([json({ id: 1 })]);
    await api.post('/fleets', { body: { name: 'A' } });
    expect(calls[0].init.body).toBe('{"name":"A"}');
    const h = calls[0].init.headers as Record<string, string>;
    expect(h['Content-Type']).toBe('application/json');
    expect(h.Authorization).toBeUndefined();
  });
  it('turns a refusal into an HttpError that says what it was, and tells the app when the session ended', async () => {
    const seen: number[] = [];
    const { api } = client([json({ message: 'nope' }, 401), json({}, 404)], {
      onUnauthorized: (e) => void seen.push(e.status),
    });
    const e1 = (await api.get('/x').catch((e) => e)) as HttpError;
    expect(e1).toBeInstanceOf(HttpError);
    expect(e1.unauthorized).toBe(true);
    expect(e1.body).toEqual({ message: 'nope' });
    expect(seen).toEqual([401]);
    const e2 = (await api.get('/y').catch((e) => e)) as HttpError;
    expect(e2.notFound).toBe(true);
  });
  it('repeats a GET that failed in a way worth repeating, but never a POST', async () => {
    const a = client([json({}, 503), json({}, 502), json({ ok: 1 })]);
    expect(await a.api.get('/r')).toEqual({ ok: 1 });
    expect(a.calls).toHaveLength(3);
    const b = client([json({}, 503), json({ ok: 1 })]);
    await expect(b.api.post('/r', { body: {} })).rejects.toBeInstanceOf(HttpError);
    expect(b.calls).toHaveLength(1);
    const c = client([json({}, 400), json({ ok: 1 })]);
    await expect(c.api.get('/r')).rejects.toBeInstanceOf(HttpError); // a bad request is not repeated
    expect(c.calls).toHaveLength(1);
  });
  it('reports a network failure and a timeout as NetworkError', async () => {
    const a = client([new Error('offline'), new Error('offline'), new Error('offline')]);
    const e = await a.api.get('/r').catch((x) => x);
    expect(e).toBeInstanceOf(NetworkError);
    expect(a.calls).toHaveLength(3);
    const slow = createHttpClient({
      baseUrl: 'https://x.test',
      timeoutMs: 10,
      retries: 0,
      fetch: ((_u: string, init: RequestInit) =>
        new Promise((_r, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted'))))) as never,
    });
    const t = (await slow.get('/r').catch((x) => x)) as NetworkError;
    expect(t).toBeInstanceOf(NetworkError);
    expect(t.timedOut).toBe(true);
  });
  it('checks the answer against a schema and refuses one that does not match the contract', async () => {
    const Robot = z.object({ id: z.string(), battery: z.number() });
    const ok = client([json({ id: 'AMR-1', battery: 80 })]);
    const r = await ok.api.get('/robots/1', { schema: Robot });
    expect(r.battery).toBe(80);
    const bad = client([json({ id: 'AMR-1', battery: 'full' })]);
    const e = await bad.api.get('/robots/1', { schema: Robot }).catch((x) => x);
    expect(e).toBeInstanceOf(ContractError);
    expect(e.issues[0]).toMatch(/battery/);
  });
});
