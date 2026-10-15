/** What a report says about the fleet over a period (robots are only an input of the formulas, never shown). Pure data: no React, no source details. */
export type MetricId =
  | 'utilisation'
  | 'idleTime'
  | 'throughput'
  | 'cycleTime'
  | 'deadlocks'
  | 'mtbf'
  | 'sla'
  | 'chargingAvailability'
  | 'emptyTravel'
  | 'energy'
  | 'trips'
  | 'distance'
  | 'obstacle';
export type GroupId = 'utilisation' | 'throughput' | 'reliability' | 'efficiency' | 'activity';
export type RangePreset = 'today' | '7d' | '30d' | 'custom';

/** A range as chosen on the page. `from` / `to` are calendar days (inclusive, local time). */
export interface RangeSelection {
  preset: RangePreset;
  from?: Date;
  to?: Date;
}
export interface ResolvedRange {
  preset: RangePreset;
  from: Date;
  to: Date;
  days: number;
  label: string;
  previousLabel: string;
}

export interface SeriesPoint {
  t: number;
  value: number | null;
}
export type MetricValues = Record<MetricId, number | null>;
/** Where the numbers come from: measured by the running fleet (live) or generated (sample). */
export type ReportOrigin = { kind: 'live'; observedMin: number } | { kind: 'sample' };
export interface Report {
  range: ResolvedRange;
  generatedAt: number;
  origin: ReportOrigin;
  /** The fleet figure of every metric, made from the raw totals (not an average of the robots' figures). */
  fleet: MetricValues;
  /** The fleet figures of the period just before, for the change shown on the cards (null when nothing is known about it). */
  previous: MetricValues | null;
  /** Trend per hour (today) or per day, for the metrics that have one. */
  series: Partial<Record<MetricId, SeriesPoint[]>>;
}
export interface ReportSource {
  fetch(range: ResolvedRange): Promise<Report>;
}
