import type { RobotTelemetry } from '@/core/types';
import type { HistoryPoint, TripRow } from './types';

/** First time a condition was seen, so "waiting for 4 min" can be shown (the feed only gives the state, not how long it has lasted). */
export class ConditionClock {
  private since = new Map<string, number>();
  seen(key: string, now: number) {
    if (!this.since.has(key)) this.since.set(key, now);
    return this.since.get(key)!;
  }
  /** Forget every condition that is not in `active` any more. */
  keep(active: Set<string>) {
    for (const k of [...this.since.keys()]) if (!active.has(k)) this.since.delete(k);
  }
}

/** A rolling record of the fleet, sampled every `intervalMs` (the charts' history; it starts when the page opens until a history API exists). */
export class HistoryTracker {
  points: HistoryPoint[] = [];
  constructor(
    private intervalMs = 10_000,
    private max = 360,
  ) {}
  sample(p: HistoryPoint) {
    const last = this.points[this.points.length - 1];
    if (last && p.t - last.t < this.intervalMs) return;
    this.points.push(p);
    if (this.points.length > this.max) this.points.shift();
  }
  get seconds() {
    return this.points.length > 1 ? Math.round((this.points[this.points.length - 1].t - this.points[0].t) / 1000) : 0;
  }
  reset() {
    this.points = [];
  }
}

/** Where robots lose time: seconds spent waiting, per place (a traffic zone, or the lane a robot is held on). */
export class WaitTracker {
  private seconds = new Map<string, number>();
  private last = 0;
  private now = new Map<string, number>();
  static placeOf(r: RobotTelemetry) {
    return r.traffic?.zoneId ?? (r.laneId ? `lane ${r.laneId}` : 'unknown');
  }
  ingest(now: number, robots: RobotTelemetry[]) {
    const dt = this.last ? Math.min(Math.max((now - this.last) / 1000, 0), 2) : 0;
    this.last = now;
    this.now.clear();
    for (const r of robots) {
      if (r.state !== 'waiting') continue;
      const p = WaitTracker.placeOf(r);
      this.seconds.set(p, (this.seconds.get(p) ?? 0) + dt);
      this.now.set(p, (this.now.get(p) ?? 0) + 1);
    }
  }
  top(n: number) {
    return [...this.seconds.entries()]
      .filter(([, s]) => s > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([place, seconds]) => ({ place, seconds: Math.round(seconds), waitingNow: this.now.get(place) ?? 0 }));
  }
  reset() {
    this.seconds.clear();
    this.now.clear();
    this.last = 0;
  }
}

/** Remembers when each trip was first seen and keeps the last finished ones (a finished trip is one whose task reaches progress 1). */
export class TripLog {
  private started = new Map<string, number>();
  private finished = new Set<string>();
  recent: TripRow[] = [];
  constructor(private keep = 12) {}
  startedAt(id: string, now: number) {
    if (!this.started.has(id)) this.started.set(id, now);
    return this.started.get(id)!;
  }
  ingest(now: number, robots: RobotTelemetry[], row: (r: RobotTelemetry, seconds: number) => TripRow | null) {
    for (const r of robots) {
      const t = r.task;
      if (!t || t.type === 'park' || t.type === 'charge') continue;
      const start = this.startedAt(t.id, now);
      if ((t.progress ?? 0) >= 1 && !this.finished.has(t.id)) {
        this.finished.add(t.id);
        const x = row(r, Math.round((now - start) / 1000));
        if (x) {
          this.recent.unshift({ ...x, done: true, at: now });
          this.recent.length = Math.min(this.recent.length, this.keep);
        }
      }
    }
  }
  get doneCount() {
    return this.finished.size;
  }
  reset() {
    this.started.clear();
    this.finished.clear();
    this.recent = [];
  }
}
