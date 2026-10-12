import { summarise } from '@/core/stats';
import type { RobotTelemetry, Station } from '@/core/types';
import type { AttentionItem, BatteryView, DashboardInput, FleetState, Level, StateGroup, StatusSummary, TripRow } from './types';
import type { ConditionClock } from './trackers';

/** Pure functions: telemetry in, dashboard numbers out. Thresholds are constants here so the rules are in one place. */
export const WAIT_WARN_S = 45, WAIT_CRITICAL_S = 120, BATTERY_LOW = 25, BATTERY_CRITICAL = 10;

export const GROUPS: { id: StateGroup; label: string; color: string }[] = [
  { id: 'moving', label: 'Moving', color: '#14b8a6' }, { id: 'working', label: 'Working', color: '#f59e0b' }, { id: 'waiting', label: 'Waiting', color: '#8b5cf6' },
  { id: 'charging', label: 'Charging', color: '#22c55e' }, { id: 'parked', label: 'Parked', color: '#64748b' }, { id: 'idle', label: 'Idle', color: '#94a3b8' },
  { id: 'attention', label: 'Blocked / error', color: '#ef4444' }, { id: 'offline', label: 'Offline', color: '#d4d4d4' },
];
export const emptyCounts = (): Record<StateGroup, number> => ({ moving: 0, working: 0, waiting: 0, charging: 0, parked: 0, idle: 0, attention: 0, offline: 0 });

const parkIds = (stations: Station[]) => new Set(stations.filter((s) => s.type === 'park').map((s) => s.id));
export function groupOf(r: RobotTelemetry, parks: Set<string>): StateGroup {
  switch (r.state) {
    case 'moving': return 'moving'; case 'working': return 'working'; case 'waiting': return 'waiting'; case 'charging': return 'charging';
    case 'blocked': case 'error': return 'attention'; case 'offline': case 'paused': return 'offline';
    default: return r.atStation && parks.has(r.atStation) ? 'parked' : 'idle';
  }
}

export function fleetStates(i: DashboardInput): FleetState[] {
  const parks = parkIds(i.stations);
  return i.fleets.map((f) => { const counts = emptyCounts(); const mine = i.robots.filter((r) => r.fleetId === f.id); mine.forEach((r) => counts[groupOf(r, parks)]++); return { ...f, total: mine.length, counts }; });
}

const WAIT_TEXT: Record<string, string> = { intersection: 'for an intersection to clear', traffic: 'for a traffic zone to free up', headway: 'behind another robot' };
/** Robots that need the supervisor, most urgent first (one entry per robot). `clock` gives how long each has been in that condition. */
export function attentionList(i: DashboardInput, clock: ConditionClock): AttentionItem[] {
  const fleetName = (id: string) => i.fleets.find((f) => f.id === id)?.name ?? id; const out: AttentionItem[] = []; const active = new Set<string>();
  for (const r of i.robots) {
    const cands: Omit<AttentionItem, 'id' | 'robotId' | 'fleetName'>[] = [];
    const secs = (k: string) => { const id = `${r.id}:${k}`; active.add(id); return Math.round((i.now - clock.seen(id, i.now)) / 1000); };
    if (r.state === 'error' || r.state === 'blocked') { const seconds = secs(r.state); cands.push({ kind: r.state, level: 'critical', seconds, title: r.state === 'error' ? 'has an error' : 'is blocked', detail: r.alerts?.[0]?.msg ?? (r.state === 'error' ? 'Reported a fault' : 'Something is in its way') }); }
    if (r.state === 'waiting') {
      const seconds = secs('waiting');
      if (seconds >= WAIT_WARN_S) cands.push({ kind: 'waiting', level: seconds >= WAIT_CRITICAL_S ? 'critical' : 'warn', seconds, title: `has waited ${fmtDuration(seconds)}`, detail: `Waiting ${WAIT_TEXT[r.waitReason ?? ''] ?? 'for the road ahead'}${r.traffic ? ` (${r.traffic.zoneId})` : ''}${r.waitsOn?.length ? `, ${r.waitsOn[0]} is first` : ''}` });
    }
    if (r.battery < BATTERY_LOW && r.state !== 'charging' && r.task?.type !== 'charge') cands.push({ kind: 'battery', level: r.battery < BATTERY_CRITICAL ? 'critical' : 'warn', seconds: secs('battery'), title: `battery at ${Math.round(r.battery)}%`, detail: 'Not heading to a charger' });
    const top = cands.sort((a, b) => (a.level === b.level ? b.seconds - a.seconds : a.level === 'critical' ? -1 : 1))[0];
    if (top) out.push({ id: `${r.id}:${top.kind}`, robotId: r.id, fleetName: fleetName(r.fleetId), ...top });
  }
  clock.keep(active);
  return out.sort((a, b) => (a.level === b.level ? b.seconds - a.seconds : a.level === 'critical' ? -1 : 1));
}

export function statusOf(attention: AttentionItem[], robots: RobotTelemetry[]): StatusSummary {
  const crit = attention.filter((a) => a.level === 'critical').length; const level: Level = crit ? 'critical' : attention.length ? 'warn' : 'ok';
  const working = robots.filter((r) => r.state === 'moving' || r.state === 'working').length; const detail = `${working} of ${robots.length} robots working`;
  if (level === 'ok') return { level, headline: 'All clear. The floor is running normally.', detail };
  const n = attention.length; return { level, headline: `${n} robot${n > 1 ? 's' : ''} need${n > 1 ? '' : 's'} you${crit ? `, ${crit} urgent` : ''}`, detail };
}

export function tripRow(r: RobotTelemetry, stations: Station[], fleetName: string, seconds: number): TripRow | null {
  const t = r.task; if (!t || t.type === 'park' || t.type === 'charge') return null;
  const name = (id?: string) => stations.find((s) => s.id === id)?.name ?? id ?? '';
  return { id: t.id, robotId: r.id, fleetName, kind: t.type, origin: t.origin, stops: t.stops ?? [], destination: t.to ?? '', destinationName: name(t.to), leg: t.leg ?? 0, progress: Math.min(1, t.progress ?? 0), state: r.state, seconds };
}

export function batteryView(i: DashboardInput): BatteryView {
  const edges = [0, 25, 50, 75, 101]; const labels = ['0–24%', '25–49%', '50–74%', '75–100%'];
  const buckets = labels.map((label, k) => ({ label, count: i.robots.filter((r) => r.battery >= edges[k] && r.battery < edges[k + 1]).length, low: k === 0 }));
  const parks = i.stations.filter((s) => s.type === 'park'); const taken = (id: string) => i.robots.find((r) => r.atStation === id)?.id ?? null;
  return {
    buckets, average: i.robots.length ? Math.round(i.robots.reduce((a, r) => a + r.battery, 0) / i.robots.length) : 0,
    low: i.robots.filter((r) => r.battery < BATTERY_LOW).sort((a, b) => a.battery - b.battery).map((r) => ({ id: r.id, battery: Math.round(r.battery), charging: r.state === 'charging' })),
    chargers: i.stations.filter((s) => s.type === 'charge').map((s) => ({ id: s.id, robotId: taken(s.id) })),
    parking: { total: parks.length, free: parks.filter((s) => !taken(s.id)).length },
  };
}

export const fmtDuration = (s: number) => (s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min${s % 60 >= 10 ? ` ${s % 60} s` : ''}` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`);
export { summarise };
