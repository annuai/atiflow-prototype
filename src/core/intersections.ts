import type { LaneGraph } from './lanes';
import type { Vec2 } from './types';

/** Every place where two robots cannot pass each other: lanes of different flows closer than a robot pair needs (crossings, merges, forks, tight opposite lanes). Found from the lane geometry alone, so any map works. Each cluster is one intersection. */
export class Intersections {
  readonly clusters = new Map<string, number>();
  private pts: { x: number; y: number; c: string }[] = [];
  private cell = new Map<string, number[]>();
  private reach: number;
  constructor(graph: LaneGraph, gap = 0.9, reach = 2.0, join = 0) {
    this.reach = reach;
    const sm = graph.smoothLanes();
    type P = { x: number; y: number; lane: number };
    const all: P[] = [];
    sm.forEach((l, li) => {
      l.pts.forEach((q, i) => {
        all.push({ ...q, lane: li });
        if (i === 0) return;
        const a = l.pts[i - 1];
        const len = Math.hypot(q.x - a.x, q.y - a.y);
        for (let d = 0.4; d < len - 0.2; d += 0.4)
          all.push({ x: a.x + ((q.x - a.x) * d) / len, y: a.y + ((q.y - a.y) * d) / len, lane: li });
      });
    }); // a point every 0.4 m along every lane, long straight lanes included
    const lanes = graph.nav.lanes;
    const grid = new Map<string, number[]>();
    const key = (x: number, y: number) => Math.floor(x) + ',' + Math.floor(y);
    all.forEach((p, i) => {
      const k = key(p.x, p.y);
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
    });
    const parent = all.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const flagged = new Set<number>();
    const follows = (a: number, b: number) => lanes[a].to === lanes[b].from && lanes[b].to !== lanes[a].from; // b continues a (not a U-turn into the paired lane)
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      const cx = Math.floor(p.x),
        cy = Math.floor(p.y);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const j of grid.get(cx + dx + ',' + (cy + dy)) ?? []) {
            if (j <= i) continue;
            const q = all[j];
            if (q.lane === p.lane || follows(p.lane, q.lane) || follows(q.lane, p.lane)) continue;
            if (Math.hypot(p.x - q.x, p.y - q.y) < gap) {
              flagged.add(i);
              flagged.add(j);
              parent[find(i)] = find(j);
            }
          }
    }
    const fl = [...flagged];
    if (join > 0)
      for (const i of fl) {
        const p = all[i];
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            for (const j of grid.get(Math.floor(p.x) + dx + ',' + (Math.floor(p.y) + dy)) ?? [])
              if (j > i && flagged.has(j) && Math.hypot(p.x - all[j].x, p.y - all[j].y) < join)
                parent[find(i)] = find(j);
      }
    const ids = new Map<number, string>();
    let n = 0;
    for (const i of fl) {
      const r = find(i);
      if (!ids.has(r)) ids.set(r, 'X' + ++n);
      const c = ids.get(r)!;
      this.pts.push({ x: all[i].x, y: all[i].y, c });
      this.clusters.set(c, (this.clusters.get(c) ?? 0) + 1);
    }
    this.pts.forEach((p, i) => {
      const k = key(p.x, p.y);
      (this.cell.get(k) ?? this.cell.set(k, []).get(k)!).push(i);
    });
  }
  /** The points of every intersection (where lanes of different flows come closer than the gap): what a traffic zone is drawn around. */
  areas(): { id: string; pts: Vec2[] }[] {
    const out = new Map<string, Vec2[]>();
    for (const p of this.pts) (out.get(p.c) ?? out.set(p.c, []).get(p.c)!).push({ x: p.x, y: p.y });
    return [...out].map(([id, pts]) => ({ id, pts }));
  }
  /** Every intersection whose area (within `reach` of one of its points) contains the position. */
  near(x: number, y: number): string[] {
    const cx = Math.floor(x),
      cy = Math.floor(y),
      out = new Set<string>();
    const R = Math.ceil(this.reach) + 1;
    for (let dx = -R; dx <= R; dx++)
      for (let dy = -R; dy <= R; dy++)
        for (const i of this.cell.get(cx + dx + ',' + (cy + dy)) ?? []) {
          const p = this.pts[i];
          if (Math.hypot(p.x - x, p.y - y) < this.reach) out.add(p.c);
        }
    return [...out];
  }
}
