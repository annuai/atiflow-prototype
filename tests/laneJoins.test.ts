import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LaneGraph } from '../src/core/lanes';
import type { NavGraph } from '../src/core/types';

const nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
const g = new LaneGraph(nav);

/** Every way a robot can pass from one lane into the next. */
const pairs = nav.lanes.flatMap((a) =>
  (g.out.get(a.to) ?? []).filter((b) => b.to !== a.from).map((b) => [a, b] as const),
);

describe('lane joins', () => {
  it('there are junctions to test', () => expect(pairs.length).toBeGreaterThan(100));
  it('a turn from one lane into the next never doubles back and never kinks', () => {
    let worstTurn = 0,
      backwards = 0;
    for (const [a, b] of pairs) {
      const p = g.plan([a, b]).pts;
      for (let i = 2; i < p.length; i++) {
        const u = { x: p[i - 1].x - p[i - 2].x, y: p[i - 1].y - p[i - 2].y },
          v = { x: p[i].x - p[i - 1].x, y: p[i].y - p[i - 1].y };
        const lu = Math.hypot(u.x, u.y),
          lv = Math.hypot(v.x, v.y);
        if (lu < 0.05 || lv < 0.05) continue; // (steps under 5 cm are rounding wobble, not direction)
        const cos = (u.x * v.x + u.y * v.y) / (lu * lv);
        if (cos < 0) backwards++;
        worstTurn = Math.max(worstTurn, Math.acos(Math.max(-1, Math.min(1, cos))));
      }
    }
    expect(backwards).toBe(0); // no step ever goes back on itself
    expect(worstTurn).toBeLessThan(1.3); // largest change of direction between neighbouring points (rad): corners are rounded, not kinked
  });
  it('a plan starting part-way along a lane carries on from the robot, never from the far end and back', () => {
    for (const [a, b] of pairs.slice(0, 120)) {
      const mid = {
        x: (a.geom[0][0] + a.geom[a.geom.length - 1][0]) / 2,
        y: (a.geom[0][1] + a.geom[a.geom.length - 1][1]) / 2,
      };
      const p = g.plan([a, b], mid, true).pts;
      let back = 0;
      for (let i = 2; i < p.length; i++) {
        const u = { x: p[i - 1].x - p[i - 2].x, y: p[i - 1].y - p[i - 2].y },
          v = { x: p[i].x - p[i - 1].x, y: p[i].y - p[i - 1].y };
        if (Math.hypot(u.x, u.y) > 0.05 && Math.hypot(v.x, v.y) > 0.05 && u.x * v.x + u.y * v.y < 0) back++;
      }
      expect(back, `${a.id}>${b.id}`).toBe(0);
    }
  });
  it('the drawn network is lanes cut short at junctions plus one curve per turn', () => {
    const lanes = g.roadLanes(),
      conns = g.connectors();
    expect(lanes).toHaveLength(nav.lanes.length);
    expect(conns.length).toBeGreaterThan(100);
    const total = (l: { pts: { x: number; y: number }[] }) =>
      l.pts.reduce((s, q, i) => (i ? s + Math.hypot(q.x - l.pts[i - 1].x, q.y - l.pts[i - 1].y) : 0), 0);
    expect(lanes.reduce((s, l) => s + total(l), 0)).toBeLessThan(nav.lanes.reduce((s, l) => s + l.len, 0)); // cut short, not longer
  });
});
