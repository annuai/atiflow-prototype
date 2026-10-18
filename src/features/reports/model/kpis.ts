import type { Measured, RobotMeasure } from '@/core/measurements';
import { TREND_METRICS } from './metrics';
import type { MetricId, MetricValues, Report, ReportOrigin, ResolvedRange, SeriesPoint } from './types';

/**
 * THE formulas. Every KPI is computed here from the raw building blocks of a period (`Measured`: seconds per state, trips and their times, distance,
 * energy, faults, deadlocks, availability samples). Sources only supply `Measured`: the live one from the measurement log, the sample one generated.
 * Fleet figures are ratios of sums (not averages of the robots' figures), so a robot that worked 10 minutes does not count like one that worked 10 hours.
 */
const H = 3600;
const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const round = (v: number | null, d = 3) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Sums of the things the formulas need, over all robots of the period. */
interface Totals {
  online: number;
  exec: number;
  idle: number;
  blocked: number;
  trips: number;
  cycleS: number;
  slaMet: number;
  slaTotal: number;
  emptyM: number;
  loadedM: number;
  kWh: number;
  faults: number;
}
const totals = (rs: RobotMeasure[]): Totals =>
  rs.reduce(
    (t, r) => ({
      online: t.online + r.seconds.total - r.seconds.offline,
      exec: t.exec + r.seconds.exec,
      idle: t.idle + r.seconds.idle,
      blocked: t.blocked + r.blockedS,
      trips: t.trips + r.trips,
      cycleS: t.cycleS + r.cycleS,
      slaMet: t.slaMet + r.slaMet,
      slaTotal: t.slaTotal + r.slaTotal,
      emptyM: t.emptyM + r.emptyM,
      loadedM: t.loadedM + r.loadedM,
      kWh: t.kWh + r.kWh,
      faults: t.faults + r.faults,
    }),
    {
      online: 0,
      exec: 0,
      idle: 0,
      blocked: 0,
      trips: 0,
      cycleS: 0,
      slaMet: 0,
      slaTotal: 0,
      emptyM: 0,
      loadedM: 0,
      kWh: 0,
      faults: 0,
    },
  );

/** The fleet's metric values for a period. `observedS` (wall-clock time with data) is the denominator of the fleet-wide rates. */
function values(t: Totals, m: Measured): MetricValues {
  return {
    utilisation: round(div(100 * t.exec, t.online), 1),
    idleTime: round(div(t.idle / 60, t.online / H), 2),
    throughput: round(div(t.trips, m.observedS / H), 2),
    cycleTime: round(div(t.cycleS / 60, t.trips), 2),
    deadlocks: round(div(m.deadlocks, m.observedS / H), 3),
    mtbf: t.online > 0 ? round(t.online / H / Math.max(1, t.faults), 2) : null,
    sla: round(div(100 * t.slaMet, t.slaTotal), 1),
    chargingAvailability: round(div(100 * m.availMet, m.availTotal), 1),
    emptyTravel: round(div(100 * t.emptyM, t.emptyM + t.loadedM), 1),
    energy: round(div(t.kWh, t.trips), 4),
    trips: t.trips,
    distance: round((t.emptyM + t.loadedM) / 1000, 3),
    obstacle: round(div(t.blocked / 60, t.online / H), 2),
  };
}

function seriesOf(m: Measured): Partial<Record<MetricId, SeriesPoint[]>> {
  const pts = (f: (p: Measured['hourly'][number]) => number | null): SeriesPoint[] =>
    m.hourly.map((p) => ({ t: p.t, value: round(f(p), 2) }));
  const out: Partial<Record<MetricId, SeriesPoint[]>> = {
    utilisation: pts((p) => div(100 * p.execS, p.onlineS)),
    throughput: pts((p) => div(p.trips, p.observedS / H)),
    deadlocks: pts((p) => div(p.deadlocks, p.observedS / H)),
    sla: pts((p) => div(100 * p.slaMet, p.slaTotal)),
    chargingAvailability: pts((p) => div(100 * p.availMet, p.availTotal)),
  };
  for (const id of Object.keys(out) as MetricId[]) if (!TREND_METRICS.includes(id)) delete out[id];
  return out;
}

/** The fleet figures of one period (used for the period before, where only the cards' numbers are needed). */
const fleetValues = (m: Measured): MetricValues => values(totals(m.robots), m);

export function buildReport(
  range: ResolvedRange,
  m: Measured,
  previous: Measured | null,
  origin: ReportOrigin,
): Report {
  return {
    range,
    generatedAt: Date.now(),
    origin,
    fleet: fleetValues(m),
    previous: previous ? fleetValues(previous) : null,
    series: seriesOf(m),
  };
}
