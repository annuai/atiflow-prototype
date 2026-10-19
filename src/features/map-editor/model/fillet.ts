type P = [number, number];

/**
 * A route drawn point to point as the robot drives it: straight pieces joined by circular turns of `radius` at every corner. A corner whose two sides are too short for the full turn gets the
 * biggest turn that fits (at most half of each side), so neighbouring turns never overlap. Pure; the same function draws the lanes of a point-to-point (v2) map and writes the turns of a route
 * the Deployment Manager has to be given.
 */
export interface RouteSegment {
  kind: 'straight' | 'turn';
  from: P;
  to: P;
  /** unit direction the robot faces at `from` / `to` (turns only) */
  dirFrom?: P;
  dirTo?: P;
  /** centre and radius of the arc (turns only) */
  centre?: P;
  r?: number;
}

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const len = (a: P) => Math.hypot(a[0], a[1]);
const unit = (a: P): P => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** The straight and turn pieces of a route through `pts`. Corners are rounded with `radius`, or with `radii[k]` for the k-th corner (a point between the two ends) when given; a radius of 0 keeps the corner sharp. */
export function routeSegments(pts: P[], radius: number, radii?: number[]): RouteSegment[] {
  const clean = pts.filter((p, i) => !i || len(sub(p, pts[i - 1])) > 1e-6);
  if (clean.length < 2) return [];
  const out: RouteSegment[] = [];
  let at: P = clean[0];
  for (let i = 1; i < clean.length; i++) {
    const here = clean[i];
    const last = i === clean.length - 1;
    if (last) {
      if (len(sub(here, at)) > 1e-6) out.push({ kind: 'straight', from: at, to: here });
      break;
    }
    const wanted = radii?.[i - 1] ?? radius;
    const keep = () => {
      // the corner stays sharp: the straight pieces meet at the point
      if (len(sub(here, at)) > 1e-6) out.push({ kind: 'straight', from: at, to: here });
      at = here;
    };
    if (wanted <= 1e-6) {
      keep();
      continue;
    }
    const a = unit(sub(here, clean[i - 1])), // direction into the corner
      b = unit(sub(clean[i + 1], here)); // and out of it
    const cross = a[0] * b[1] - a[1] * b[0];
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]));
    const turn = Math.acos(dot); // how far the robot turns
    if (turn < 1e-3 || turn > Math.PI - 1e-3) {
      keep(); // straight on (or a U-turn, which no radius can make): the corner stays
      continue;
    }
    const reach = Math.min(
      wanted * Math.tan(turn / 2),
      len(sub(here, clean[i - 1])) / 2,
      len(sub(clean[i + 1], here)) / 2,
    );
    const r = reach / Math.tan(turn / 2);
    const p1: P = [here[0] - a[0] * reach, here[1] - a[1] * reach];
    const p2: P = [here[0] + b[0] * reach, here[1] + b[1] * reach];
    const side = cross > 0 ? 1 : -1; // left turn: the centre is to the left of the direction
    const centre: P = [p1[0] - a[1] * r * side, p1[1] + a[0] * r * side];
    if (len(sub(p1, at)) > 1e-6) out.push({ kind: 'straight', from: at, to: p1 });
    out.push({ kind: 'turn', from: p1, to: p2, dirFrom: a, dirTo: b, centre, r });
    at = p2;
  }
  return out;
}

/** The route as one line of points (arcs sampled every ~10 degrees), for drawing and driving. */
export function routeLine(pts: P[], radius: number, radii?: number[]): P[] {
  const segs = routeSegments(pts, radius, radii);
  if (!segs.length) return pts.map((p) => [...p] as P);
  const out: P[] = [segs[0].from];
  for (const s of segs) {
    if (s.kind === 'turn' && s.centre && s.r) {
      const a0 = Math.atan2(s.from[1] - s.centre[1], s.from[0] - s.centre[0]);
      let da = Math.atan2(s.to[1] - s.centre[1], s.to[0] - s.centre[0]) - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      const n = Math.max(2, Math.ceil(Math.abs(da) / (Math.PI / 18)));
      for (let k = 1; k < n; k++) {
        const t = a0 + (da * k) / n;
        out.push([s.centre[0] + s.r * Math.cos(t), s.centre[1] + s.r * Math.sin(t)]);
      }
    }
    out.push(s.to);
  }
  return out.map((p) => [round3(p[0]), round3(p[1])] as P);
}
