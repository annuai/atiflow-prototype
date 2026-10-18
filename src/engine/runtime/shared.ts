import * as THREE from 'three';
import type { RobotTelemetry } from '../../core/types';

export const ROBOT_SCALE = 1; // true size: the simulator keeps robots 1 m apart in neighbouring lanes, so anything larger would visibly overlap
export const EYE = 1.7;
/** Plan (2D) view = the same scene seen with a very narrow field of view from far away: no perspective, so the plan is to scale everywhere. `kOf` is how many times further away the camera sits than in the 3D view for the same picture. */
export const FOV_3D = 42,
  FOV_PLAN = 5;
export const kOf = (fov: number) =>
  Math.tan(THREE.MathUtils.degToRad(FOV_3D / 2)) / Math.tan(THREE.MathUtils.degToRad(fov / 2));

export interface RobotVis {
  group: THREE.Group;
  light: THREE.Mesh;
  dot: THREE.Sprite;
  halo: THREE.Mesh;
  ring: THREE.Mesh;
  tgt: { x: number; y: number; th: number };
  v: number;
  t?: RobotTelemetry;
  lightMat: THREE.MeshBasicMaterial;
  /** Smooth playback between telemetry ticks: from the pose shown when the tick arrived to the new pose, finished when the next tick is due. */
  from: { x: number; y: number; th: number };
  tArr: number;
  dt: number;
  glyph: THREE.Group;
  glyphMat: THREE.MeshBasicMaterial;
  bodyMat: THREE.MeshBasicMaterial;
  inner: THREE.Group;
  trolley: THREE.Group | null;
  trolleyKey: string;
  trFrom: { x: number; y: number; th: number } | null;
  trTgt: { x: number; y: number; th: number } | null;
}
export const lerpAngle = (a: number, b: number, k: number) =>
  a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;
