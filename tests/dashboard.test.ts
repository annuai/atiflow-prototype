import { describe, expect, it } from 'vitest';
import { StatsTracker, summarise } from '../src/core/stats';
import { greeting, firstName } from '../src/features/dashboard/data/greeting';
import type { RobotTelemetry } from '../src/core/types';

const bot = (o: Partial<RobotTelemetry> & { id: string }): RobotTelemetry => ({ model: 'm', fleetId: 'f', siteId: 's', pose: { x: 0, y: 0, theta: 0 }, speed: 0, state: 'idle', battery: 80, ts: 1000, ...o });

describe('fleet summary and greeting', () => {
  const robots = [bot({ id: 'AMR-001', state: 'moving', speed: 1, task: { id: 'T1', type: 'transport', progress: 0.4 } }), bot({ id: 'AMR-002', state: 'waiting', task: { id: 'T2', type: 'return', from: 'STA-101', to: 'STA-104', progress: 0.2 } }),
    bot({ id: 'AMR-003', state: 'idle' }), bot({ id: 'AMR-004', state: 'blocked', alerts: [{ code: 'OBSTACLE', severity: 'critical', msg: 'Path obstructed' }], task: { id: 'T4', type: 'transport', to: 'STA-109', progress: 0.5 } }),
    bot({ id: 'AMR-005', state: 'charging', battery: 20, alerts: [{ code: 'LOW_BATT', severity: 'warn', msg: 'Low battery' }] })];
  it('summarises the fleet: active, trips, attention, health, utilisation', () => {
    expect(summarise(robots)).toEqual({ total: 5, active: 4, activeTrips: 3, attention: 2, health: 60, utilisation: 20 });
    expect(summarise([])).toMatchObject({ total: 0, health: 100 });
  });
  it('greets by the time of day and uses the first name', () => { expect(greeting(8)).toBe('Good morning,'); expect(greeting(14)).toBe('Good afternoon,'); expect(greeting(19)).toBe('Good evening,'); expect(firstName('Arjun Singh')).toBe('Arjun'); });





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
