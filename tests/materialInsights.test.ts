import { describe, expect, it } from 'vitest';
import { hasMaterialWorkflows } from '@/features/material-insights';
import { byFleet, series, stats, topMaterials, waiting } from '@/features/material-insights/model/kpis';
import { sampleRequests } from '@/features/material-insights/model/sample';
import type { MaterialRequest } from '@/features/material-insights/model/types';

const MIN = 60_000;
const T0 = new Date(2026, 9, 15, 0, 0, 0).getTime();
const at = (m: number) => T0 + m * MIN;
const req = (id: string, over: Partial<MaterialRequest>): MaterialRequest => ({
  id,
  fleet: 'Line Side Fleet',
  code: 'DCP-1001',
  name: 'Drive Chain Pin',
  qty: 10,
  status: 'completed',
  needsApproval: false,
  createdAt: at(60),
  legs: ['STA-116', 'STA-107'],
  at: {},
  ...over,
});
const done = (
  id: string,
  createdMin: number,
  approvedMin: number,
  ongoingMin: number,
  doneMin: number,
  over: Partial<MaterialRequest> = {},
) =>
  req(id, {
    createdAt: at(createdMin),
    at: { approved: at(approvedMin), ongoing: at(ongoingMin), completed: at(doneMin) },
    needsApproval: true,
    ...over,
  });

const DAY = [T0, T0 + 86_400_000] as const;

describe('material KPIs of a period', () => {
  const rows = [
    done('a', 60, 66, 70, 80, { qty: 20 }), // approval 6, wait 4, carry 10, cycle 20
    done('b', 100, 104, 110, 130, { qty: 10, code: 'DCP-1002', name: 'Plate' }), // approval 4, wait 6, carry 20, cycle 30
    req('c', { status: 'cancelled', createdAt: at(120), at: { cancelled: at(125) } }),
    req('d', { status: 'rejected', createdAt: at(140), at: { rejected: at(145) } }),
    req('e', { status: 'failed', createdAt: at(150), at: { failed: at(170) } }),
  ];
  const s = stats(rows, ...DAY);
  it('counts what was received, delivered and how the rest ended', () => {
    expect(s).toMatchObject({ requests: 5, delivered: 2, units: 30, cancelled: 1, rejected: 1, failed: 1 });
  });
  it('fulfilment is delivered out of everything that ended', () => expect(s.fulfilmentPct).toBe(40));
  it('averages the approval, the wait for a robot, the carry and the whole cycle of the delivered ones', () => {
    expect(s.approvalMin).toBe(5);
    expect(s.robotWaitMin).toBe(5);
    expect(s.deliveryMin).toBe(15);
    expect(s.cycleMin).toBe(25);
  });
  it('a request without approval has no approval time, and nothing delivered gives no averages', () => {
    expect(stats([done('x', 10, 10, 12, 20, { needsApproval: false })], ...DAY).approvalMin).toBeNull();
    const none = stats([], ...DAY);
    expect(none.fulfilmentPct).toBeNull();
    expect(none.cycleMin).toBeNull();
  });
  it('a request made yesterday and delivered today is delivered today (and received yesterday)', () => {
    const r = done('y', -120, -110, -100, 30);
    expect(stats([r], ...DAY)).toMatchObject({ requests: 0, delivered: 1, units: 10 });
  });
});

describe('what is open right now', () => {
  const rows = [
    req('p1', { status: 'pending', createdAt: at(10) }),
    req('p2', { status: 'pending', createdAt: at(30) }),
    req('w1', { status: 'approved', createdAt: at(20), at: { approved: at(25) } }),
    req('m1', { status: 'ongoing', createdAt: at(5), at: { approved: at(6), ongoing: at(8) }, robotId: 'AMR-002' }),
  ];
  it('splits waiting for approval, for a robot and on the way, oldest first, with the age of the oldest', () => {
    const w = waiting(rows, at(60));
    expect(w.approval.map((r) => r.id)).toEqual(['p1', 'p2']);
    expect(w.robot.map((r) => r.id)).toEqual(['w1']);
    expect(w.moving.map((r) => r.id)).toEqual(['m1']);
    expect(w.oldestApprovalMs).toBe(50 * MIN);
    expect(w.oldestRobotMs).toBe(35 * MIN);
  });
});

describe('top materials, fleets and the series', () => {
  const rows = [
    done('a', 10, 12, 14, 30, { qty: 20 }),
    done('b', 20, 22, 24, 40, { qty: 30, code: 'DCP-1002', name: 'Plate', fleet: 'Assembly Fleet' }),
    done('c', 30, 32, 34, 70, { qty: 5 }),
  ];
  it('ranks by pieces delivered', () => {
    expect(topMaterials(rows, ...DAY).map((m) => [m.code, m.units, m.requests])).toEqual([
      ['DCP-1002', 30, 1],
      ['DCP-1001', 25, 2],
    ]);
  });
  it('sums pieces per fleet', () => {
    expect(byFleet(rows, ...DAY)).toEqual(
      [
        { fleet: 'Line Side Fleet', units: 25 },
        { fleet: 'Assembly Fleet', units: 30 },
      ].sort((a, b) => b.units - a.units),
    );
  });
  it('one day is read by the hour, longer periods by the day', () => {
    const day = series(rows, new Date(T0), new Date(T0));
    expect(day.bucket).toBe('hour');
    expect(day.points).toHaveLength(24);
    expect(day.points[0].units).toBe(50);
    expect(day.points[1].units).toBe(5);
    const week = series(rows, new Date(T0 - 6 * 86_400_000), new Date(T0));
    expect(week.bucket).toBe('day');
    expect(week.points).toHaveLength(7);
    expect(week.points[6].units).toBe(55);
  });
});

describe('sample data', () => {
  it('is the same every time, delivers most requests and keeps a few open only around now', () => {
    const now = new Date(2026, 9, 15, 11, 0).getTime();
    const a = sampleRequests(new Date(T0), new Date(T0), ['Line Side Fleet', 'Assembly Fleet'], now);
    const b = sampleRequests(new Date(T0), new Date(T0), ['Line Side Fleet', 'Assembly Fleet'], now);
    expect(a).toEqual(b);
    const s = stats(a, T0, now);
    expect(s.delivered).toBeGreaterThan(s.cancelled + s.rejected + s.failed);
    expect(a.every((r) => r.createdAt <= now)).toBe(true);
    expect(
      a.filter((r) => r.status === 'pending' || r.status === 'approved' || r.status === 'ongoing').length,
    ).toBeLessThan(8);
  });
});

describe('who gets material views', () => {
  const wf = (fleet: string | null, types: string[], saved = true) =>
    ({ id: fleet + types.join(), name: 'w', fleet, saved, nodes: types.map((t) => ({ id: t, t, f: {} })) }) as never;
  it('only fleets with a workflow that has a Material step: a fleet that only runs saved routes gets none', () => {
    const flows = {
      a: wf('Line Side Fleet', ['start', 'material', 'end']),
      b: wf('Assembly Fleet', ['start', 'station', 'end']),
    };
    expect(hasMaterialWorkflows(flows, ['Line Side Fleet'])).toBe(true);
    expect(hasMaterialWorkflows(flows, ['Assembly Fleet'])).toBe(false);
    expect(hasMaterialWorkflows(flows, [])).toBe(false);
  });
  it('an unsaved draft does not count', () => {
    expect(
      hasMaterialWorkflows({ a: wf('Line Side Fleet', ['start', 'material', 'end'], false) }, ['Line Side Fleet']),
    ).toBe(false);
  });
});
