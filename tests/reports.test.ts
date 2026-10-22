import { describe, expect, it } from 'vitest';
import { MeasurementLog, type Measured, type RobotMeasure } from '../src/core/measurements';
import {
  HEADLINE,
  METRICS,
  METRIC_ORDER,
  TREND_METRICS,
  metricsOf,
  withUnit,
} from '../src/features/reports/model/metrics';
import { change, moves, summary } from '../src/features/reports/model/derive';
import { buildReport } from '../src/features/reports/model/kpis';
import { previousRange, resolveRange } from '../src/features/reports/model/range';
import { createReportSource } from '../src/features/reports/data/source';
import type { MetricValues, Report } from '../src/features/reports/model/types';

const NOW = new Date(2026, 9, 13, 14, 0);

describe('metric catalog: which direction is better, and where each KPI of the board lives', () => {
  it('has the ten board KPIs with the right direction, each in one of the four headings; five of them lead the page', () => {
    const better = (id: keyof typeof METRICS) => METRICS[id].better;
    for (const id of ['utilisation', 'throughput', 'mtbf', 'sla', 'chargingAvailability', 'trips', 'distance'] as const)
      expect(better(id)).toBe('higher');
    for (const id of ['idleTime', 'cycleTime', 'deadlocks', 'emptyTravel', 'energy', 'obstacle'] as const)
      expect(better(id)).toBe('lower');
    expect(metricsOf('utilisation').map((m) => m.id)).toEqual(['utilisation', 'idleTime']);
    expect(metricsOf('throughput').map((m) => m.id)).toEqual(['throughput', 'cycleTime']);
    expect(metricsOf('reliability').map((m) => m.id)).toEqual(['deadlocks', 'mtbf', 'sla', 'chargingAvailability']);
    expect(metricsOf('efficiency').map((m) => m.id)).toEqual(['emptyTravel', 'energy']);
    for (const id of METRIC_ORDER) {
      expect(METRICS[id].measuredBy.length).toBeGreaterThan(5);
      expect(METRICS[id].definition.length).toBeGreaterThan(10);
    }
    expect(HEADLINE).toEqual(['utilisation', 'throughput', 'deadlocks', 'sla', 'chargingAvailability']);
    expect(TREND_METRICS.every((id) => METRIC_ORDER.includes(id))).toBe(true);
    expect(withUnit(METRICS.sla, 84.4)).toBe('84%');
    expect(withUnit(METRICS.cycleTime, 3.25)).toMatch(/^3[.,][23]5? min$|^3[.,]3 min$|^3[.,]2 min$/);
  });
  it('change against the previous period says whether it moved to the better side of its own metric', () => {
    expect(change(METRICS.trips, 110, 100)).toMatchObject({ improved: true });
    expect(change(METRICS.cycleTime, 11, 10)).toMatchObject({ improved: false });
    expect(change(METRICS.cycleTime, 9, 10)).toMatchObject({ improved: true });
    expect(change(METRICS.trips, 100, null)).toBeNull();
    expect(change(METRICS.trips, 100, 100)).toMatchObject({ improved: null });
  });
});

describe('the verdict and what changed', () => {
  const blank = Object.fromEntries(METRIC_ORDER.map((id) => [id, null])) as MetricValues;
  const fleet = (over: Partial<MetricValues>): MetricValues => ({
    ...blank,
    utilisation: 80,
    throughput: 100,
    deadlocks: 5,
    sla: 85,
    chargingAvailability: 90,
    cycleTime: 3,
    ...over,
  });
  const report = (f: MetricValues, p: MetricValues | null): Report => ({
    range: resolveRange({ preset: 'today' }, NOW),
    generatedAt: 0,
    origin: { kind: 'sample' },
    fleet: f,
    previous: p,
    series: {},
  });
  it('is steady when nothing slipped, and says how many headline KPIs improved or held', () => {
    expect(summary(report(fleet({ sla: 90 }), fleet({})))).toMatchObject({
      level: 'ok',
      headline: 'The fleet is steady',
    });
    expect(summary(report(fleet({ sla: 90 }), fleet({}))).detail).toMatch(/^5 of 5/);
  });
  it('warns when a headline KPI slipped 10%+ (direction aware: MORE deadlocks is worse), critical at 25%+ or when availability is below the 85% target', () => {
    expect(summary(report(fleet({ sla: 70 }), fleet({})))).toMatchObject({
      level: 'warn',
      headline: 'Trips on time slipped',
    });
    expect(summary(report(fleet({ deadlocks: 7 }), fleet({}))).headline).toMatch(/Traffic jams slipped/);
    expect(summary(report(fleet({ throughput: 60 }), fleet({})))).toMatchObject({ level: 'critical' });
    expect(summary(report(fleet({ chargingAvailability: 78 }), fleet({})))).toMatchObject({
      level: 'critical',
      headline: 'Fleet availability is below target',
    });
    expect(summary(report(fleet({ sla: 95, deadlocks: 3 }), fleet({}))).level).toBe('ok'); // better is never a warning
  });
  it('without a previous period there is no comparison to make, only the plain state', () => {
    expect(summary(report(fleet({}), null))).toMatchObject({ level: 'ok', headline: 'The fleet is running normally' });
    expect(moves(report(fleet({}), null))).toEqual([]);
  });
  it('moves lists every KPI that changed 2%+, biggest first, flagged improved or not', () => {
    const m = moves(report(fleet({ sla: 70, cycleTime: 2, utilisation: 80.5 }), fleet({})));
    expect(m.map((x) => x.metric.id)).toEqual(['cycleTime', 'sla']);
    expect(m[0]).toMatchObject({ improved: true });
    expect(m[1]).toMatchObject({ improved: false });
  });
});

describe('KPI formulas (kpis.ts) on hand-made building blocks', () => {
  const r = (id: string, over: Partial<RobotMeasure>, secs: Partial<RobotMeasure['seconds']> = {}): RobotMeasure => ({
    robotId: id,
    fleetId: 'f',
    seconds: { exec: 0, idle: 0, charging: 0, error: 0, offline: 0, other: 0, total: 0, ...secs },
    blockedS: 0,
    trips: 0,
    cycleS: 0,
    slaMet: 0,
    slaTotal: 0,
    emptyM: 0,
    loadedM: 0,
    kWh: 0,
    faults: 0,
    ...over,
  });
  // one hour observed. A: 40 min exec, 10 idle, 10 charging; 6 trips of 5 min, 5 on time, 600 m empty + 1400 m loaded, 0.5 kWh, 1 fault. B: offline half the hour, idle the rest.
  const A = r(
    'A',
    {
      trips: 6,
      cycleS: 6 * 300,
      slaMet: 5,
      slaTotal: 6,
      emptyM: 600,
      loadedM: 1400,
      kWh: 0.5,
      faults: 1,
      blockedS: 120,
    },
    { exec: 2400, idle: 600, charging: 600, total: 3600 },
  );
  const B = r('B', {}, { idle: 1800, offline: 1800, total: 3600 });
  const m: Measured = {
    from: 0,
    to: 3_600_000,
    observedS: 3600,
    robots: [A, B],
    deadlocks: 2,
    availMet: 45,
    availTotal: 60,
    hourly: [
      {
        t: 0,
        observedS: 3600,
        trips: 6,
        deadlocks: 2,
        slaMet: 5,
        slaTotal: 6,
        availMet: 45,
        availTotal: 60,
        execS: 2400,
        onlineS: 5400,
      },
    ],
  };
  const rep = buildReport(resolveRange({ preset: 'today' }, NOW), m, null, { kind: 'sample' });
  it('fleet figures are ratios of sums: the offline robot counts only for the time it was in service, rates use the observed hours', () => {
    expect(rep.fleet.utilisation).toBeCloseTo(44.4, 1);
    expect(rep.fleet.idleTime).toBeCloseTo((600 + 1800) / 60 / (5400 / 3600), 1);
    expect(rep.fleet.throughput).toBe(6);
    expect(rep.fleet.cycleTime).toBeCloseTo(5, 5);
    expect(rep.fleet.deadlocks).toBe(2);
    expect(rep.fleet.chargingAvailability).toBe(75);
    expect(rep.fleet.mtbf).toBeCloseTo(1.5, 2);
    expect(rep.fleet.sla).toBeCloseTo(83.3, 1);
    expect(rep.fleet.emptyTravel).toBeCloseTo(30, 1);
    expect(rep.fleet.energy).toBeCloseTo(0.0833, 3);
    expect(rep.fleet.obstacle).toBeCloseTo(1.33, 1);
    expect(rep.fleet.trips).toBe(6);
    expect(rep.fleet.distance).toBeCloseTo(2, 3);
  });
  it('series come per hour for the trend metrics only; nothing to divide gives null, never NaN', () => {
    expect(Object.keys(rep.series).sort()).toEqual([...TREND_METRICS].sort());
    expect(rep.series.sla![0].value).toBeCloseTo(83.3, 1);
    const empty = buildReport(
      resolveRange({ preset: 'today' }, NOW),
      { ...m, robots: [r('Z', {})], observedS: 0, deadlocks: 0, availTotal: 0, hourly: [] },
      null,
      { kind: 'sample' },
    );
    expect(Object.values(empty.fleet).every((v) => v === null || (typeof v === 'number' && Number.isFinite(v)))).toBe(
      true,
    );
    expect(empty.fleet.sla).toBeNull();
  });
});

describe('ranges', () => {
  it('presets resolve to whole days with their words; the previous period is the same length just before', () => {
    const d7 = resolveRange({ preset: '7d' }, NOW);
    expect(d7.days).toBe(7);
    expect(d7.from.getDate()).toBe(7);
    expect(d7.label).toBe('Last 7 days');
    const p = previousRange(d7);
    expect(p.days).toBe(7);
    expect(p.to.getDate()).toBe(6);
    expect(resolveRange({ preset: 'today' }, NOW).previousLabel).toBe('yesterday');
  });
  it('a custom range counts its days either way round; without dates it falls back to 7 days', () => {
    expect(resolveRange({ preset: 'custom', from: new Date(2026, 9, 10), to: new Date(2026, 9, 1) }, NOW).days).toBe(
      10,
    );
    expect(resolveRange({ preset: 'custom' }, NOW).days).toBe(7);
  });
});

describe('the report source: measured for today, sample otherwise, same formulas', () => {
  const roster = async () => ['AMR-001', 'AMR-002', 'AMR-003'].map((id) => ({ id, fleetId: 'line-side' }));
  it('sample reports are stable, have every fleet figure inside sane limits, a previous period and trends', async () => {
    const s = createReportSource({ roster, now: () => NOW });
    const a = await s.fetch(resolveRange({ preset: '7d' }, NOW)),
      b = await s.fetch(resolveRange({ preset: '7d' }, NOW));
    expect(a.origin.kind).toBe('sample');
    expect(a.fleet).toEqual(b.fleet);
    expect(a.previous).not.toBeNull();
    expect(a.series.utilisation!.length).toBe(7);
    for (const id of METRIC_ORDER) {
      expect(a.fleet[id], id).not.toBeNull();
      expect(Number.isFinite(a.fleet[id]!)).toBe(true);
    }
    expect(a.fleet.utilisation!).toBeGreaterThan(30);
    expect(a.fleet.utilisation!).toBeLessThanOrEqual(100);
    expect(a.fleet.sla!).toBeLessThanOrEqual(100);
    expect(a.fleet.emptyTravel!).toBeLessThanOrEqual(100);
  });
  it('a fleet filter limits the sample to that fleet’s robots, and reaches the live query', async () => {
    const two = async () => [
      ...['A1', 'A2', 'A3'].map((id) => ({ id, fleetId: 'a' })),
      ...['B1', 'B2'].map((id) => ({ id, fleetId: 'b' })),
    ];
    const s = createReportSource({ roster: two, now: () => NOW });
    const all = await s.fetch(resolveRange({ preset: '7d' }, NOW));
    const a = await s.fetch(resolveRange({ preset: '7d' }, NOW), 'a');
    const b = await s.fetch(resolveRange({ preset: '7d' }, NOW), 'b');
    // the sample is built from the robots of the roster, so fewer robots give different totals
    expect(a.fleet.trips).not.toBe(b.fleet.trips);
    expect(all.fleet.trips).not.toBe(a.fleet.trips);
    const seen: (string | undefined)[] = [];
    const log = new MeasurementLog();
    const live = { query: (f: number, t: number, fleet?: string) => (seen.push(fleet), log.query(f, t, fleet)) };
    const s2 = createReportSource({ roster: two, live, now: () => NOW });
    await s2.fetch(resolveRange({ preset: 'today' }, NOW), 'b');
    await s2.fetch(resolveRange({ preset: 'today' }, NOW));
    expect(seen).toEqual(['b', undefined]);
  });
  it('today comes from the measurement log once it has enough data; a thin log falls back to the sample', async () => {
    const log = new MeasurementLog();
    const day0 = new Date(2026, 9, 13, 13, 0).getTime();
    const s = createReportSource({ roster, live: log, now: () => NOW });
    expect((await s.fetch(resolveRange({ preset: 'today' }, NOW))).origin.kind).toBe('sample');
    for (let i = 0; i <= 600; i++)
      log.ingest(
        ['AMR-001', 'AMR-002'].map((id) => ({
          id,
          model: 'x',
          fleetId: 'line-side',
          siteId: 's',
          pose: { x: 0, y: 0, theta: 0 },
          speed: 0,
          state: 'idle' as const,
          battery: 80,
          ts: day0 + i * 1000,
        })),
      );
    const rep = await s.fetch(resolveRange({ preset: 'today' }, NOW));
    expect(rep.origin).toEqual({ kind: 'live', observedMin: 10 });
    expect(rep.fleet.utilisation).toBe(0);
    expect(rep.previous).toBeNull();
    expect((await s.fetch(resolveRange({ preset: '7d' }, NOW))).origin.kind).toBe('sample'); // other periods are never measured yet
  });
});
