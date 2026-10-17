import { comesFromGateSide } from './gate';
import { angleDiff, pointInPoly, segDist, type Poly } from './geom';
import type { ForbiddenZone, NavGraph, RobotTelemetry, SiteLayout, TrafficZone } from './types';

export interface RuleAlert {
  code: 'FORBIDDEN_ZONE' | 'FLEET_BOUNDARY' | 'OFF_LANE' | 'WRONG_WAY' | 'TRAFFIC_VIOLATION';
  severity: 'warn' | 'critical';
  msg: string;
}
export interface TrafficZoneState {
  zone: TrafficZone;
  occupants: string[];
  waiting: string[];
  over: boolean;
}

const CELL = 4,
  OFF_LANE_M = 1.3,
  LANE_MATCH_M = 0.75,
  JUNCTION_M = 1.4,
  WRONG_WAY_RAD = (110 * Math.PI) / 180,
  FLEET_TOL = 0.9;
interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** Independent rule checker. Used on live telemetry so violations are visible no matter what the robot or fleet manager reports. */
export class RulesIndex {
  private ends = new Map<string, [number, number][]>();
  private areas = new Map<string, Poly[]>();
  private grid = new Map<string, Map<string, Seg[]>>();
  private fleetName = new Map<string, string>();
  constructor(
    public nav: NavGraph,
    site: SiteLayout,
  ) {
    const zones = new Map(site.zones.map((z) => [z.id, z.polygon as Poly]));
    for (const f of nav.fleets) {
      this.fleetName.set(f.id, f.name);
      this.areas.set(f.id, f.areas.map((a) => zones.get(a)).filter(Boolean) as Poly[]);
      this.grid.set(f.id, new Map());
      this.ends.set(f.id, []);
    }
    for (const l of nav.lanes)
      for (const f of l.fleets) {
        const g = this.grid.get(f)!;
        this.ends.get(f)!.push(l.geom[0], l.geom[l.geom.length - 1]);
        for (let i = 0; i + 1 < l.geom.length; i++) {
          const [ax, ay] = l.geom[i],
            [bx, by] = l.geom[i + 1];
          for (
            let cx = Math.floor((Math.min(ax, bx) - 1) / CELL);
            cx <= Math.floor((Math.max(ax, bx) + 1) / CELL);
            cx++
          )
            for (
              let cy = Math.floor((Math.min(ay, by) - 1) / CELL);
              cy <= Math.floor((Math.max(ay, by) + 1) / CELL);
              cy++
            ) {
              const k = cx + ',' + cy;
              (g.get(k) ?? g.set(k, []).get(k)!).push({ ax, ay, bx, by });
            }
        }
      }
  }
  forbiddenAt(x: number, y: number): ForbiddenZone | null {
    return this.nav.forbiddenZones.find((z) => pointInPoly(x, y, z.polygon)) ?? null;
  }
  trafficZoneAt(x: number, y: number): TrafficZone | null {
    return this.nav.trafficZones.find((z) => pointInPoly(x, y, z.polygon)) ?? null;
  }
  fleetAllowed(fleet: string, x: number, y: number): boolean {
    const areas = this.areas.get(fleet) ?? [];
    if (!areas.length) return true; // a fleet with no areas (a map that has none, such as an imported one) is limited by its lanes only
    return areas.some((p) => {
      const xs = p.map((q) => q[0]),
        ys = p.map((q) => q[1]);
      return (
        x >= Math.min(...xs) - FLEET_TOL &&
        x <= Math.max(...xs) + FLEET_TOL &&
        y >= Math.min(...ys) - FLEET_TOL &&
        y <= Math.max(...ys) + FLEET_TOL
      );
    });
  }
  /** All lane segments of the fleet within `r` meters of (x,y), with distance and travel heading. */
  lanesNear(fleet: string, x: number, y: number, r: number): { d: number; heading: number }[] {
    const g = this.grid.get(fleet);
    const out: { d: number; heading: number }[] = [];
    if (!g) return out;
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
      for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++)
        for (const s of g.get(cx + ',' + cy) ?? []) {
          const q = segDist(x, y, s.ax, s.ay, s.bx, s.by);
          if (q.d <= r) out.push(q);
        }
    return out;
  }
  /** True within a junction/station-turn area (lane ends), where lane-direction checks are not meaningful. */
  private nearLaneEnd(fleet: string, x: number, y: number) {
    return (this.ends.get(fleet) ?? []).some((e) => Math.hypot(e[0] - x, e[1] - y) < JUNCTION_M);
  }
  check(t: RobotTelemetry): RuleAlert[] {
    if (t.state === 'offline') return [];
    const out: RuleAlert[] = [];
    const { x, y, theta } = t.pose;
    const fz = this.forbiddenAt(x, y);
    if (fz) out.push({ code: 'FORBIDDEN_ZONE', severity: 'critical', msg: `Inside forbidden zone "${fz.name}"` });
    if (!this.fleetAllowed(t.fleetId, x, y))
      out.push({
        code: 'FLEET_BOUNDARY',
        severity: 'critical',
        msg: `Outside the ${this.fleetName.get(t.fleetId) ?? t.fleetId} map`,
      });
    const near = this.lanesNear(t.fleetId, x, y, OFF_LANE_M);
    if (!near.length) out.push({ code: 'OFF_LANE', severity: 'warn', msg: 'Not on a lane' });
    else if (
      t.speed > 0.2 &&
      !this.nearLaneEnd(t.fleetId, x, y) &&
      near.some((n) => n.d <= LANE_MATCH_M) &&
      near.filter((n) => n.d <= LANE_MATCH_M).every((n) => Math.abs(angleDiff(theta, n.heading)) > WRONG_WAY_RAD)
    )
      out.push({ code: 'WRONG_WAY', severity: 'critical', msg: 'Driving against lane direction' }); // only when NO lane within lane-width runs this way (lanes of a pair are 1 m apart)
    return out;
  }
  traffic(robots: RobotTelemetry[]): Record<string, TrafficZoneState> {
    const out: Record<string, TrafficZoneState> = {};
    for (const z of this.nav.trafficZones) {
      const occ = robots
        .filter(
          (r) =>
            r.state !== 'offline' &&
            !r.alerts?.some((a) => a.code === 'ZONE_HANDOVER') &&
            (r.speed >= 0.05 || r.traffic?.status === 'inside') &&
            (!z.gate || comesFromGateSide(z.gate, r.pose.theta)) &&
            pointInPoly(r.pose.x, r.pose.y, z.polygon),
        ) // in the zone = driving through it, or reported inside: a robot standing at a station or at a hold point inside the area is not in traffic (its body blocks the others physically), and a robot that handed its zone over to break a deadlock is a recorded exception (ZONE_HANDOVER); at a Line gate only the robots coming from its controlled side are counted (the others cross freely)
        .map((r) => r.id);
      const wait = robots.filter((r) => r.traffic?.status === 'waiting' && r.traffic.zoneId === z.id).map((r) => r.id);
      out[z.id] = { zone: z, occupants: occ, waiting: wait, over: occ.length > z.capacity };
    }
    return out;
  }
}
