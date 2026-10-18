import type { RobotTelemetry, Vec2 } from '../../core/types';
import { CLEAR } from './constants';
import type { Circle, Pose } from './types';

export const ROBOT_R = 0.435,
  TROLLEY_R = 0.375; // the circle chains cover the 1.2 x 0.85 m body with about 1 cm to spare
export const TURN_R = 0.47; // turning on the spot swings the corners of the 1.2 x 0.85 m body out past the circle chain, so that check uses wider circles
export const robotCircles = (p: Pose, r = ROBOT_R): Circle[] =>
  [-0.45, -0.15, 0.15, 0.45].map((o) => ({ x: p.x + Math.cos(p.th) * o, y: p.y + Math.sin(p.th) * o, r }));
export const trolleyCircles = (p: Pose, r = TROLLEY_R): Circle[] =>
  [-0.4, -0.13, 0.13, 0.4].map((o) => ({ x: p.x + Math.cos(p.th) * o, y: p.y + Math.sin(p.th) * o, r }));
export const hit = (a: Circle[], b: Circle[]) =>
  a.some((p) => b.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r + CLEAR));
/** Where the robot says it is: its real position, plus the error of a robot that was moved by hand and not relocalized yet. */
export function reportedPose(b: { pos: Vec2; theta: number; lostBy: Vec2 | null }): RobotTelemetry['pose'] {
  const by = b.lostBy ?? { x: 0, y: 0 };
  return { x: b.pos.x + by.x, y: b.pos.y + by.y, theta: b.theta };
}
