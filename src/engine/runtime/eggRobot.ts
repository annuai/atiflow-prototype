import * as THREE from 'three';
import { labelSprite } from '../labels';
import { DEFAULT_MODEL, ROBOT_MODELS } from '../robotMesh';

interface Run {
  group: THREE.Group;
  label: THREE.Sprite;
  a: THREE.Vector3;
  b: THREE.Vector3;
  t: number;
  seconds: number;
}

const SECONDS = 9;

/** Easter egg: a robot with a ribbon that drives across the 3D floor in front of the camera, along the floor, and is gone. */
export class EggRobots {
  private runs: Run[] = [];
  constructor(private scene: THREE.Scene) {}

  launch(text: string, camera: THREE.Camera, target: THREE.Vector3) {
    const dist = camera.position.distanceTo(target);
    const k = Math.max(0.6, dist / 16); // big enough to read from where the camera is
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    right.y = 0;
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const span = dist * 0.9;
    const a = target
      .clone()
      .setY(0)
      .addScaledVector(right, -span / 2);
    const b = target
      .clone()
      .setY(0)
      .addScaledVector(right, span / 2);

    const group = new THREE.Group();
    const body = ROBOT_MODELS[DEFAULT_MODEL].build().group;
    group.add(body);
    group.scale.setScalar(k);
    group.rotation.y = Math.atan2(-right.z, right.x); // the robot's front is +X
    const label = labelSprite(text, { color: '#ffffff', bg: '#33bab1', size: 56 });
    const h = 0.6 * k;
    label.scale.set(h * (label.userData.aspect as number), h, 1);
    label.position.set(a.x, 1.3 * k, a.z);
    this.scene.add(group, label);
    this.runs.push({ group, label, a, b, t: 0, seconds: SECONDS });
  }

  update(dt: number) {
    for (const r of this.runs) {
      r.t += dt;
      const f = Math.min(1, r.t / r.seconds);
      r.group.position.lerpVectors(r.a, r.b, f);
      r.label.position.x = r.group.position.x;
      r.label.position.z = r.group.position.z;
      const fade = Math.min(1, f * 8, (1 - f) * 8);
      (r.label.material as THREE.SpriteMaterial).opacity = fade;
    }
    this.runs = this.runs.filter((r) => {
      if (r.t < r.seconds) return true;
      this.remove(r);
      return false;
    });
  }

  dispose() {
    this.runs.forEach((r) => this.remove(r));
    this.runs = [];
  }

  private remove(r: Run) {
    this.scene.remove(r.group, r.label);
    const m = r.label.material as THREE.SpriteMaterial;
    m.map?.dispose();
    m.dispose();
  }
}
