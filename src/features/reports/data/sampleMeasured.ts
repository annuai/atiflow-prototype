import type { HourPoint, Measured, RobotMeasure } from '@/core/measurements';
import type { ResolvedRange } from '../model/types';

/**
 * SAMPLE DATA. There is no history API yet, so for periods the measurement log does not cover, the raw building blocks are generated: each robot has a steady
 * character (taken from its name; the magnitudes follow what the simulator produces, so "Today" and the other periods look alike) and every period adds some noise, so the same robot and range always give the same numbers. The KPI formulas in `kpis.ts`
 * run on this exactly as they do on measured data. Replace it by a source that reads the fleet API's history.
 */
export interface RosterRobot { id: string; fleetId: string }
const HOUR = 3_600_000, OPERATING_H = 20;                      // the fleet works about 20 hours a day

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const prng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const between = (r: () => number, a: number, b: number) => a + (b - a) * r();

function robot(r: RosterRobot, range: ResolvedRange, hours: number): RobotMeasure {
  const own = prng(hash(r.id)), noise = prng(hash(`${r.id}|${range.from.toDateString()}|${range.days}`)); const calm = 1 / Math.sqrt(range.days);
  const jitter = (v: number, k = 0.12) => v * (1 + (noise() * 2 - 1) * k * calm * 1.6);
  const exec = between(own, 0.78, 0.93), charging = between(own, 0.01, 0.05), error = own() < 0.2 ? between(own, 0.004, 0.01) : 0.001, other = between(own, 0.02, 0.05), blocked = own() < 0.25 ? between(own, 0.02, 0.04) : between(own, 0.004, 0.015);
  const secs = hours * 3600, share = (v: number) => Math.max(0, jitter(v)) * secs; let e = share(exec), c = share(charging), er = share(error), o = share(other); const used = e + c + er + o, fit = used > 0.97 * secs ? (0.97 * secs) / used : 1; e *= fit; c *= fit; er *= fit; o *= fit;      // never more than the hours there are
  const idle = Math.max(0, secs - e - c - er - o);
  const tripsPerHour = between(own, 7, 12), trips = Math.max(0, Math.round(jitter(tripsPerHour) * hours)), metres = between(own, 60, 110), emptyShare = between(own, 0.4, 0.6);
  const dist = trips * jitter(metres, 0.08), cycle = between(own, 150, 280), onTime = between(own, 0.72, 0.95), mtbfH = own() < 0.25 ? between(own, 9, 20) : between(own, 3, 9);
  return { robotId: r.id, fleetId: r.fleetId, seconds: { exec: e, idle, charging: c, error: er, offline: 0, other: o, total: secs }, blockedS: share(blocked), trips, cycleS: trips * jitter(cycle, 0.15),
    slaTotal: trips, slaMet: Math.min(trips, Math.round(trips * Math.min(1, jitter(onTime, 0.06)))), emptyM: dist * emptyShare, loadedM: dist * (1 - emptyShare), kWh: trips * between(own, 0.25, 0.55), faults: Math.round(jitter(hours / mtbfH, 0.5)) };
}

export function sampleMeasured(roster: RosterRobot[], range: ResolvedRange, now = new Date()): Measured {
  const hours = range.preset === 'today' ? Math.max(1, Math.min(OPERATING_H, now.getHours() + 1)) : range.days * OPERATING_H;
  const robots = roster.map((r) => robot(r, range, hours)); const fleet = prng(hash(`fleet|${range.from.toDateString()}|${range.days}`));
  const deadlocks = Math.round(hours * between(fleet, 2, 10)), samples = Math.round(hours * 60), availMet = Math.round(samples * between(fleet, 0.85, 0.99));
  const n = range.days === 1 ? hours : range.days, step = range.days === 1 ? HOUR : 24 * HOUR; const sum = (f: (r: RobotMeasure) => number) => robots.reduce((x, r) => x + f(r), 0);
  const start = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate()).getTime(), clamp = (v: number) => Math.max(0, Math.min(1, v));
  const execShare = sum((r) => r.seconds.exec) / Math.max(1, sum((r) => r.seconds.total)), onTime = sum((r) => r.slaMet) / Math.max(1, sum((r) => r.slaTotal)), avail = availMet / Math.max(1, samples);
  const hourly: HourPoint[] = Array.from({ length: n }, (_, i) => {             // every point varies on its own, so the trends are not flat lines
    const trips = Math.round((sum((r) => r.trips) / n) * between(fleet, 0.7, 1.3)), onlineS = (sum((r) => r.seconds.total) / n), availTotal = Math.round(samples / n);
    return { t: start + i * step, observedS: (hours * 3600) / n, trips, deadlocks: Math.round((deadlocks / n) * between(fleet, 0.3, 1.8)), slaTotal: trips, slaMet: Math.round(trips * clamp(onTime * between(fleet, 0.9, 1.08))),
      availTotal, availMet: Math.round(availTotal * clamp(avail * between(fleet, 0.93, 1.05))), execS: onlineS * clamp(execShare * between(fleet, 0.92, 1.06)), onlineS };
  });
  return { from: start, to: start + range.days * 24 * HOUR, observedS: hours * 3600, robots, deadlocks, availMet, availTotal: samples, hourly };
}
