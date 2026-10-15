import { insights } from '../insightsCopy';
import type { GroupId, MetricId } from './types';

/**
 * THE catalog of report metrics. Everything the page says about a metric comes from here: its name, unit, group, whether a higher or lower value is
 * better (the annotation on every card and chart, and the colour of every bar), what it means and how it is measured (the (i) tooltips).
 * The formulas are in `kpis.ts`. A new metric = one entry here + its formula there.
 */
export interface MetricDef {
  id: MetricId;
  group: GroupId;
  label: string;
  /** Short name (trend switch). */
  short: string;
  /** headline = the five numbers a supervisor reads first (scorecard); more = the rest. */
  tier: 'headline' | 'more';
  /** Title of the trend chart. */
  chartTitle: string;
  unit: string;
  decimals: number;
  better: 'higher' | 'lower';
  definition: string;
  /** Where the number comes from (from the KPI board). */
  measuredBy: string;
  /** Why this direction is better, in a few words (shown under the badge). */
  why: string;
}

const tr = () => insights.reports;
const group = (id: GroupId) => ({
  id,
  get label() {
    return tr().groups[id].label;
  },
  get blurb() {
    return tr().groups[id].blurb;
  },
});
export const GROUPS: { id: GroupId; label: string; blurb: string }[] = (
  ['utilisation', 'throughput', 'reliability', 'efficiency', 'activity'] as GroupId[]
).map(group);
/** The text of a metric is read through getters, so it follows the language in use (never copy it into a constant). */
const metric = (id: MetricId, o: Pick<MetricDef, 'group' | 'tier' | 'unit' | 'decimals' | 'better'>): MetricDef => ({
  id,
  ...o,
  get label() {
    return tr().metrics[id].label;
  },
  get short() {
    return tr().metrics[id].short;
  },
  get chartTitle() {
    return tr().metrics[id].chartTitle;
  },
  get definition() {
    return tr().metrics[id].definition;
  },
  get measuredBy() {
    return tr().metrics[id].measuredBy;
  },
  get why() {
    return tr().metrics[id].why;
  },
});
export const METRICS: Record<MetricId, MetricDef> = {
  utilisation: metric('utilisation', {
    group: 'utilisation',
    tier: 'headline',
    unit: '%',
    decimals: 0,
    better: 'higher',
  }),
  idleTime: metric('idleTime', { group: 'utilisation', tier: 'more', unit: 'min/h', decimals: 1, better: 'lower' }),
  throughput: metric('throughput', {
    group: 'throughput',
    tier: 'headline',
    unit: 'tasks/h',
    decimals: 1,
    better: 'higher',
  }),
  cycleTime: metric('cycleTime', { group: 'throughput', tier: 'more', unit: 'min', decimals: 1, better: 'lower' }),
  deadlocks: metric('deadlocks', { group: 'reliability', tier: 'headline', unit: '/h', decimals: 2, better: 'lower' }),
  mtbf: metric('mtbf', { group: 'reliability', tier: 'more', unit: 'h', decimals: 1, better: 'higher' }),
  sla: metric('sla', { group: 'reliability', tier: 'headline', unit: '%', decimals: 0, better: 'higher' }),
  chargingAvailability: metric('chargingAvailability', {
    group: 'reliability',
    tier: 'headline',
    unit: '%',
    decimals: 0,
    better: 'higher',
  }),
  emptyTravel: metric('emptyTravel', { group: 'efficiency', tier: 'more', unit: '%', decimals: 0, better: 'lower' }),
  energy: metric('energy', { group: 'efficiency', tier: 'more', unit: 'kWh', decimals: 3, better: 'lower' }),
  trips: metric('trips', { group: 'activity', tier: 'more', unit: '', decimals: 0, better: 'higher' }),
  distance: metric('distance', { group: 'activity', tier: 'more', unit: 'km', decimals: 2, better: 'higher' }),
  obstacle: metric('obstacle', { group: 'activity', tier: 'more', unit: 'min/h', decimals: 1, better: 'lower' }),
};
/** Order of the cards: the four headings of the KPI board first, then the raw activity totals. */
export const METRIC_ORDER: MetricId[] = [
  'utilisation',
  'idleTime',
  'throughput',
  'cycleTime',
  'deadlocks',
  'mtbf',
  'sla',
  'chargingAvailability',
  'emptyTravel',
  'energy',
  'trips',
  'distance',
  'obstacle',
];
export const metricsOf = (group: GroupId) => METRIC_ORDER.map((id) => METRICS[id]).filter((m) => m.group === group);
/** The scorecard (read first) and the rest (listed under "All KPIs"). */
export const HEADLINE: MetricId[] = METRIC_ORDER.filter((id) => METRICS[id].tier === 'headline');
export const MORE: MetricId[] = METRIC_ORDER.filter((id) => METRICS[id].tier === 'more');
/** Metrics shown as a trend over time (they have a series in the report). */
export const TREND_METRICS: MetricId[] = ['utilisation', 'throughput', 'deadlocks', 'sla', 'chargingAvailability'];

/** A value with its unit: `78%`, `4.4 min`. */
export const withUnit = (m: MetricDef, v: number | null) =>
  v === null ? '–' : m.unit === '%' ? `${formatMetric(m, v)}%` : `${formatMetric(m, v)}${m.unit ? ' ' + m.unit : ''}`;
export const formatMetric = (m: MetricDef, v: number | null) =>
  v === null
    ? '–'
    : v.toLocaleString(undefined, { minimumFractionDigits: m.decimals, maximumFractionDigits: m.decimals });
