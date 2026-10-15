import type { SiteLayout } from '../core/types';

/** Spatial-hash collision world (site frame, meters). Circle vs wall segments & equipment boxes. */
export class CollisionWorld {
  private cell = 8;
  private grid = new Map<string, number[]>();
  private items: { seg?: [number, number, number, number, number]; box?: [number, number, number, number] }[] = [];
  constructor(site: SiteLayout) {
    for (const w of site.walls)
      this.add(
        { seg: [w.a[0], w.a[1], w.b[0], w.b[1], Math.max(w.t, 0.2) / 2] },
        Math.min(w.a[0], w.b[0]),
        Math.min(w.a[1], w.b[1]),
        Math.max(w.a[0], w.b[0]),
        Math.max(w.a[1], w.b[1]),
      );
    for (const q of site.equipment)
      if (q.h > 0.6)
        this.add(
          { box: [q.x - q.w / 2, q.y - q.d / 2, q.x + q.w / 2, q.y + q.d / 2] },
          q.x - q.w / 2,
          q.y - q.d / 2,
          q.x + q.w / 2,
          q.y + q.d / 2,
        );
  }
  private add(it: CollisionWorld['items'][number], x0: number, y0: number, x1: number, y1: number) {
    const id = this.items.push(it) - 1;
    for (let i = Math.floor(x0 / this.cell); i <= Math.floor(x1 / this.cell); i++)
      for (let j = Math.floor(y0 / this.cell); j <= Math.floor(y1 / this.cell); j++) {
        const k = i + ',' + j;
        (this.grid.get(k) ?? this.grid.set(k, []).get(k)!).push(id);
      }
  }
  hits(x: number, y: number, r: number): boolean {
    const seen = new Set<number>();
    for (let i = Math.floor((x - r) / this.cell); i <= Math.floor((x + r) / this.cell); i++)
      for (let j = Math.floor((y - r) / this.cell); j <= Math.floor((y + r) / this.cell); j++) {
        for (const id of this.grid.get(i + ',' + j) ?? []) {
          if (seen.has(id)) continue;
          seen.add(id);
          const it = this.items[id];
          if (it.box) {
            const [a, b, c, d] = it.box;
            const dx = Math.max(a - x, 0, x - c),
              dy = Math.max(b - y, 0, y - d);
            if (dx * dx + dy * dy < r * r) return true;
          } else if (it.seg) {
            const [ax, ay, bx, by, t] = it.seg;
            const vx = bx - ax,
              vy = by - ay;
            const L = vx * vx + vy * vy || 1;
            const u = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L));
            const dx = x - (ax + u * vx),
              dy = y - (ay + u * vy);
            if (dx * dx + dy * dy < (r + t) * (r + t)) return true;
          }
        }
      }
    return false;
  }
  /** Slide movement: try full, then axis-separated. */
  move(x: number, y: number, dx: number, dy: number, r: number): [number, number] {
    if (!this.hits(x + dx, y + dy, r)) return [x + dx, y + dy];
    if (!this.hits(x + dx, y, r)) return [x + dx, y];
    if (!this.hits(x, y + dy, r)) return [x, y + dy];
    return [x, y];
  }
}
