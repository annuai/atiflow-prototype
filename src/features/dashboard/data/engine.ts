import { summarise } from '@/core/stats';
import { attentionList, batteryView, fleetStates, statusOf, tripRow } from './derive';
import { ConditionClock, HistoryTracker, TripLog, WaitTracker } from './trackers';
import { t } from '../text';
import type { AttentionItem, DashboardInput, DashboardSnapshot, Kpi } from './types';

/** The tracker keys a place in English (`lane L9`, `unknown`); shown in the language in use. */
const placeLabel = (place: string) =>
  place === 'unknown' ? t.place.unknown : place.startsWith('lane ') ? t.place.lane(place.slice(5)) : place;

const TREND_WINDOW_MS = 5 * 60_000,
  SPARK_POINTS = 30;

/**
 * The dashboard's logic, with no React and no knowledge of where the data comes from: feed it `DashboardInput`s, read a `DashboardSnapshot`.
 * Swapping the simulator for the real fleet API means writing another `DashboardSource`; this class stays the same.
 */
export class DashboardEngine {
  readonly history: HistoryTracker;
  readonly waits = new WaitTracker();
  readonly trips = new TripLog();
  private clock = new ConditionClock();
  private input: DashboardInput | null = null;
  private attention: AttentionItem[] = [];
  constructor(historyIntervalMs = 10_000) {
    this.history = new HistoryTracker(historyIntervalMs);
  }

  ingest(i: DashboardInput) {
    this.input = i;
    this.attention = attentionList(i, this.clock);
    this.waits.ingest(i.now, i.robots);
    const fleet = (id: string) => i.fleets.find((f) => f.id === id)?.name ?? id;
    this.trips.ingest(i.now, i.robots, (r, s) => tripRow(r, i.stations, fleet(r.fleetId), s));
    const s = summarise(i.robots);
    this.history.sample({
      t: i.now,
      utilisation: s.utilisation,
      trips: s.activeTrips,
      waiting: i.robots.filter((r) => r.state === 'waiting').length,
      attention: this.attention.length,
    });
  }

  snapshot(): DashboardSnapshot | null {
    const i = this.input;
    if (!i) return null;
    const fleet = (id: string) => i.fleets.find((f) => f.id === id)?.name ?? id;
    const running = i.robots
      .flatMap((r) => {
        const row = tripRow(
          r,
          i.stations,
          fleet(r.fleetId),
          Math.round((i.now - this.trips.startedAt(r.task?.id ?? '', i.now)) / 1000),
        );
        return row && row.progress < 1 ? [row] : [];
      })
      .sort((a, b) => b.seconds - a.seconds);
    const pts = this.history.points;
    return {
      now: i.now,
      site: i.site,
      robots: i.robots,
      status: statusOf(this.attention, i.robots),
      kpis: this.kpis(i),
      fleets: fleetStates(i),
      attention: this.attention,
      trips: { running, recent: this.trips.recent },
      battery: batteryView(i),
      hotspots: this.waits.top(5).map((h) => ({ ...h, label: placeLabel(h.place) })),
      history: pts,
      historySeconds: this.history.seconds,
    };
  }

  private kpis(i: DashboardInput): Kpi[] {
    const s = summarise(i.robots);
    const pts = this.history.points;
    const series = (pick: (p: (typeof pts)[number]) => number) => pts.slice(-SPARK_POINTS).map(pick);
    const old = [...pts].reverse().find((p) => i.now - p.t >= TREND_WINDOW_MS) ?? (pts.length > 6 ? pts[0] : null); // change over up to 5 min; none until there is enough history
    const trend = (now: number, pick: (p: (typeof pts)[number]) => number) => (old ? now - pick(old) : null);
    const working = i.robots.filter((r) => r.state === 'moving' || r.state === 'working').length;
    const alerts = this.attention.length;
    return [
      {
        id: 'working',
        label: t.kpi.working,
        value: working,
        of: i.robots.length,
        series: series((p) => Math.round((p.utilisation / 100) * i.robots.length)),
        trend: trend(working, (p) => Math.round((p.utilisation / 100) * i.robots.length)),
        tone: 'neutral',
      },
      {
        id: 'trips',
        label: t.kpi.trips,
        value: s.activeTrips,
        series: series((p) => p.trips),
        trend: trend(s.activeTrips, (p) => p.trips),
        tone: 'neutral',
      },
      {
        id: 'utilisation',
        label: t.kpi.utilisation,
        value: s.utilisation,
        unit: '%',
        series: series((p) => p.utilisation),
        trend: trend(s.utilisation, (p) => p.utilisation),
        tone: s.utilisation >= 50 ? 'good' : 'neutral',
      },
      {
        id: 'health',
        label: t.kpi.health,
        value: s.health,
        unit: '%',
        series: series((p) => Math.round(100 * (1 - p.attention / Math.max(i.robots.length, 1)))),
        trend: trend(s.health, (p) => Math.round(100 * (1 - p.attention / Math.max(i.robots.length, 1)))),
        tone: s.health >= 90 ? 'good' : s.health >= 70 ? 'warn' : 'bad',
      },
      {
        id: 'alerts',
        label: t.kpi.alerts,
        value: alerts,
        series: series((p) => p.attention),
        trend: trend(alerts, (p) => p.attention),
        tone: alerts === 0 ? 'good' : this.attention.some((a) => a.level === 'critical') ? 'bad' : 'warn',
      },
    ];
  }
}
