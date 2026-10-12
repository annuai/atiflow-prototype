import { describe, expect, it } from 'vitest';
import { StatsTracker, summarise } from '../src/core/stats';
import { greeting, firstName, insights, metricCards, robotAlerts, utilisationBars, performance } from '../src/features/dashboard/model';
import type { RobotTelemetry } from '../src/core/types';

const bot = (o: Partial<RobotTelemetry> & { id: string }): RobotTelemetry => ({ model: 'm', fleetId: 'f', siteId: 's', pose: { x: 0, y: 0, theta: 0 }, speed: 0, state: 'idle', battery: 80, ts: 1000, ...o });

describe('dashboard numbers', () => {
  const robots = [bot({ id: 'AMR-001', state: 'moving', speed: 1, task: { id: 'T1', type: 'transport', progress: 0.4 } }), bot({ id: 'AMR-002', state: 'waiting', task: { id: 'T2', type: 'return', from: 'STA-101', to: 'STA-104', progress: 0.2 } }),
    bot({ id: 'AMR-003', state: 'idle' }), bot({ id: 'AMR-004', state: 'blocked', alerts: [{ code: 'OBSTACLE', severity: 'critical', msg: 'Path obstructed' }], task: { id: 'T4', type: 'transport', to: 'STA-109', progress: 0.5 } }),
    bot({ id: 'AMR-005', state: 'charging', battery: 20, alerts: [{ code: 'LOW_BATT', severity: 'warn', msg: 'Low battery' }] })];
  it('summarises the fleet: active, trips, attention, health, utilisation', () => {
    expect(summarise(robots)).toEqual({ total: 5, active: 4, activeTrips: 3, attention: 2, health: 60, utilisation: 20 });
    expect(summarise([])).toMatchObject({ total: 0, health: 100 });
  });
  it('greets by the time of day and uses the first name', () => { expect(greeting(8)).toBe('Good morning,'); expect(greeting(14)).toBe('Good afternoon,'); expect(greeting(19)).toBe('Good evening,'); expect(firstName('Arjun Singh')).toBe('Arjun'); });
  it('cards: fewer attention robots than before is good news, more is bad', () => {
    expect(metricCards({ ...summarise(robots), attention: 0 }, 'yesterday').find((c) => c.id === 'attention')!.delta.good).toBe(true);
    expect(metricCards({ ...summarise(robots), attention: 9 }, 'yesterday').find((c) => c.id === 'attention')!.delta.good).toBe(false);
  });
  it('alerts: critical first, with robot names and where it was heading; resolved ones are forgotten', () => {
    const a = robotAlerts(robots, 5000); expect(a.map((x) => x.robotId)).toEqual(['AMR-004', 'AMR-005']);
    expect(a[0]).toMatchObject({ critical: true, text: 'Route blocked on the way to STA-109' }); expect(a[1].text).toBe('Battery at 20%, needs charging');
    expect(robotAlerts([robots[0]], 9000)).toEqual([]);
  });
  it('chart: past hours are filled, the current hour shows the measured value', () => {
    const bars = utilisationBars(12, (h) => (h === 12 ? 91 : null)); expect(bars.find((b) => b.hour === 12)).toMatchObject({ pct: 91, past: true }); expect(bars.find((b) => b.hour === 14)!.past).toBe(false);
  });
  it('insights name real robots and stations', () => {
    const list = insights(robots, 'DCP-1003', new Date(2026, 6, 16), 'today'); expect(list[0].text).toContain('DCP-1003'); expect(list[1].text).toContain('STA-101'); expect(list[2].text).toMatch(/AMR-00[1-5] can be scheduled/);
  });
  it('performance adds the live trips, distance and downtime to the earlier ones', () => { const p = performance(70, 5, 12_000, 600, 'week'); expect(p.tripsDone).toBeGreaterThanOrEqual(5); expect(p.distanceKm).toBeGreaterThan(12); expect(p.downtimeMin).toBeGreaterThan(10); });
});

describe('StatsTracker', () => {
  it('adds up distance, downtime, finished trips and busy time from the telemetry stream', () => {
    const t = new StatsTracker(); const hour = new Date(2026, 6, 16, 10, 0, 0);
    t.ingest([bot({ id: 'A', ts: 1000, speed: 1, state: 'moving' })], hour);
    t.ingest([bot({ id: 'A', ts: 2000, speed: 1, state: 'moving' }), bot({ id: 'B', ts: 2000, state: 'blocked' }), bot({ id: 'C', ts: 2000, state: 'working', task: { id: 'T9', type: 'transport', progress: 1 } })], hour);
    expect(t.distanceM).toBeCloseTo(1); expect(t.downtimeS).toBeCloseTo(1); expect(t.tripsDone).toBe(1); expect(t.utilisationAt(10)).toBe(67); expect(t.utilisationAt(11)).toBeNull();
    t.reset(); expect(t.tripsDone).toBe(0);
  });
});
