import type { Range, WorkflowDraft } from '../types';

/**
 * ALL the dummy numbers of the assistant's supervisor and configurator answers, in one place and internally consistent: the daily series, the shift, the robot failures and the sample
 * workflows below describe the same fictional fortnight, so every answer agrees with the others. Operator answers use the app's own live data instead (see `useAiContext`).
 */
export const DAYS = 30;
/** Small deterministic generator: the same numbers on every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
const day = (i: number) => {
  const d = new Date(Date.UTC(2026, 9, 16));
  d.setUTCDate(d.getUTCDate() - (DAYS - 1 - i));
  return d;
};
export const dayLabel = (i: number) =>
  day(i).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const weekday = (i: number) => day(i).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });

/** Trips finished per day, availability and idle share, for the last 30 days (index 29 = today). Yesterday (28) had a bad afternoon: the ASRS lift was down for 2 hours. */
const r = rng(7);
export const TRIPS_PER_DAY = Array.from({ length: DAYS }, (_, i) => {
  const base = day(i).getUTCDay() === 0 ? 150 : 310;
  const v = Math.round(base + (r() - 0.5) * 50 + i * 1.2);
  return i === 28 ? Math.round(v * 0.72) : v;
});
export const IDLE_PCT_PER_DAY = Array.from(
  { length: DAYS },
  (_, i) => Math.round((i === 28 ? 31 : 18 + r() * 6) * 10) / 10,
);
export const AVAILABILITY_PER_DAY = Array.from(
  { length: DAYS },
  (_, i) => Math.round((i === 28 ? 88 : 95 + r() * 3) * 10) / 10,
);
export const SLA_PER_DAY = Array.from({ length: DAYS }, (_, i) => Math.round((i === 28 ? 79 : 90 + r() * 6) * 10) / 10);
/** Today so far, by hour from 06:00 (one shift): trips finished. */
export const SHIFT_HOURS = ['06', '07', '08', '09', '10', '11', '12', '13'];
export const SHIFT_TRIPS = [38, 44, 49, 47, 52, 41, 36, 45];

export const FAILURES_30D: { robot: string; failures: number; last7: number; mtbfHours: number }[] = [
  { robot: 'AMR-007', failures: 14, last7: 9, mtbfHours: 41 },
  { robot: 'AMR-003', failures: 8, last7: 2, mtbfHours: 72 },
  { robot: 'AMR-011', failures: 6, last7: 1, mtbfHours: 96 },
  { robot: 'AMR-002', failures: 4, last7: 1, mtbfHours: 140 },
  { robot: 'AMR-009', failures: 3, last7: 0, mtbfHours: 188 },
  { robot: 'AMR-005', failures: 2, last7: 0, mtbfHours: 260 },
];
/** Idle share by station (share of the shift a station waited for a robot or a load). The first names are used when the app has no station list yet. */
export const IDLE_BY_STATION = [
  { station: 'VStore - ASRS 1', idlePct: 34 },
  { station: 'PCBA WIP 2', idlePct: 27 },
  { station: 'Assembly Workstation 1', idlePct: 22 },
  { station: 'SMT OVER-L3', idlePct: 19 },
  { station: 'Preparation Area 1', idlePct: 14 },
  { station: 'THT WIP 1', idlePct: 9 },
];
export const ANOMALIES = [
  { id: 'a1', text: 'AMR-007 failure rate is 3x its 30-day average (9 faults in 7 days).' },
  { id: 'a2', text: 'Waiting time at the east strip intersection doubled since Tuesday (avg 48 s).' },
  { id: 'a3', text: 'Battery of AMR-011 drops 6 % faster per trip than the rest of the fleet.' },
];

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);
export const daysOf = (range: Range) => (range === 'today' ? 1 : range === '7d' ? 7 : 30);
export const lastDays = (a: number[], n: number) => a.slice(a.length - n);
export const pct = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : 0);

export function kpisFor(range: Range) {
  const n = daysOf(range);
  const cur = (a: number[]) => lastDays(a, n);
  const prev = (a: number[]) => a.slice(a.length - 2 * n, a.length - n);
  const trips = range === 'today' ? sum(SHIFT_TRIPS) : sum(cur(TRIPS_PER_DAY));
  const tripsPrev = range === 'today' ? TRIPS_PER_DAY[28] : sum(prev(TRIPS_PER_DAY));
  return {
    trips,
    tripsDelta: pct(trips, tripsPrev),
    availability: Math.round(avg(cur(AVAILABILITY_PER_DAY)) * 10) / 10,
    availabilityPrev: Math.round(avg(prev(AVAILABILITY_PER_DAY)) * 10) / 10,
    sla: Math.round(avg(cur(SLA_PER_DAY)) * 10) / 10,
    slaPrev: Math.round(avg(prev(SLA_PER_DAY)) * 10) / 10,
    idle: Math.round(avg(cur(IDLE_PCT_PER_DAY)) * 10) / 10,
    idlePrev: Math.round(avg(prev(IDLE_PCT_PER_DAY)) * 10) / 10,
  };
}

export const SAMPLE_WORKFLOW: WorkflowDraft = {
  name: 'Kitting to Line 2',
  steps: [
    { id: 's1', kind: 'trigger', text: 'A cart arrives at Kitting Area' },
    { id: 's2', kind: 'action', text: 'Pick up the cart' },
    { id: 's3', kind: 'wait', text: 'Wait for operator confirm' },
    { id: 's4', kind: 'action', text: 'Go to Assembly Line 2' },
  ],
};
/** The same workflow a week ago: the diff for "what changed since last week". */
export const SAMPLE_WORKFLOW_LAST_WEEK: WorkflowDraft = {
  name: 'Kitting to Line 2',
  steps: [
    { id: 's1', kind: 'trigger', text: 'A cart arrives at Kitting Area' },
    { id: 's2', kind: 'action', text: 'Pick up the cart' },
    { id: 's4', kind: 'action', text: 'Go to Assembly Line 1' },
  ],
};
