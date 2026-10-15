import { summarise } from '@/core/stats';
import type { RobotTelemetry, Station } from '@/core/types';
import type {
  AttentionItem,
  BatteryView,
  DashboardInput,
  FleetState,
  Level,
  StateGroup,
  StatusSummary,
  TripRow,
} from './types';
import type { ConditionClock } from './trackers';
import { t } from '../text';

/** Pure functions: telemetry in, dashboard numbers out. Thresholds are constants here so the rules are in one place. */
export const WAIT_WARN_S = 45,
  WAIT_CRITICAL_S = 120,
  BATTERY_LOW = 25,
  BATTERY_CRITICAL = 10;

/** `label` is a getter: it reads the language in use each time, never a text captured at load. */
const group = (id: StateGroup, color: string) => ({
  id,
  color,
  get label() {
    return t.groups[id];
  },
});
export const GROUPS: { id: StateGroup; label: string; color: string }[] = [
  group('moving', '#14b8a6'),
  group('working', '#f59e0b'),
  group('waiting', '#8b5cf6'),
  group('charging', '#22c55e'),
  group('parked', '#64748b'),
  group('idle', '#94a3b8'),
  group('attention', '#ef4444'),
  group('offline', '#d4d4d4'),
];
export const emptyCounts = (): Record<StateGroup, number> => ({
  moving: 0,
  working: 0,
  waiting: 0,
  charging: 0,
  parked: 0,
  idle: 0,
  attention: 0,
  offline: 0,
});

const parkIds = (stations: Station[]) => new Set(stations.filter((s) => s.type === 'park').map((s) => s.id));
export function groupOf(r: RobotTelemetry, parks: Set<string>): StateGroup {
  switch (r.state) {
    case 'moving':
      return 'moving';
    case 'working':
      return 'working';
    case 'waiting':
      return 'waiting';
    case 'charging':
      return 'charging';
    case 'blocked':
    case 'error':
      return 'attention';
    case 'offline':
    case 'paused':
      return 'offline';
    default:
      return r.atStation && parks.has(r.atStation) ? 'parked' : 'idle';
  }
}

export function fleetStates(i: DashboardInput): FleetState[] {
  const parks = parkIds(i.stations);
  return i.fleets.map((f) => {
    const counts = emptyCounts();
    const mine = i.robots.filter((r) => r.fleetId === f.id);
    mine.forEach((r) => counts[groupOf(r, parks)]++);
    return { ...f, total: mine.length, counts };
  });
}

const waitText = (reason?: string | null) =>
  reason === 'intersection'
    ? t.waitFor.intersection
    : reason === 'traffic'
      ? t.waitFor.traffic
      : reason === 'headway'
        ? t.waitFor.headway
        : t.waitFor.road;
/** Robots that need the supervisor, most urgent first (one entry per robot). `clock` gives how long each has been in that condition. */
export function attentionList(i: DashboardInput, clock: ConditionClock): AttentionItem[] {
  const fleetName = (id: string) => i.fleets.find((f) => f.id === id)?.name ?? id;
  const out: AttentionItem[] = [];
  const active = new Set<string>();
  const T = i.thresholds ?? { waitWarnS: WAIT_WARN_S, waitUrgentS: WAIT_CRITICAL_S, batteryLow: BATTERY_LOW };
  for (const r of i.robots) {
    const cands: Omit<AttentionItem, 'id' | 'robotId' | 'fleetName'>[] = [];
    const secs = (k: string) => {
      const id = `${r.id}:${k}`;
      active.add(id);
      return Math.round((i.now - clock.seen(id, i.now)) / 1000);
    };
    if (r.state === 'error' || r.state === 'blocked') {
      const seconds = secs(r.state);
      cands.push({
        kind: r.state,
        level: 'critical',
        seconds,
        title: r.state === 'error' ? t.attention.hasError : t.attention.isBlocked,
        detail: r.alerts?.[0]?.msg ?? (r.state === 'error' ? t.attention.faultReported : t.attention.inTheWay),
      });
    }
    if (r.state === 'waiting') {
      const seconds = secs('waiting');
      if (seconds >= T.waitWarnS)
        cands.push({
          kind: 'waiting',
          level: seconds >= T.waitUrgentS ? 'critical' : 'warn',
          seconds,
          title: t.attention.waited(fmtDuration(seconds)),
          detail: t.attention.waiting(waitText(r.waitReason), r.traffic?.zoneId ?? '', r.waitsOn?.[0] ?? ''),
        });
    }
    if (r.battery < T.batteryLow && r.state !== 'charging' && r.task?.type !== 'charge')
      cands.push({
        kind: 'battery',
        level: r.battery < BATTERY_CRITICAL ? 'critical' : 'warn',
        seconds: secs('battery'),
        title: t.attention.battery(Math.round(r.battery)),
        detail: t.attention.noCharger,
      });
    const top = cands.sort((a, b) =>
      a.level === b.level ? b.seconds - a.seconds : a.level === 'critical' ? -1 : 1,
    )[0];
    if (top) out.push({ id: `${r.id}:${top.kind}`, robotId: r.id, fleetName: fleetName(r.fleetId), ...top });
  }
  clock.keep(active);
  return out.sort((a, b) => (a.level === b.level ? b.seconds - a.seconds : a.level === 'critical' ? -1 : 1));
}

export function statusOf(attention: AttentionItem[], robots: RobotTelemetry[]): StatusSummary {
  const crit = attention.filter((a) => a.level === 'critical').length;
  const level: Level = crit ? 'critical' : attention.length ? 'warn' : 'ok';
  const working = robots.filter((r) => r.state === 'moving' || r.state === 'working').length;
  const detail = t.status.working(working, robots.length);
  if (level === 'ok') return { level, headline: t.status.allClear, detail };
  const n = attention.length;
  return {
    level,
    headline: t.status.need(n, crit),
    detail,
  };
}

export function tripRow(r: RobotTelemetry, stations: Station[], fleetName: string, seconds: number): TripRow | null {
  const t = r.task;
  if (!t || t.type === 'park' || t.type === 'charge') return null;
  const name = (id?: string) => stations.find((s) => s.id === id)?.name ?? id ?? '';
  return {
    id: t.id,
    robotId: r.id,
    fleetName,
    kind: t.type,
    origin: t.origin,
    stops: t.stops ?? [],
    destination: t.to ?? '',
    destinationName: name(t.to),
    leg: t.leg ?? 0,
    progress: Math.min(1, t.progress ?? 0),
    state: r.state,
    seconds,
  };
}

export function batteryView(i: DashboardInput): BatteryView {
  const edges = [0, 25, 50, 75, 101];
  const labels = ['0–24%', '25–49%', '50–74%', '75–100%'];
  const buckets = labels.map((label, k) => ({
    label,
    count: i.robots.filter((r) => r.battery >= edges[k] && r.battery < edges[k + 1]).length,
    low: k === 0,
  }));
  const parks = i.stations.filter((s) => s.type === 'park');
  const taken = (id: string) => i.robots.find((r) => r.atStation === id)?.id ?? null;
  return {
    buckets,
    average: i.robots.length ? Math.round(i.robots.reduce((a, r) => a + r.battery, 0) / i.robots.length) : 0,
    low: i.robots
      .filter((r) => r.battery < BATTERY_LOW)
      .sort((a, b) => a.battery - b.battery)
      .map((r) => ({ id: r.id, battery: Math.round(r.battery), charging: r.state === 'charging' })),
    chargers: i.stations.filter((s) => s.type === 'charge').map((s) => ({ id: s.id, robotId: taken(s.id) })),
    parking: { total: parks.length, free: parks.filter((s) => !taken(s.id)).length },
  };
}

export const fmtDuration = (s: number) =>
  s < 60
    ? t.duration.seconds(s)
    : s < 3600
      ? s % 60 >= 10
        ? t.duration.minutesSeconds(Math.floor(s / 60), s % 60)
        : t.duration.minutes(Math.floor(s / 60))
      : t.duration.hoursMinutes(Math.floor(s / 3600), Math.floor((s % 3600) / 60));
export { summarise };
