import { pointAt, type PathPlan } from '../../core/lanes';
import type { Pose } from './types';

/** Positions and headings along a planned route (pure). */
/** Heading of the route at arc length q: central difference over 0.5 m, so it is smooth even on curves. */
export function headingAt(plan: PathPlan, q: number) {
  const a = pointAt(plan, Math.max(0, Math.min(plan.total, q - 0.25))),
    c = pointAt(plan, Math.max(0, Math.min(plan.total, q + 0.25)));
  return Math.hypot(c.x - a.x, c.y - a.y) > 1e-6
    ? Math.atan2(c.y - a.y, c.x - a.x)
    : pointAt(plan, Math.max(0, Math.min(plan.total, q))).heading;
}
/** Pose on the route at arc length q; before the start the route is extended backwards along its first heading (where a trolley hangs while the robot leaves). */
export function poseAt(plan: PathPlan, q: number): Pose {
  const h = headingAt(plan, Math.max(0, q));
  if (q >= 0) {
    const p = pointAt(plan, Math.min(q, plan.total));
    return { x: p.x, y: p.y, th: h };
  }
  const p0 = pointAt(plan, 0);
  return { x: p0.x + Math.cos(h) * q, y: p0.y + Math.sin(h) * q, th: h };
}
