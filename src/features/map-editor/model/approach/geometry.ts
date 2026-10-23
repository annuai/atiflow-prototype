import { maneuverOf } from './maneuvers';
import { paramValue } from './params';
import type { ManeuverId, Role, Slot } from './types';

type P = [number, number];
export interface ApproachInput {
  role: Role;
  slot: Slot;
  /** the node on the lane */
  node: P;
  /** the direction the road runs at the node (unit vector) */
  lane: P;
  /** the station's place and the way it faces (towards the lane, radians) */
  station: P;
  theta: number;
}
export interface ApproachPath {
  /** the path in the order the robot drives it (a park runs lane -> station, an unpark station -> lane) */
  pts: P[];
  /** from this point index on the robot reverses */
  reverseFrom?: number;
  /** places the robot turns on the spot, or stops to detect */
  marks: { at: P; kind: 'rotate' | 'stop' }[];
  /** where the two handles sit: the start of the maneuver along the lane, and the point in front of the station */
  inlaneAt: P;
  perpAt: P;
}

const add = (a: P, b: P, k = 1): P => [a[0] + b[0] * k, a[1] + b[1] * k];
function bezier(a: P, ca: P, cb: P, b: P, n = 22): P[] {
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      m = 1 - t;
    out.push([
      m * m * m * a[0] + 3 * m * m * t * ca[0] + 3 * m * t * t * cb[0] + t * t * t * b[0],
      m * m * m * a[1] + 3 * m * m * t * ca[1] + 3 * m * t * t * cb[1] + t * t * t * b[1],
    ]);
  }
  return out;
}
/** A smooth curve from `a` leaving along `da` to `b` arriving along `db`. */
const curve = (a: P, da: P, b: P, db: P): P[] => {
  const k = Math.max(0.5, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.45);
  return bezier(a, add(a, da, k), add(b, db, -k), b);
};

/**
 * The path a maneuver draws, in metres. It is the editor's picture of the maneuver (the robot's own planner makes the real path), made from the same distances, so moving a distance moves the
 * picture the way it will move the robot. u points from the station towards the lane; the robot arrives driving -u.
 */
export function approachPath(i: ApproachInput): ApproachPath {
  const u: P = [Math.cos(i.theta), Math.sin(i.theta)];
  const inlane = paramValue(i.slot, 'inlane_dist');
  const perp = paramValue(i.slot, 'perpendicular_dist');
  const extIn = paramValue(i.slot, 'inlane_extension');
  const extPerp = paramValue(i.slot, 'perpendicular_extension');
  const park = i.role === 'park';
  // park: the maneuver starts `inlane` BEFORE the node along the lane; unpark: it ends `inlane` AFTER it
  const inlaneAt = add(i.node, i.lane, park ? -inlane : inlane);
  const perpAt = add(i.station, u, perp);
  const id: ManeuverId = maneuverOf(i.slot.maneuver).id;
  const marks: ApproachPath['marks'] = [];
  let pts: P[];
  let reverseFrom: number | undefined;
  const down: P = [-u[0], -u[1]];
  switch (id) {
    case 'inplace': {
      // stop and rotate on the lane, then drive straight in (a pick stops at the detection point first)
      pts = park ? [i.node, perpAt, i.station] : [i.station, i.node];
      marks.push({ at: i.node, kind: 'rotate' });
      if (park) marks.push({ at: perpAt, kind: 'stop' });
      break;
    }
    case 'lanechange':
    case 'reverse_lanechange': {
      // a lane change to the point in front of the station, a turn on the spot there, then straight in
      const front = perpAt;
      const change = curve(inlaneAt, i.lane, front, i.lane);
      pts = park ? [...change, i.station] : [i.station, ...change.slice().reverse()];
      marks.push({ at: front, kind: 'rotate' });
      if (id === 'reverse_lanechange') reverseFrom = 0;
      break;
    }
    case 'three_point_turn': {
      // forward off the lane to the apex, then reverse straight into the station
      const apex = add(add(perpAt, u, extPerp), i.lane, park ? -extIn : extIn);
      const fwd = curve(inlaneAt, i.lane, apex, down);
      pts = park ? [...fwd, i.station] : [i.station, ...fwd.slice().reverse()];
      reverseFrom = park ? fwd.length - 1 : 0;
      marks.push({ at: apex, kind: 'stop' });
      break;
    }
    case 'three_point_lanechange': {
      // a lane change to a point beside the lane, then a reverse curve into the station
      const side = add(add(inlaneAt, i.lane, park ? extIn : -extIn), u, extPerp);
      const first = curve(inlaneAt, i.lane, side, i.lane);
      const back = curve(side, [-i.lane[0], -i.lane[1]], perpAt, down);
      const all = [...first, ...back.slice(1), i.station];
      pts = park ? all : all.slice().reverse();
      reverseFrom = park ? first.length : 0;
      marks.push({ at: side, kind: 'stop' });
      break;
    }
    default: {
      // one_shot_turn: one smooth curve from the lane to the point in front of the station, then straight in
      const c = curve(inlaneAt, i.lane, perpAt, down);
      pts = park ? [...c, i.station] : [i.station, ...c.slice().reverse()];
    }
  }
  return { pts, reverseFrom, marks, inlaneAt, perpAt };
}

/** The distance a dragged handle means: along the lane (from the node, before it for a park) and across (in front of the station). */
export const inlaneFromPoint = (role: Role, node: P, lane: P, p: P): number =>
  Math.round((role === 'park' ? -1 : 1) * ((p[0] - node[0]) * lane[0] + (p[1] - node[1]) * lane[1]) * 20) / 20;
export const perpFromPoint = (station: P, theta: number, p: P): number =>
  Math.round(((p[0] - station[0]) * Math.cos(theta) + (p[1] - station[1]) * Math.sin(theta)) * 20) / 20;

/** The unit vector a road runs along at the point of it nearest to (x, y). */
export function laneAt(points: [number, number][], seg: number): P {
  const a = points[seg],
    b = points[Math.min(seg + 1, points.length - 1)];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}
