import type { MaterialRequest, MaterialStats, TopMaterial, Waiting } from './types';

const MIN = 60_000;
const within = (t: number | undefined, from: number, to: number): t is number => t !== undefined && t >= from && t < to;
const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const minutes = (ms: number) => ms / MIN;

/**
 * The material KPIs of one period [from, to) (ms). Rules:
 * - "received" = created in the period; "delivered" = reached Completed in the period (a request made yesterday and delivered today counts as delivered today);
 * - fulfilment = delivered / (delivered + cancelled + rejected + failed), all counted by when they ended: the share of ended requests that actually arrived;
 * - durations average the requests delivered in the period: approval (only those that needed it), waiting for a robot, being carried, and the whole request-to-delivery cycle.
 */
export function stats(requests: MaterialRequest[], from: number, to: number): MaterialStats {
  const done = requests.filter((r) => within(r.at.completed, from, to));
  const ended = (s: 'cancelled' | 'rejected' | 'failed') => requests.filter((r) => within(r.at[s], from, to)).length;
  const cancelled = ended('cancelled'),
    rejected = ended('rejected'),
    failed = ended('failed');
  const finished = done.length + cancelled + rejected + failed;
  const received = requests.filter((r) => within(r.createdAt, from, to));
  const gap = (a: number | undefined, b: number | undefined) =>
    a !== undefined && b !== undefined && b >= a ? minutes(b - a) : null;
  const list = (f: (r: MaterialRequest) => number | null) => done.map(f).filter((x): x is number => x !== null);
  return {
    requests: received.length,
    unitsAsked: received.reduce((a, r) => a + r.qty, 0),
    delivered: done.length,
    units: done.reduce((a, r) => a + r.qty, 0),
    cancelled,
    rejected,
    failed,
    fulfilmentPct: finished ? Math.round((done.length / finished) * 100) : null,
    approvalMin: avg(list((r) => (r.needsApproval ? gap(r.createdAt, r.at.approved) : null))),
    robotWaitMin: avg(list((r) => gap(r.at.approved ?? r.createdAt, r.at.ongoing))),
    deliveryMin: avg(list((r) => gap(r.at.ongoing, r.at.completed))),
    cycleMin: avg(list((r) => gap(r.createdAt, r.at.completed))),
  };
}

/** Where every open request stands right now. */
export function waiting(requests: MaterialRequest[], now: number): Waiting {
  const approval = requests.filter((r) => r.status === 'pending').sort((a, b) => a.createdAt - b.createdAt),
    robot = requests
      .filter((r) => r.status === 'approved')
      .sort((a, b) => (a.at.approved ?? a.createdAt) - (b.at.approved ?? b.createdAt)),
    moving = requests.filter((r) => r.status === 'ongoing').sort((a, b) => (a.at.ongoing ?? 0) - (b.at.ongoing ?? 0));
  return {
    approval,
    robot,
    moving,
    oldestApprovalMs: approval[0] ? now - approval[0].createdAt : 0,
    oldestRobotMs: robot[0] ? now - (robot[0].at.approved ?? robot[0].createdAt) : 0,
  };
}

/** The materials delivered in the period, most pieces first. */
export function topMaterials(requests: MaterialRequest[], from: number, to: number, n = 5): TopMaterial[] {
  const by = new Map<string, TopMaterial>();
  for (const r of requests)
    if (within(r.at.completed, from, to)) {
      const t = by.get(r.code) ?? { code: r.code, name: r.name, units: 0, requests: 0 };
      t.units += r.qty;
      t.requests += 1;
      by.set(r.code, t);
    }
  return [...by.values()].sort((a, b) => b.units - a.units || a.code.localeCompare(b.code)).slice(0, n);
}

/** Pieces delivered per fleet in the period. */
export function byFleet(requests: MaterialRequest[], from: number, to: number) {
  const by = new Map<string, number>();
  for (const r of requests) if (within(r.at.completed, from, to)) by.set(r.fleet, (by.get(r.fleet) ?? 0) + r.qty);
  return [...by.entries()].map(([fleet, units]) => ({ fleet, units })).sort((a, b) => b.units - a.units);
}

/** Pieces delivered per hour (for one day) or per day (for longer periods), each bucket starting at `label`. */
export function series(
  requests: MaterialRequest[],
  from: Date,
  to: Date,
): { bucket: 'hour' | 'day'; points: { label: Date; units: number }[] } {
  const oneDay = from.toDateString() === to.toDateString();
  const step = oneDay ? 3_600_000 : 86_400_000;
  const start = from.getTime(),
    end = oneDay ? start + 86_400_000 : new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).getTime();
  const points: { label: Date; units: number }[] = [];
  for (let t = start; t < end; t += step) {
    points.push({
      label: new Date(t),
      units: requests.filter((r) => within(r.at.completed, t, t + step)).reduce((a, r) => a + r.qty, 0),
    });
  }
  return { bucket: oneDay ? 'hour' : 'day', points };
}

/** Whole minutes for display ("4 min", "1 h 5 min"): the words come from the caller. */
export const roundMinutes = (m: number | null) => (m === null ? null : Math.max(0, Math.round(m)));
