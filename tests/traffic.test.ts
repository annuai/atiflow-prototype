import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FleetSim } from '../src/adapters/sim';
import type { NavGraph, RobotTelemetry, SiteLayout } from '../src/core/types';

const nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
const site = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8')) as SiteLayout;

type Rect = { x: number; y: number; th: number; l: number; w: number };
const corners = (r: Rect) => { const c = Math.cos(r.th), s = Math.sin(r.th); return [[r.l / 2, r.w / 2], [r.l / 2, -r.w / 2], [-r.l / 2, -r.w / 2], [-r.l / 2, r.w / 2]].map(([a, b]) => [r.x + a * c - b * s, r.y + a * s + b * c]); };
/** Separating-axis test on the real rectangles: true when they overlap or touch. */
function touching(a: Rect, b: Rect) {
  const A = corners(a), B = corners(b);
  for (const poly of [A, B]) for (let i = 0; i < 4; i++) {
    const p = poly[i], q = poly[(i + 1) % 4]; const nx = -(q[1] - p[1]), ny = q[0] - p[0];
    const pr = (P: number[][]) => P.map((v) => v[0] * nx + v[1] * ny); const pa = pr(A), pb = pr(B);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}
const rects = (t: RobotTelemetry): Rect[] => [{ x: t.pose.x, y: t.pose.y, th: t.pose.theta, l: 1.2, w: 0.85 }, ...(t.trailer ? [{ x: t.trailer.x, y: t.trailer.y, th: t.trailer.theta, l: 1.1, w: 0.7 }] : [])];

describe('traffic: robots and trolleys never touch, motion is smooth', () => {
  for (const seed of [3, 7, 11, 19]) it(`seed ${seed}: 20 simulated minutes`, () => {
    const sim = new FleetSim(nav, site.siteId, 14, seed); const bad: string[] = []; const last = new Map<string, RobotTelemetry>(); let loaded = 0, empty = 0, maxTurn = 0; let worstWait = 0; const waitSince = new Map<string, number>();

    for (let t = 0; t < 1200; t += 0.1) {
      sim.step(0.1); const snap = sim.snapshot();
      for (let i = 0; i < snap.length; i++) {
        const a = snap[i];
        for (let j = i + 1; j < snap.length; j++) { const b = snap[j]; if (Math.hypot(a.pose.x - b.pose.x, a.pose.y - b.pose.y) > 6) continue;
          if (rects(a).some((p) => rects(b).some((q) => touching(p, q)))) bad.push(`t=${t.toFixed(1)} ${a.id} x ${b.id}`); }
        const p = last.get(a.id);
        if (p && a.speed > 0.2) { const d = Math.abs(((a.pose.theta - p.pose.theta + Math.PI * 3) % (Math.PI * 2)) - Math.PI); maxTurn = Math.max(maxTurn, d); }
        if (a.state === 'waiting') { if (!waitSince.has(a.id)) waitSince.set(a.id, t); worstWait = Math.max(worstWait, t - waitSince.get(a.id)!); } else waitSince.delete(a.id);
        if (a.trailer) { loaded++; expect(a.payload).toBeTruthy(); } else if (a.state === 'moving' && a.speed > 0.2) { empty++; expect(a.payload).toBeFalsy(); }
        last.set(a.id, a);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(maxTurn).toBeLessThan(0.3);               // rad per 0.1 s while driving (3 rad/s): no snapping or spinning at corners
    expect(loaded).toBeGreaterThan(200); expect(empty).toBeGreaterThan(200);   // both loaded trips (trolley) and empty returns happen
  }, 60000);
});
