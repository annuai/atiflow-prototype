import type { z } from 'zod';
import { log } from './logger';
import { metrics } from './metrics';

/**
 * The one way the front end talks HTTP to a real system (Fleet Manager, Deployment Manager, identity provider). The adapters of phase 3 are written on top of it, so that timeouts,
 * retries, sign-in tokens, error types, logging and timing exist ONCE. No endpoint of any particular system is known here.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body: unknown,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
  }
  /** The person is not signed in (or the session ended): the app should go to the sign-in screen. */
  get unauthorized() {
    return this.status === 401;
  }
  get forbidden() {
    return this.status === 403;
  }
  get notFound() {
    return this.status === 404;
  }
  /** Worth trying again later: the server or the network had a problem, not the request. */
  get transient() {
    return this.status >= 500 || this.status === 429 || this.status === 408;
  }
}
/** The request never got an answer (offline, refused, timed out). */
export class NetworkError extends Error {
  constructor(
    readonly url: string,
    cause: unknown,
    readonly timedOut = false,
  ) {
    super(timedOut ? `Timed out: ${url}` : `Network error: ${url}`, { cause });
    this.name = 'NetworkError';
  }
}
/** The answer arrived but is not what the contract says. */
export class ContractError extends Error {
  constructor(
    readonly url: string,
    readonly issues: string[],
  ) {
    super(`Unexpected answer from ${url}: ${issues.slice(0, 3).join('; ')}`);
    this.name = 'ContractError';
  }
}

export interface HttpOptions {
  baseUrl: string;
  /** The current sign-in token (read for every request), or nothing when signed out. */
  getToken?: () => string | null | undefined;
  /** Called when a request is refused as unauthorized (the session ended), once per request. */
  onUnauthorized?: (error: HttpError) => void;
  /** Extra headers sent with every request (for example a client id). */
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Extra attempts for a GET that failed in a way worth repeating (default 2). Other methods are never repeated: they might have worked. */
  retries?: number;
  backoffMs?: number;
  fetch?: typeof fetch;
}
export interface RequestOptions<S extends z.ZodType | undefined = undefined> {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  /** Check the answer against the contract; a mismatch is a `ContractError`, never half-parsed data. */
  schema?: S;
}
type Out<S> = S extends z.ZodType ? z.infer<S> : unknown;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createHttpClient(opts: HttpOptions) {
  const { baseUrl, getToken, onUnauthorized, headers = {}, timeoutMs = 15_000, retries = 2, backoffMs = 300 } = opts;
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const l = log.child('http');
  const urlOf = (path: string, query?: RequestOptions['query']) => {
    const u = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) u.searchParams.set(k, String(v));
    return u.toString();
  };

  async function once(method: string, url: string, o: RequestOptions<z.ZodType | undefined>): Promise<unknown> {
    const ctl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => ((timedOut = true), ctl.abort()), timeoutMs);
    o.signal?.addEventListener('abort', () => ctl.abort(), { once: true });
    const token = getToken?.();
    let res: Response;
    try {
      res = await doFetch(url, {
        method,
        signal: ctl.signal,
        headers: {
          Accept: 'application/json',
          ...(o.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
      });
    } catch (e) {
      throw new NetworkError(url, e, timedOut);
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let json: unknown = undefined;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
    if (!res.ok) {
      const err = new HttpError(res.status, url, json);
      if (err.unauthorized) onUnauthorized?.(err);
      throw err;
    }
    if (o.schema) {
      const r = o.schema.safeParse(json);
      if (!r.success)
        throw new ContractError(
          url,
          r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
        );
      return r.data;
    }
    return json;
  }

  async function request<S extends z.ZodType | undefined = undefined>(
    method: string,
    path: string,
    o: RequestOptions<S> = {},
  ): Promise<Out<S>> {
    const url = urlOf(path, o.query);
    const attempts = method === 'GET' ? retries + 1 : 1;
    return metrics.time(
      `http.${method.toLowerCase()}`,
      async () => {
        for (let n = 1; ; n++) {
          try {
            return (await once(method, url, o as RequestOptions<z.ZodType | undefined>)) as Out<S>;
          } catch (e) {
            const again =
              n < attempts &&
              ((e instanceof HttpError && e.transient) || (e instanceof NetworkError && !o.signal?.aborted));
            if (!again) throw e;
            l.warn(`${method} ${url} failed (attempt ${n} of ${attempts}), trying again`, e);
            await sleep(backoffMs * 2 ** (n - 1));
          }
        }
      },
      { path },
    );
  }
  return {
    get: <S extends z.ZodType | undefined = undefined>(path: string, o?: RequestOptions<S>) => request('GET', path, o),
    post: <S extends z.ZodType | undefined = undefined>(path: string, o?: RequestOptions<S>) =>
      request('POST', path, o),
    put: <S extends z.ZodType | undefined = undefined>(path: string, o?: RequestOptions<S>) => request('PUT', path, o),
    patch: <S extends z.ZodType | undefined = undefined>(path: string, o?: RequestOptions<S>) =>
      request('PATCH', path, o),
    delete: <S extends z.ZodType | undefined = undefined>(path: string, o?: RequestOptions<S>) =>
      request('DELETE', path, o),
  };
}
export type HttpClient = ReturnType<typeof createHttpClient>;
