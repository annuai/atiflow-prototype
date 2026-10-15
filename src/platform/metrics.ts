import { log } from './logger';
import { runtimeContext } from './context';

/**
 * What the app measures about itself: things people do (`event`), how long things take (`timing`) and how the page feels (`vital`: loading, layout shifts, input delay). Where it goes
 * is a sink: the default only logs at debug level; a product-analytics or monitoring service is another sink registered at start-up. Nothing here sends data anywhere by itself.
 */
export type MetricProps = Record<string, string | number | boolean | undefined>;
export interface MetricsSink {
  event(name: string, props: MetricProps): void;
  timing(name: string, ms: number, props: MetricProps): void;
  vital(name: string, value: number): void;
}
const m = log.child('metrics');
export const loggingMetricsSink: MetricsSink = {
  event: (name, props) => m.debug(`event ${name}`, props),
  timing: (name, ms, props) => m.debug(`timing ${name} ${Math.round(ms)} ms`, props),
  vital: (name, value) => m.debug(`vital ${name} ${Math.round(value * 1000) / 1000}`),
};
let sink: MetricsSink = loggingMetricsSink;
export function setMetricsSink(next: MetricsSink) {
  sink = next;
}
const safe = (f: () => void) => {
  try {
    f();
  } catch (e) {
    log.child('metrics').warn('the metrics sink failed', e); // a broken sink must never break the app
  }
};
export const metrics = {
  /** Something a person did or something that happened: `track('trip_booked', { fleet })`. */
  track: (name: string, props: MetricProps = {}) => safe(() => sink.event(name, { ...runtimeContext(), ...props })),
  timing: (name: string, ms: number, props: MetricProps = {}) =>
    safe(() => sink.timing(name, ms, { ...runtimeContext(), ...props })),
  /** Time an operation (also when it fails): `await metrics.time('config.save', () => save())`. */
  async time<T>(name: string, run: () => Promise<T>, props: MetricProps = {}): Promise<T> {
    const t0 = performance.now();
    try {
      return await run();
    } finally {
      metrics.timing(name, performance.now() - t0, props);
    }
  },
};

/** Reports the browser's own page measurements (largest paint, layout shift, slowest input) to the sink. Returns the function that stops watching. */
export function observeWebVitals(): () => void {
  if (typeof PerformanceObserver === 'undefined') return () => {};
  const observers: PerformanceObserver[] = [];
  const watch = (type: string, onEntry: (e: PerformanceEntry) => void, extraInit: object = {}) => {
    try {
      const o = new PerformanceObserver((list) => list.getEntries().forEach(onEntry));
      o.observe({ type, buffered: true, ...extraInit } as PerformanceObserverInit);
      observers.push(o);
    } catch {
      /* this browser does not know that measurement */
    }
  };
  let cls = 0;
  watch('largest-contentful-paint', (e) => safe(() => sink.vital('LCP', e.startTime)));
  watch('layout-shift', (e) => {
    const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
    if (!s.hadRecentInput) safe(() => sink.vital('CLS', (cls += s.value)));
  });
  watch('event', (e) => safe(() => sink.vital('INP', e.duration)), { durationThreshold: 40 });
  return () => observers.forEach((o) => o.disconnect());
}
