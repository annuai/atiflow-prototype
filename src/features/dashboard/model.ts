import { needsAttention, type FleetSummary } from '@/core/stats';
import type { RobotTelemetry } from '@/core/types';

/** Dashboard numbers. Live values come from the telemetry feed; the rest are fixed placeholders until a reporting backend exists (see BASE). */
export const greeting = (hour: number) => (hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,');
export const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export type Compare = 'yesterday' | 'week';
export const COMPARE_OPTIONS: { id: Compare; label: string }[] = [{ id: 'yesterday', label: 'Yesterday' }, { id: 'week', label: 'Last week' }];

/** Earlier-today figures and the previous period's figures (placeholders). */
const BASE = {
  tripsDone: 48, tripsPlanned: 58, tripsCancelled: 2, distanceKm: 170, downtimeMin: 36,
  deltas: {
    yesterday: { active: 100, trips: 100, attention: 10, health: 2, done: 12, cancelled: -1, distance: 8, downtime: -20, utilisation: 6 },
    week: { active: 18, trips: 24, attention: -30, health: 5, done: 21, cancelled: -40, distance: 14, downtime: -32, utilisation: 11 },
  },
};
export interface Delta { pct: number; good: boolean }
const delta = (pct: number, upIsGood = true): Delta => ({ pct, good: pct === 0 || pct > 0 === upIsGood });
/** What the previous period looked like (placeholders), as a share of today's fleet: the cards show the change against it. */
const PREVIOUS = { yesterday: { active: 0.72, trips: 0.6, attention: 2, health: 92 }, week: { active: 0.85, trips: 0.8, attention: 3, health: 88 } };
const change = (now: number, before: number) => Math.round(((now - before) / Math.max(before, 1)) * 100);

export interface MetricCard { id: 'active' | 'trips' | 'attention' | 'health'; label: string; value: string; delta: Delta }
export function metricCards(s: FleetSummary, cmp: Compare): MetricCard[] {
  const p = PREVIOUS[cmp];
  return [
    { id: 'active', label: 'Active Robots', value: String(s.active), delta: delta(change(s.active, s.total * p.active)) },
    { id: 'trips', label: 'Active Trips', value: String(s.activeTrips), delta: delta(change(s.activeTrips, s.total * p.trips)) },
    { id: 'attention', label: 'Needs Attention', value: String(s.attention), delta: delta(change(s.attention, p.attention), false) },
    { id: 'health', label: 'Fleet Health', value: `${s.health}%`, delta: delta(change(s.health, p.health)) },
  ];
}

/** Bars of the "Robot Utilization" chart: the hours of the day with their usual load; the current hour is replaced by what is measured now. */
export const CHART_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 21];
const USUAL = [58, 68, 78, 84, 74, 62, 50, 34, 18];
export const hourLabel = (h: number) => (h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`);
export interface Bar { hour: number; label: string; pct: number; past: boolean }
export function utilisationBars(now: number, measured: (hour: number) => number | null): Bar[] {
  return CHART_HOURS.map((hour, i) => { const live = hour <= now && now < (CHART_HOURS[i + 1] ?? 24) ? measured(now) : null; return { hour, label: hourLabel(hour), pct: live ?? USUAL[i], past: hour <= now }; });
}

export interface PerformanceStats { utilisation: number; tripsDone: number; tripsPlanned: number; tripsCancelled: number; distanceKm: number; downtimeMin: number; deltas: (typeof BASE.deltas)['yesterday'] }
export function performance(utilisation: number, liveTrips: number, distanceM: number, downtimeS: number, cmp: Compare): PerformanceStats {
  const done = BASE.tripsDone + liveTrips;
  return { utilisation, tripsDone: done, tripsPlanned: Math.max(BASE.tripsPlanned, done + 4), tripsCancelled: BASE.tripsCancelled, distanceKm: Math.round(BASE.distanceKm + distanceM / 1000), downtimeMin: Math.round(BASE.downtimeMin + downtimeS / 60), deltas: BASE.deltas[cmp] };
}

export interface Insight { id: string; tone: 'red' | 'amber' | 'blue'; ago: string; text: string }
/** Three findings about the fleet: stock, congestion and maintenance. Robot and station names come from the live feed. */
export function insights(robots: RobotTelemetry[], stockCode: string | null, today: Date, period: 'today' | 'yesterday'): Insight[] {
  if (period === 'yesterday') return [
    { id: 'y1', tone: 'amber', ago: 'Yesterday, 5:40 pm', text: 'Charging dock queue peaked at 4 robots between 4 pm and 6 pm.' },
    { id: 'y2', tone: 'blue', ago: 'Yesterday, 11:05 am', text: 'Trips finished 6% faster than the weekly average.' },
  ];
  const waiting = robots.filter((r) => r.state === 'waiting' && r.task?.from && r.task.to);
  const lowest = [...robots].sort((a, b) => a.battery - b.battery)[0];
  const next = new Date(today); next.setDate(next.getDate() + 9);
  return [
    { id: 'stock', tone: 'red', ago: '1 hr ago', text: stockCode ? `${stockCode} running critically low on stock.` : 'A material is running critically low on stock.' },
    { id: 'route', tone: 'amber', ago: '15 min ago', text: waiting.length ? `Route from ${waiting[0].task!.from} to ${waiting[0].task!.to} is congested, ${waiting.length} robot${waiting.length === 1 ? '' : 's'} waiting.` : 'No congestion on the main routes right now.' },
    { id: 'maint', tone: 'blue', ago: '32 min ago', text: lowest ? `${lowest.id} can be scheduled for maintenance on ${longDate(next)}.` : 'No maintenance is due.' },
  ];
}

export interface RobotAlert { key: string; robotId: string; text: string; critical: boolean; firstSeen: number }
const firstSeen = new Map<string, number>();
/** Robots that need a look: blocked, errors, low battery, rule violations. Critical first. `firstSeen` remembers when each alert appeared (for "8 min ago"). */
export function robotAlerts(robots: RobotTelemetry[], now: number, limit = 5): RobotAlert[] {
  const out: RobotAlert[] = []; const live = new Set<string>();
  for (const r of robots) {
    const parts: { code: string; text: string; critical: boolean }[] = [];
    for (const a of r.alerts ?? []) {
      if (a.severity === 'info') continue;
      parts.push({ code: a.code, critical: a.severity === 'critical', text: a.code === 'OBSTACLE' ? `Route blocked${r.task?.to ? ` on the way to ${r.task.to}` : ''}` : a.code === 'LOW_BATT' ? `Battery at ${r.battery}%, needs charging` : a.msg });
    }
    if (r.state === 'error' && !parts.length) parts.push({ code: 'ERROR', critical: true, text: 'Robot reported an error' });
    for (const p of parts) { const key = `${r.id}|${p.code}`; live.add(key); if (!firstSeen.has(key)) firstSeen.set(key, now); out.push({ key, robotId: r.id, text: p.text, critical: p.critical, firstSeen: firstSeen.get(key)! }); }
  }
  for (const k of [...firstSeen.keys()]) if (!live.has(k)) firstSeen.delete(k);      // resolved: forget it
  return out.sort((a, b) => Number(b.critical) - Number(a.critical) || a.firstSeen - b.firstSeen).slice(0, limit);
}

export type MapColor = 'moving' | 'idle' | 'charging' | 'attention';
export const MAP_COLORS: Record<MapColor, string> = { moving: '#14b8a6', idle: '#94a3b8', charging: '#22c55e', attention: '#ef4444' };
export const mapStateOf = (r: RobotTelemetry): MapColor => (needsAttention(r) ? 'attention' : r.state === 'charging' ? 'charging' : r.state === 'idle' || r.state === 'offline' || r.state === 'paused' ? 'idle' : 'moving');
