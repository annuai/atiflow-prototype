/**
 * Direction arrows for the lanes of a flat (SVG) map: one small arrowhead every so often along each lane, pointing the way robots drive it. A two-way road is two lanes running opposite
 * ways side by side, so it shows two opposing arrows. Used by every flat map view (Map Editor, workflow builder map) so a lane looks the same everywhere.
 * `toXY` turns a site point (metres) into the SVG's coordinates; `u` is metres per screen pixel, so the arrows keep their pixel size while zooming and thin out when zoomed far out.
 */
type P = [number, number];
const SIZE_PX = 4.5,
  GAP_PX = 90,
  MIN_LEN_M = 1.2;
export function laneArrowPath(
  lanes: ReadonlyArray<{ geom: P[] }>,
  toXY: (x: number, y: number) => P,
  u: number,
): string {
  const out: string[] = [];
  const size = SIZE_PX * u,
    gap = GAP_PX * u;
  for (const l of lanes) {
    const g = l.geom;
    if (g.length < 2) continue;
    const seg: number[] = [];
    let total = 0;
    for (let i = 1; i < g.length; i++) {
      const d = Math.hypot(g[i][0] - g[i - 1][0], g[i][1] - g[i - 1][1]);
      seg.push(d);
      total += d;
    }
    if (total < MIN_LEN_M) continue;
    const n = Math.max(1, Math.floor(total / gap));
    for (let k = 0; k < n; k++) {
      let rem = ((k + 0.5) * total) / n,
        i = 0;
      while (i < seg.length - 1 && rem > seg[i]) {
        rem -= seg[i];
        i++;
      }
      const a = g[i],
        b = g[i + 1],
        t = seg[i] ? Math.min(1, rem / seg[i]) : 0;
      const [cx, cy] = toXY(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      const [ax, ay] = toXY(a[0], a[1]),
        [bx, by] = toXY(b[0], b[1]);
      const dl = Math.hypot(bx - ax, by - ay) || 1;
      const dx = (bx - ax) / dl,
        dy = (by - ay) / dl,
        nx = -dy,
        ny = dx;
      const f = (x: number, y: number) => `${x.toFixed(3)} ${y.toFixed(3)}`;
      out.push(
        `M${f(cx + dx * size, cy + dy * size)}L${f(cx - dx * size * 0.7 + nx * size * 0.75, cy - dy * size * 0.7 + ny * size * 0.75)}L${f(cx - dx * size * 0.7 - nx * size * 0.75, cy - dy * size * 0.7 - ny * size * 0.75)}Z`,
      );
    }
  }
  return out.join('');
}
