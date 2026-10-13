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

export const GROUPS: { id: GroupId; label: string; blurb: string }[] = [
  { id: 'utilisation', label: 'Utilisation', blurb: 'How much of the time the robots do useful work' },
  { id: 'throughput', label: 'Throughput', blurb: 'How much gets moved, and how fast' },
  { id: 'reliability', label: 'Reliability', blurb: 'How dependable the fleet and its traffic are' },
  { id: 'efficiency', label: 'Efficiency', blurb: 'How little distance and energy the work takes' },
  { id: 'activity', label: 'Activity', blurb: 'Raw totals' },
];

export const METRICS: Record<MetricId, MetricDef> = {
  utilisation: { id: 'utilisation', group: 'utilisation', label: 'Fleet utilisation', short: 'Utilisation', tier: 'headline', chartTitle: 'Fleet utilisation over time', unit: '%', decimals: 0, better: 'higher',
    definition: 'Share of the time robots are executing tasks, not idle, charging or in error.', measuredBy: 'Task state timestamps from the fleet manager', why: 'More of the day spent on real work' },
  idleTime: { id: 'idleTime', group: 'utilisation', label: 'Robot idle time', short: 'Idle', tier: 'more', chartTitle: 'Robot idle time over time', unit: 'min/h', decimals: 1, better: 'lower',
    definition: 'Average minutes per hour a robot spends waiting for an assignment.', measuredBy: 'State telemetry (idle duration)', why: 'Less waiting for work' },
  throughput: { id: 'throughput', group: 'throughput', label: 'Throughput', short: 'Throughput', tier: 'headline', chartTitle: 'Throughput over time', unit: 'tasks/h', decimals: 1, better: 'higher',
    definition: 'Tasks completed per hour. For the fleet: across all robots; per robot: per hour that robot was in service.', measuredBy: 'Task completion events, aggregated hourly', why: 'More tasks finished per hour' },
  cycleTime: { id: 'cycleTime', group: 'throughput', label: 'Task cycle time', short: 'Cycle', tier: 'more', chartTitle: 'Task cycle time over time', unit: 'min', decimals: 1, better: 'lower',
    definition: 'Average time from a task being assigned to it being completed.', measuredBy: 'Assignment timestamp to completion timestamp', why: 'Tasks done faster' },
  deadlocks: { id: 'deadlocks', group: 'reliability', label: 'Deadlock frequency', short: 'Deadlocks', tier: 'headline', chartTitle: 'Deadlocks per hour', unit: '/h', decimals: 2, better: 'lower',
    definition: 'Deadlocks (robots waiting for each other in a ring) per fleet-hour.', measuredBy: 'Traffic controller deadlock detection logs', why: 'Fewer traffic jams to untangle' },
  mtbf: { id: 'mtbf', group: 'reliability', label: 'Mean time between failures', short: 'MTBF', tier: 'more', chartTitle: 'Operating hours between failures', unit: 'h', decimals: 1, better: 'higher',
    definition: 'Average operating hours between faults that needed someone on site. A robot without a fault shows its operating hours so far.', measuredBy: 'Error event logs with manual-intervention flags', why: 'Longer between breakdowns' },
  sla: { id: 'sla', group: 'reliability', label: 'SLA compliance', short: 'SLA', tier: 'headline', chartTitle: 'SLA compliance over time', unit: '%', decimals: 0, better: 'higher',
    definition: 'Share of tasks completed within their SLA deadline (service level agreement).', measuredBy: 'Task deadline compared with completion timestamp', why: 'More tasks on time' },
  chargingAvailability: { id: 'chargingAvailability', group: 'reliability', label: 'Charging availability', short: 'Availability', tier: 'headline', chartTitle: 'Fleet availability over time', unit: '%', decimals: 0, better: 'higher',
    definition: 'Share of the time at least 85% of the fleet is available (not charging, faulted or offline).', measuredBy: 'Fleet state aggregation every 60 seconds', why: 'Enough robots ready at any time' },
  emptyTravel: { id: 'emptyTravel', group: 'efficiency', label: 'Empty travel', short: 'Empty', tier: 'more', chartTitle: 'Empty travel over time', unit: '%', decimals: 0, better: 'lower',
    definition: 'Share of the distance driven without a load (the travel/work ratio).', measuredBy: 'Odometry with load sensor correlation', why: 'More of the driving carries a load' },
  energy: { id: 'energy', group: 'efficiency', label: 'Energy per task', short: 'kWh/task', tier: 'more', chartTitle: 'Energy per task over time', unit: 'kWh', decimals: 3, better: 'lower',
    definition: 'Energy used for driving per completed task.', measuredBy: 'Battery telemetry correlated with task counts', why: 'Less energy for the same work' },
  trips: { id: 'trips', group: 'activity', label: 'Total trips', short: 'Trips', tier: 'more', chartTitle: 'Trips over time', unit: '', decimals: 0, better: 'higher',
    definition: 'Trips a robot finished in the period (origin to destination, including stops).', measuredBy: 'Task completion events', why: 'More trips = more material moved' },
  distance: { id: 'distance', group: 'activity', label: 'Total distance', short: 'Distance', tier: 'more', chartTitle: 'Distance over time', unit: 'km', decimals: 2, better: 'higher',
    definition: 'Distance a robot drove in the period, empty and loaded.', measuredBy: 'Odometry', why: 'More distance = more work done' },
  obstacle: { id: 'obstacle', group: 'activity', label: 'Obstacle time', short: 'Blocked', tier: 'more', chartTitle: 'Obstacle time over time', unit: 'min/h', decimals: 1, better: 'lower',
    definition: 'Average minutes per hour a robot stood still because something blocked its path.', measuredBy: 'State telemetry (blocked)', why: 'Less blocked time = smoother routes' },
};
/** Order of the cards: the four headings of the KPI board first, then the raw activity totals. */
export const METRIC_ORDER: MetricId[] = ['utilisation', 'idleTime', 'throughput', 'cycleTime', 'deadlocks', 'mtbf', 'sla', 'chargingAvailability', 'emptyTravel', 'energy', 'trips', 'distance', 'obstacle'];
export const metricsOf = (group: GroupId) => METRIC_ORDER.map((id) => METRICS[id]).filter((m) => m.group === group);
/** The scorecard (read first) and the rest (listed under "All KPIs"). */
export const HEADLINE: MetricId[] = METRIC_ORDER.filter((id) => METRICS[id].tier === 'headline');
export const MORE: MetricId[] = METRIC_ORDER.filter((id) => METRICS[id].tier === 'more');
/** Metrics shown as a trend over time (they have a series in the report). */
export const TREND_METRICS: MetricId[] = ['utilisation', 'throughput', 'deadlocks', 'sla', 'chargingAvailability'];

/** A value with its unit: `78%`, `4.4 min`. */
export const withUnit = (m: MetricDef, v: number | null) => (v === null ? '–' : m.unit === '%' ? `${formatMetric(m, v)}%` : `${formatMetric(m, v)}${m.unit ? ' ' + m.unit : ''}`);
export const formatMetric = (m: MetricDef, v: number | null) => (v === null ? '–' : v.toLocaleString(undefined, { minimumFractionDigits: m.decimals, maximumFractionDigits: m.decimals }));
