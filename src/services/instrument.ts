import { log, metrics } from '@/platform';
import type { Services } from './ports';

/**
 * Wraps every service call: an asynchronous call is timed (`service.<port>.<method>`) and a failed one is logged with its name before the error goes on to the caller. The services
 * themselves stay free of logging, and the same wrapper serves the dummy and every real adapter.
 */
export function instrumentServices(services: Services): Services {
  const l = log.child('services');
  const wrap = <T extends object>(obj: T, path: string, depth: number): T => {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) {
      const name = `${path}.${key}`;
      if (typeof v === 'function') {
        out[key] = (...args: unknown[]) => {
          const result = (v as (...a: unknown[]) => unknown).apply(obj, args);
          if (!result || typeof (result as Promise<unknown>).then !== 'function') return result;
          const t0 = performance.now();
          return (result as Promise<unknown>).then(
            (value) => {
              metrics.timing(name, performance.now() - t0, { ok: true });
              return value;
            },
            (error: unknown) => {
              metrics.timing(name, performance.now() - t0, { ok: false });
              l.warn(`${name} failed`, error);
              throw error;
            },
          );
        };
      } else if (v && typeof v === 'object' && !Array.isArray(v) && depth > 0) out[key] = wrap(v, name, depth - 1);
      else out[key] = v;
    }
    return out as T;
  };
  return wrap(services, 'service', 2);
}
