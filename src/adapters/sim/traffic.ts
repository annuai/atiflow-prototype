import { CLAIM, SAMPLE, TD } from './constants';
import { hit, robotCircles, trolleyCircles } from './footprint';
import { poseAt } from './path';
import type { Bot, Circle, Pose } from './types';
import type { World } from './world';

/** Who is where: the footprint of every robot and the stretch a robot reserves ahead, to keep robots from touching. */
export class Traffic {
  constructor(private readonly w: World) {}
  trailerPose(b: Bot): Pose | null {
    return b.attached && b.plan ? poseAt(b.plan, b.s - TD) : b.attached && b.trailer ? b.trailer : null;
  }
  body(o: Bot): Circle[] {
    const c = robotCircles({ x: o.pos.x, y: o.pos.y, th: o.theta });
    return o.trailer ? [...c, ...trolleyCircles(o.trailer)] : c;
  }
  /** The footprint (robot + trolley) at each checked position over the next `L` meters of the route. */
  corridor(b: Bot, L: number): { d: number; c: Circle[] }[] {
    const plan = b.plan!;
    const out: { d: number; c: Circle[] }[] = [];
    for (let d = SAMPLE; d <= L + 1e-6; d += SAMPLE) {
      const q = Math.min(b.s + d, plan.total);
      out.push({
        d,
        // (the stretch behind the robot, where its trolley hangs now, is not swept ahead: a robot right behind it would block it for ever while both wait)
        c: [
          ...robotCircles(poseAt(plan, q)),
          ...(b.attached && q - TD >= b.s - 0.2 ? trolleyCircles(poseAt(plan, q - TD)) : []),
        ],
      });
      if (q >= plan.total) break;
    }
    return out;
  }
  /** How far along its route the robot may drive: up to where its footprint would touch another robot or the way a higher-priority robot has reserved. */
  freeLength(b: Bot, claims: Map<string, Circle[]>): { len: number; claim: Circle[]; by: Bot | null } {
    const mine = this.corridor(b, CLAIM);
    const claim: Circle[] = [];
    let len = 0;
    for (const m of mine) {
      const by = this.touches(b, m.c, claims);
      if (by) return { len, claim, by };
      len = m.d;
      claim.push(...m.c);
    }
    return { len: Infinity, claim, by: null };
  }
  touches(b: Bot, mine: Circle[], claims: Map<string, Circle[]>): Bot | null {
    const at = mine[0];
    if (!at) return null;
    for (const o of this.w.bots) {
      if (o === b || o.state === 'offline' || Math.hypot(o.pos.x - at.x, o.pos.y - at.y) > 12) continue;
      if (hit(mine, this.body(o))) return o;
      const c = claims.get(o.id);
      if (c && b.ignoreClaims <= this.w.time && hit(mine, c)) return o;
    }
    return null;
  }
}
