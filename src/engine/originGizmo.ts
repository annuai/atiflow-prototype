import * as THREE from 'three';
import { toScene } from '../core/coords';
import { labelSprite } from './labels';

/**
 * The origin like a 3D program shows it: arrows along X (red, east), Y (green, north: the plan's Y) and up (blue), each with a label, and "0, 0" at the point. Drawn over the scene
 * (no depth test) so walls never hide it. `length` is in metres.
 */
export function originGizmo(length = 3): THREE.Group {
  const g = new THREE.Group();
  g.renderOrder = 999;
  const r = length * 0.018;
  const mat = (c: number) => new THREE.MeshBasicMaterial({ color: c, depthTest: false });
  const axis = (dir: THREE.Vector3, color: number, text: string) => {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, length, 10), mat(color));
    shaft.position.copy(dir).multiplyScalar(length / 2);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(r * 3, length * 0.14, 14), mat(color));
    tip.position.copy(dir).multiplyScalar(length + length * 0.07);
    // cylinders and cones point along +y: turn them onto `dir`
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    shaft.quaternion.copy(q);
    tip.quaternion.copy(q);
    for (const m of [shaft, tip]) m.renderOrder = 999;
    g.add(shaft, tip);
    const label = labelSprite(text, { color: '#ffffff', bg: `#${color.toString(16).padStart(6, '0')}`, size: 40 });
    const h = length * 0.2;
    label.scale.set(h * (label.userData.aspect as number), h, 1);
    label.position.copy(dir).multiplyScalar(length * 1.3);
    label.renderOrder = 1000;
    (label.material as THREE.SpriteMaterial).depthTest = false;
    g.add(label);
  };
  const [ex, ey, ez] = toScene(1, 0, 0),
    [nx, ny, nz] = toScene(0, 1, 0);
  axis(new THREE.Vector3(ex, ey, ez), 0xef4444, 'X');
  axis(new THREE.Vector3(nx, ny, nz), 0x22c55e, 'Y');
  axis(new THREE.Vector3(0, 1, 0), 0x3b82f6, 'Z');
  const dot = new THREE.Mesh(new THREE.SphereGeometry(r * 4, 16, 12), mat(0xffffff));
  dot.renderOrder = 999;
  g.add(dot);
  const zero = labelSprite('0, 0', { color: '#0f172a', bg: 'rgba(255,255,255,.9)', size: 36 });
  const zh = length * 0.16;
  zero.scale.set(zh * (zero.userData.aspect as number), zh, 1);
  zero.position.set(-length * 0.2, length * 0.12, length * 0.2);
  zero.renderOrder = 1000;
  (zero.material as THREE.SpriteMaterial).depthTest = false;
  g.add(zero);
  return g;
}
