import { describe, expect, it } from 'vitest';
import { deadlockRings, detect } from '../src/features/action-center/model/detect';
import { ActionCenterEngine, CLEAR_AFTER_MS, logToCsv } from '../src/features/action-center/model/engine';
import type { RobotTelemetry } from '../src/core/types';

const TH = { waitCallS: 90, waitUrgentS: 120, batteryLow: 25 };
const bot = (id: string, over: Partial<RobotTelemetry> = {}): RobotTelemetry => ({
  id,
  model: 'sherpa-xt-lite',
  fleetId: 'line-side',
  siteId: 'ecc',
  pose: { x: 0, y: 0, theta: 0 },
  speed: 0,
  state: 'moving',
  battery: 80,
  ts: 0,
  ...over,
});
const wait = (id: string, on: string[]) => bot(id, { state: 'waiting', waitsOn: on });

describe('what asks for help', () => {
  it('a ring of robots waiting for each other is ONE deadlock call listing all of them', () => {
    const robots = [wait('A', ['B']), wait('B', ['C']), wait('C', ['A']), wait('D', ['A'])]; // D waits on the ring but is not part of it
    expect(deadlockRings(robots)).toEqual([['A', 'B', 'C']]);
    const calls = detect(robots, () => 200, TH);
    const dead = calls.filter((c) => c.kind === 'deadlock');
    expect(dead).toHaveLength(1);
    expect(dead[0].robots).toEqual(['A', 'B', 'C']);
    expect(calls.some((c) => c.kind === 'stuck' && ['A', 'B', 'C'].includes(c.robots[0]))).toBe(false); // no second call for the same problem
  });
  it('a robot only waiting for a robot that moves is not a deadlock; a long wait becomes a call, urgent later', () => {
    const robots = [wait('A', ['B']), bot('B')];
    expect(deadlockRings(robots)).toEqual([]);
    expect(detect(robots, () => 60, TH)).toEqual([]);
    expect(detect(robots, () => 100, TH)[0]).toMatchObject({ kind: 'stuck', severity: 'warn' });
    expect(detect(robots, () => 130, TH)[0].severity).toBe('critical');
  });
  it('blocked, error, low battery (not while heading to a charger or charging) and rule alerts', () => {
    expect(detect([bot('A', { state: 'blocked' })], () => 0, TH)[0]).toMatchObject({
      kind: 'blocked',
      severity: 'critical',
    });
    expect(
      detect(
        [bot('A', { state: 'error', alerts: [{ code: 'MOTOR', severity: 'critical', msg: 'Drive fault' }] })],
        () => 0,
        TH,
      )[0].reason,
    ).toBe('Drive fault');
    expect(detect([bot('A', { battery: 20 })], () => 0, TH)[0].kind).toBe('battery');
    expect(detect([bot('A', { battery: 20, task: { id: 'T', type: 'charge' } })], () => 0, TH)).toEqual([]);
    expect(detect([bot('A', { battery: 5, state: 'charging' })], () => 0, TH)).toEqual([]);
    expect(
      detect(
        [bot('A', { alerts: [{ code: 'FORBIDDEN_ZONE', severity: 'critical', msg: 'In a no-go zone' }] })],
        () => 0,
        TH,
      )[0].kind,
    ).toBe('rule');
  });
});

describe('the life of a call', () => {
  const blocked = [bot('AMR-1', { state: 'blocked' })],
    fine = [bot('AMR-1')];
  it('opens once, keeps its id, and resolves itself only after its cause has been gone for a few seconds', () => {
    const e = new ActionCenterEngine();
    e.ingest(blocked, 0, TH);
    e.ingest(blocked, 1000, TH);
    expect(e.state.active).toHaveLength(1);
    const id = e.state.active[0].id;
    expect(id).toBe('CALL-001');
    e.ingest(fine, 2000, TH);
    expect(e.state.active).toHaveLength(1);
    e.ingest(blocked, 3000, TH);
    e.ingest(fine, 4000, TH);
    e.ingest(fine, 4000 + CLEAR_AFTER_MS, TH);
    expect(e.state.active).toHaveLength(0);
    expect(e.state.log[0]).toMatchObject({ id, status: 'resolved', resolution: 'Cleared on its own' });
  });
  it('taking a call locks it to a person; giving it back opens it again', () => {
    const e = new ActionCenterEngine();
    e.ingest(blocked, 0, TH);
    const id = e.state.active[0].id;
    e.acknowledge(id, 'Arjun Singh');
    expect(e.state.active[0]).toMatchObject({ status: 'acknowledged', claimedBy: 'Arjun Singh' });
    e.release(id);
    expect(e.state.active[0]).toMatchObject({ status: 'open', claimedBy: undefined });
  });
  it('resolved by hand: logged with who and what, and not reopened while the cause is still there', () => {
    const e = new ActionCenterEngine();
    e.ingest(blocked, 0, TH);
    const id = e.state.active[0].id;
    e.resolve(id, 'Arjun Singh', 'Cleared the obstacle', 9000);
    expect(e.state.active).toHaveLength(0);
    expect(e.state.log[0]).toMatchObject({ resolvedBy: 'Arjun Singh', resolution: 'Cleared the obstacle' });
    e.ingest(blocked, 10_000, TH);
    expect(e.state.active).toHaveLength(0);
    e.ingest(fine, 11_000, TH);
    e.ingest(blocked, 12_000, TH);
    expect(e.state.active).toHaveLength(1); // it came back after clearing once: a new call
  });
  it('a long wait is measured from when the robot started waiting', () => {
    const e = new ActionCenterEngine();
    const w = [bot('AMR-1', { state: 'waiting' })];
    e.ingest(w, 0, TH);
    e.ingest(w, 80_000, TH);
    expect(e.state.active).toHaveLength(0);
    e.ingest(w, 95_000, TH);
    expect(e.state.active[0].kind).toBe('stuck');
  });
  it('counts repeats of the same kind at the same place, and exports the log as CSV', () => {
    const e = new ActionCenterEngine();
    const at = (s: string) => [bot('AMR-1', { state: 'blocked', atStation: s })];
    e.ingest(at('STA-104'), 0, TH);
    e.resolve('CALL-001', 'A', 'x', 1);
    e.ingest(at('STA-104'), 2, TH);
    e.ingest([bot('AMR-1')], 3, TH);
    e.ingest(at('STA-104'), 4, TH);
    expect(e.state.active[0].repeats).toBe(1);
    const csv = logToCsv(e.state.log, () => 'Line Side Fleet');
    expect(csv.split('\n')[0]).toContain('Handled by');
    expect(csv).toContain('CALL-001');
    expect(csv).toContain('Line Side Fleet');
  });
  it('clearing the active calls (scope change) keeps the log', () => {
    const e = new ActionCenterEngine();
    e.ingest(blocked, 0, TH);
    e.resolve('CALL-001', 'A', 'x');
    e.ingest(blocked, 1, TH);
    e.ingest(fine, 2, TH);
    e.ingest(blocked, 3, TH);
    e.clearActive();
    expect(e.state.active).toEqual([]);
    expect(e.state.log).toHaveLength(1);
  });
});
