import { describe, expect, it } from 'vitest';
import { DashboardEngine } from '../src/features/dashboard/data/engine';
import { groupOf, statusOf, fmtDuration } from '../src/features/dashboard/data/derive';
import { HistoryTracker, WaitTracker } from '../src/features/dashboard/data/trackers';
import type { DashboardInput } from '../src/features/dashboard/data/types';
import type { RobotTelemetry, Station } from '../src/core/types';

const bot = (o: Partial<RobotTelemetry>): RobotTelemetry => ({ id: 'AMR-001', model: 'sherpa-xt-lite', fleetId: 'f1', siteId: 's', pose: { x: 0, y: 0, theta: 0 }, speed: 0, state: 'idle', battery: 80, ts: 0, ...o });
const stations = [{ id: 'PARK-001', name: 'PARK-001', type: 'park' }, { id: 'CHARGE-001', name: 'CHARGE-001', type: 'charge' }, { id: 'STA-101', name: 'PCBA WIP 1', type: 'buffer' }] as Station[];
const input = (now: number, robots: RobotTelemetry[]): DashboardInput => ({ now, robots, stations, fleets: [{ id: 'f1', name: 'Line Side Fleet', color: '#14b8a6' }, { id: 'f2', name: 'Assembly Fleet', color: '#f59e0b' }], site: null });

describe('dashboard: state groups and status', () => {
  it('every robot is in exactly one group; idle at a parking spot is parked', () => {
    const parks = new Set(['PARK-001']);
    expect(groupOf(bot({ state: 'idle', atStation: 'PARK-001' }), parks)).toBe('parked'); expect(groupOf(bot({ state: 'idle', atStation: 'STA-101' }), parks)).toBe('idle');
    expect(groupOf(bot({ state: 'blocked' }), parks)).toBe('attention'); expect(groupOf(bot({ state: 'paused' }), parks)).toBe('offline'); expect(groupOf(bot({ state: 'waiting' }), parks)).toBe('waiting');
  });
  it('status is ok with nothing to do, warn for non-urgent items, critical when one is urgent', () => {
    expect(statusOf([], [bot({ state: 'moving' })]).level).toBe('ok');
    const item = (level: 'warn' | 'critical') => ({ id: 'x', robotId: 'AMR-001', fleetName: 'f', level, kind: 'waiting' as const, title: '', detail: '', seconds: 0 });
    expect(statusOf([item('warn')], []).level).toBe('warn'); const c = statusOf([item('warn'), item('critical')], []); expect(c.level).toBe('critical'); expect(c.headline).toContain('2 robots need you, 1 urgent');
  });
  it('durations read naturally', () => { expect(fmtDuration(42)).toBe('42 s'); expect(fmtDuration(125)).toBe('2 min 5 s'.replace(' 5 s', '')); expect(fmtDuration(3700)).toBe('1 h 1 min'); });
});

describe('dashboard: needs attention', () => {
  it('lists blocked, long-waiting and low-battery robots, most urgent first, one entry per robot', () => {
    const e = new DashboardEngine();
    const robots = (t: number) => [
      bot({ id: 'AMR-001', state: 'waiting', waitReason: 'intersection', laneId: 'L1' }), bot({ id: 'AMR-002', state: 'blocked', alerts: [{ code: 'OBSTACLE', severity: 'critical', msg: 'Path obstructed' }] }),
      bot({ id: 'AMR-003', state: 'moving', battery: 18 }), bot({ id: 'AMR-004', state: 'charging', battery: 12 }), bot({ id: 'AMR-005', state: 'moving', battery: 90, ts: t }),
    ];
    e.ingest(input(0, robots(0))); expect(e.snapshot()!.attention.map((a) => a.robotId)).toEqual(['AMR-002', 'AMR-003']);      // the wait is too short to report; a charging robot is fine
    e.ingest(input(50_000, robots(50_000))); let a = e.snapshot()!.attention; expect(a.map((x) => x.robotId)).toEqual(['AMR-002', 'AMR-001', 'AMR-003']); expect(a[1]).toMatchObject({ level: 'warn', kind: 'waiting' });
    e.ingest(input(130_000, robots(130_000))); a = e.snapshot()!.attention; expect(a.find((x) => x.robotId === 'AMR-001')).toMatchObject({ level: 'critical', seconds: 130 });
    expect(a.filter((x) => x.robotId === 'AMR-002')).toHaveLength(1);
  });
  it('forgets a robot once it is fine again, and starts counting afresh the next time', () => {
    const e = new DashboardEngine(); const w = bot({ id: 'AMR-001', state: 'waiting' });
    e.ingest(input(0, [w])); e.ingest(input(60_000, [w])); expect(e.snapshot()!.attention).toHaveLength(1);
    e.ingest(input(61_000, [{ ...w, state: 'moving' }])); expect(e.snapshot()!.attention).toHaveLength(0);
    e.ingest(input(100_000, [w])); e.ingest(input(120_000, [w])); expect(e.snapshot()!.attention).toHaveLength(0);       // 20 s into a new wait
  });
});

describe('dashboard: fleets, battery, trips, hot spots, history', () => {
  it('counts robots per fleet and state', () => {
    const s = new DashboardEngine(); s.ingest(input(0, [bot({ id: 'a', state: 'moving' }), bot({ id: 'b', state: 'waiting' }), bot({ id: 'c', fleetId: 'f2', state: 'charging' })]));
    const f = s.snapshot()!.fleets; expect(f[0]).toMatchObject({ name: 'Line Side Fleet', total: 2 }); expect(f[0].counts).toMatchObject({ moving: 1, waiting: 1 }); expect(f[1].counts.charging).toBe(1);
  });
  it('battery buckets, low list, charger and parking occupancy', () => {
    const e = new DashboardEngine(); e.ingest(input(0, [bot({ id: 'a', battery: 10 }), bot({ id: 'b', battery: 60, atStation: 'PARK-001' }), bot({ id: 'c', battery: 95, state: 'charging', atStation: 'CHARGE-001' })]));
    const b = e.snapshot()!.battery; expect(b.buckets.map((x) => x.count)).toEqual([1, 0, 1, 1]); expect(b.low).toEqual([{ id: 'a', battery: 10, charging: false }]);
    expect(b.chargers).toEqual([{ id: 'CHARGE-001', robotId: 'c' }]); expect(b.parking).toEqual({ total: 1, free: 0 }); expect(b.average).toBe(55);
  });
  it('shows running trips with their stops, and keeps finished ones', () => {
    const e = new DashboardEngine(); const t = (progress: number) => bot({ id: 'AMR-001', state: 'moving', task: { id: 'TRP-007', type: 'transport', origin: 'STA-101', to: 'STA-101', stops: ['PARK-001'], leg: 0, progress } });
    e.ingest(input(0, [t(0.2)])); let s = e.snapshot()!; expect(s.trips.running[0]).toMatchObject({ id: 'TRP-007', stops: ['PARK-001'], destinationName: 'PCBA WIP 1' }); expect(s.trips.recent).toHaveLength(0);
    e.ingest(input(30_000, [{ ...t(1), state: 'working' }])); s = e.snapshot()!; expect(s.trips.running).toHaveLength(0); expect(s.trips.recent[0]).toMatchObject({ id: 'TRP-007', done: true, seconds: 30 });
    e.ingest(input(31_000, [{ ...t(1), state: 'working' }])); expect(e.snapshot()!.trips.recent).toHaveLength(1);      // finished once
  });
  it('parking and charging tasks are not trips', () => {
    const e = new DashboardEngine(); e.ingest(input(0, [bot({ state: 'moving', task: { id: 'TRP-008', type: 'park', progress: 0.3 } })])); expect(e.snapshot()!.trips.running).toHaveLength(0);
  });
  it('hot spots add up waiting time per place', () => {
    const w = new WaitTracker(); const r = [bot({ id: 'a', state: 'waiting', traffic: { zoneId: 'TZ-03', status: 'waiting' } }), bot({ id: 'b', state: 'waiting', laneId: 'L9' }), bot({ id: 'c', state: 'moving' })];
    w.ingest(1000, r); w.ingest(2000, r); w.ingest(3000, [r[0]]); expect(w.top(5)).toEqual([{ place: 'TZ-03', seconds: 2, waitingNow: 1 }, { place: 'lane L9', seconds: 1, waitingNow: 0 }]);
  });
  it('history is sampled on an interval and capped; trend needs enough history', () => {
    const h = new HistoryTracker(1000, 3); [0, 500, 1000, 2000, 3000, 4000].forEach((t) => h.sample({ t, utilisation: 1, trips: 1, waiting: 0, attention: 0 })); expect(h.points.map((p) => p.t)).toEqual([2000, 3000, 4000]);
    const e = new DashboardEngine(1000); e.ingest(input(0, [bot({ state: 'idle' })])); expect(e.snapshot()!.kpis[2].trend).toBeNull();
    for (let t = 1; t <= 8; t++) e.ingest(input(t * 1000, [bot({ state: t < 5 ? 'idle' : 'moving' })])); expect(e.snapshot()!.kpis[2].trend).toBe(100);
  });
});
