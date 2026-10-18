import * as THREE from 'three';
import { store } from '../../core/store';
import { toScene, fromScene } from '../../core/coords';
import type { CameraMode, Zone } from '../../core/types';
import { EYE, FOV_3D, FOV_PLAN } from './shared';
import type { Layers } from './layers';
import type { RobotLayer } from './robotLayer';
import type { Stage } from './stage';

/** The camera: modes (orbit, plan, walk, follow), flights, the lens change between 3D and plan, and the "focus on" moves. */
export class CameraRig {
  /** a camera flight in progress */
  fly: {
    t: number;
    dur: number;
    p0: THREE.Vector3;
    p1: THREE.Vector3;
    t0: THREE.Vector3;
    t1: THREE.Vector3;
  } | null = null;
  keys = new Set<string>();
  walk = { x: 0, y: 0, yaw: 0, pitch: 0 };
  homePos = new THREE.Vector3();
  homeTarget = new THREE.Vector3();
  /** virtual-stick input for walk mode, each -1..1 */
  touchMove = { f: 0, s: 0 };
  lookPrev = new Map<number, { x: number; y: number }>();
  constructor(
    private readonly s: Stage,
    private readonly robots: RobotLayer,
    private readonly layers: Layers,
  ) {}
  /** A stand-in zone covering what is on screen (walk mode needs a place to start when a map has no active zone). */
  frameZone(): Zone {
    const f = this.s.active[0]?.scene.frame ?? { cx: 0, cy: 0, W: 10, D: 10 };
    return {
      id: 'frame',
      name: '',
      kind: 'area',
      active: true,
      color: '#999999',
      polygon: [
        [f.cx - f.W / 2, f.cy - f.D / 2],
        [f.cx + f.W / 2, f.cy - f.D / 2],
        [f.cx + f.W / 2, f.cy + f.D / 2],
        [f.cx - f.W / 2, f.cy + f.D / 2],
      ],
    };
  }
  /** Home view of what is on screen: the union of the scenes' buildings. Snaps there (a scene change is a reload, not a flight) unless this combination was seen before. */
  frameActive() {
    if (!this.s.active.length) return;
    const fr = this.s.active.map((e) => e.scene.frame);
    const x0 = Math.min(...fr.map((f) => f.cx - f.W / 2)),
      x1 = Math.max(...fr.map((f) => f.cx + f.W / 2)),
      y0 = Math.min(...fr.map((f) => f.cy - f.D / 2)),
      y1 = Math.max(...fr.map((f) => f.cy + f.D / 2));
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2,
      W = x1 - x0,
      D = y1 - y0;
    const asp = Math.max(0.3, this.s.holder.clientWidth / Math.max(1, this.s.holder.clientHeight));
    const dist = Math.max(W, D) * 1.15 * (asp < 1 ? Math.pow(1 / asp, 0.7) : 1);
    this.homeTarget.set(...toScene(cx, cy, 0));
    this.homePos.set(cx - dist * 0.35, dist * 0.8, -(cy - dist * 0.75));
    const seen = this.s.manager.recall(this.s.activeKey);
    this.s.camera.position.copy(seen?.pos ?? this.homePos);
    this.s.controls.target.copy(seen?.target ?? this.homeTarget);
    this.fly = null;
    this.s.controls.update();
  }
  // ---------------------------------------------------------------- camera
  setMode(m: CameraMode) {
    const prev = this.s.mode;
    this.s.mode = m;
    if (prev === 'walk' && m !== 'walk') {
      this.touchMove = { f: 0, s: 0 };
      this.lookPrev.clear();
      if (document.pointerLockElement) document.exitPointerLock();
      this.syncTargetFromCamera();
    }
    this.layers.setPlanLook(m === 'top');
    // the plan view is the same scene seen through a very narrow lens: the lens change is animated together with the camera flight so the picture stays the same size
    const wantFov = m === 'top' ? FOV_PLAN : FOV_3D;
    this.s.fovAnim = null;
    if (this.s.camera.fov !== wantFov) {
      if (m === 'top' || (m === 'orbit' && prev === 'top'))
        this.s.fovAnim = (() => {
          const F =
            this.s.camera.position.distanceTo(this.s.controls.target) *
            Math.tan(THREE.MathUtils.degToRad(this.s.camera.fov / 2));
          return { f0: this.s.camera.fov, f1: wantFov, F0: F, F1: F };
        })();
      else {
        this.s.camera.fov = wantFov;
        this.s.camera.updateProjectionMatrix();
      }
    }
    const c = this.s.controls;
    c.enabled = m === 'orbit' || m === 'top';
    // in the 2D plan a drag (mouse or one finger) pans; it never spins the view (3D orbits)
    c.mouseButtons.LEFT = m === 'top' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    c.touches.ONE = m === 'top' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    c.maxPolarAngle = m === 'top' ? 0.0001 : Math.PI / 2.05;
    c.minPolarAngle = m === 'top' ? 0 : 0.05;
    if (m === 'top') {
      const t = c.target.clone();
      this.flyTo(new THREE.Vector3(t.x, Math.max(this.s.dist(t), 60) * this.s.kTarget, t.z + 0.001), t);
    }
    if (m === 'walk') this.enterWalk();
    if (m === 'orbit' && prev === 'top') {
      const t = c.target.clone();
      const d = this.s.dist(t);
      this.flyTo(new THREE.Vector3(t.x - d * 0.3, d * 0.8, t.z + d * 0.55), t);
    }
  }
  /** Walk mode moves the camera directly, so the orbit target is stale. Re-aim it along the current view direction so leaving walk mode keeps the picture exactly as it was. */
  syncTargetFromCamera() {
    const dir = new THREE.Vector3();
    this.s.camera.getWorldDirection(dir);
    const pos = this.s.camera.position;
    let d = dir.y < -0.05 ? -pos.y / dir.y : 25; // aim at the floor when looking down, otherwise 25 m ahead
    d = THREE.MathUtils.clamp(d, this.s.controls.minDistance + 1, 60);
    this.s.controls.target.copy(pos).addScaledVector(dir, d);
    if (this.s.controls.target.y < 0) this.s.controls.target.y = 0;
    this.fly = null;
    this.s.controls.update();
  }
  enterWalk() {
    const t = this.s.controls.target;
    const zone =
      this.s.zones.find((z) => z.id === store.getState().activeZoneId) ??
      this.s.zones.find((z) => z.active) ??
      this.frameZone();
    const p = fromScene(t.x, 0, t.z);
    let sx = p.x,
      sy = p.y;
    if (!(
      sx >= zone.polygon[0][0] &&
      sx <= zone.polygon[2][0] &&
      sy >= zone.polygon[0][1] &&
      sy <= zone.polygon[2][1]
    )) {
      sx = (zone.polygon[0][0] + zone.polygon[2][0]) / 2;
      sy = (zone.polygon[0][1] + zone.polygon[2][1]) / 2;
    }
    for (let r = 0; r < 20 && this.s.collide.hits(sx, sy, 0.4); r += 1) {
      sx += 1;
    }
    this.walk = { x: sx, y: sy, yaw: 0, pitch: 0 };
    this.s.camera.position.set(...toScene(sx, sy, EYE));
    this.applyWalkLook();
    if (!this.s.coarse) Promise.resolve(this.s.renderer.domElement.requestPointerLock?.()).catch(() => {}); // touch devices look by dragging instead
  }
  applyWalkLook() {
    this.s.camera.rotation.set(this.walk.pitch, this.walk.yaw, 0, 'YXZ');
  }
  onLock = () => {
    if (!document.pointerLockElement && this.s.mode === 'walk') store.getState().setCameraMode('orbit');
  };
  onLook = (e: MouseEvent) => {
    if (this.s.mode !== 'walk' || !document.pointerLockElement) return;
    this.walk.yaw -= e.movementX * 0.0022;
    this.walk.pitch = Math.max(-1.2, Math.min(1.2, this.walk.pitch - e.movementY * 0.0022));
    this.applyWalkLook();
  };
  onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.type === 'keydown') this.keys.add(e.code);
    else this.keys.delete(e.code);
    if (e.code === 'Escape' && this.s.mode === 'follow') store.getState().setCameraMode('orbit');
  };
  flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur = 1) {
    if (this.s.fovAnim)
      this.s.fovAnim.F1 = (pos.distanceTo(target) / this.s.kTarget) * Math.tan(THREE.MathUtils.degToRad(FOV_3D / 2));
    this.fly = {
      t: 0,
      dur,
      p0: this.s.camera.position.clone(),
      p1: pos,
      t0: this.s.controls.target.clone(),
      t1: target,
    };
  }
  home() {
    store.getState().setZone(null);
    store.getState().select(null);
    store.getState().setCameraMode('orbit');
    this.flyTo(this.homePos.clone(), this.homeTarget.clone());
  }
  zoomBy(f: number) {
    const o = this.s.camera.position.clone().sub(this.s.controls.target).multiplyScalar(f);
    const L = THREE.MathUtils.clamp(o.length(), this.s.controls.minDistance, this.s.controls.maxDistance);
    this.s.camera.position.copy(this.s.controls.target).add(o.setLength(L));
  }
  focusZone(id: string) {
    const z = this.s.zones.find((q) => q.id === id);
    if (!z) return;
    store.getState().setZone(id);
    if (this.s.mode === 'walk' || this.s.mode === 'follow') store.getState().setCameraMode('orbit');
    const cx = (z.polygon[0][0] + z.polygon[2][0]) / 2,
      cy = (z.polygon[0][1] + z.polygon[2][1]) / 2,
      w = z.polygon[2][0] - z.polygon[0][0],
      d = z.polygon[2][1] - z.polygon[0][1];
    const dist = Math.max(w, d) * 1.5;
    const tgt = new THREE.Vector3(...toScene(cx, cy, 0));
    this.flyTo(
      this.s.mode === 'top'
        ? new THREE.Vector3(tgt.x, dist * 1.1 * this.s.kTarget, tgt.z + 0.001)
        : new THREE.Vector3(tgt.x - dist * 0.3, dist * 0.85, tgt.z + dist * 0.65),
      tgt,
    );
  }
  flyToSite(x: number, y: number) {
    const t = new THREE.Vector3(...toScene(x, y, 0));
    const d = Math.max(30, this.s.dist(this.s.controls.target) * 0.6);
    this.flyTo(
      this.s.mode === 'top'
        ? new THREE.Vector3(t.x, d * this.s.kTarget, t.z + 0.001)
        : new THREE.Vector3(t.x - d * 0.3, d * 0.8, t.z + d * 0.55),
      t,
    );
  }
  focusStation(id: string) {
    const p = this.s.stationPos(id);
    if (!p) return;
    const d = 16;
    this.flyTo(
      this.s.mode === 'top'
        ? new THREE.Vector3(p.x, 30 * this.s.kTarget, p.z + 0.001)
        : new THREE.Vector3(p.x - d * 0.4, d * 0.9, p.z + d * 0.8),
      p.clone(),
      0.9,
    );
  }
  focusRobot(id: string) {
    const r = this.robots.robots.get(id);
    if (!r) {
      this.robots.pendingFocus = { id, until: performance.now() + 20_000 };
      return;
    }
    this.robots.pendingFocus = null;
    store.getState().select(id);
    const p = r.group.position.clone();
    this.flyTo(
      this.s.mode === 'top'
        ? new THREE.Vector3(p.x, 22 * this.s.kTarget, p.z + 0.001)
        : new THREE.Vector3(p.x - 14, 16, p.z + 14),
      p,
      0.9,
    );
  }
  /** Lens change between the 3D and the plan view: the camera sits at the distance that keeps the same picture size, so the view zooms out of perspective instead of jumping. */
  stepLens() {
    const a = this.s.fovAnim;
    if (a) {
      const done = !this.fly;
      const t = done ? 1 : Math.min(1, this.fly!.t);
      const k = 1 - Math.pow(1 - t, 3);
      const fov = a.f0 + (a.f1 - a.f0) * k;
      const dir = this.s.camera.position.clone().sub(this.s.controls.target);
      if (dir.lengthSq() < 1e-9) dir.set(0, 1, 0);
      dir.normalize();
      const F = a.F0 + (a.F1 - a.F0) * k;
      this.s.camera.fov = fov;
      this.s.camera.position
        .copy(this.s.controls.target)
        .addScaledVector(dir, F / Math.tan(THREE.MathUtils.degToRad(fov / 2)));
      if (done) this.s.fovAnim = null;
    }
    const k = this.s.k;
    const c = this.s.controls;
    c.minDistance = 6 * k;
    c.maxDistance = 700 * k;
    this.s.camera.near = 0.3 * k;
    this.s.camera.far = 3000 * k;
    this.s.camera.updateProjectionMatrix();
  }
  stepWalk(dt: number) {
    const mag = Math.hypot(this.touchMove.f, this.touchMove.s);
    const sp = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || mag > 0.9 ? 6 : 2.6) * dt;
    const fw = Math.max(
      -1,
      Math.min(
        1,
        (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
          (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) +
          this.touchMove.f,
      ),
    );
    const st = Math.max(
      -1,
      Math.min(1, (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.touchMove.s),
    );
    this.walk.yaw -= ((this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0)) * dt * 1.6;
    // camera looks along three (-sin yaw, 0, -cos yaw) => site forward (x = -sin yaw, y = cos yaw)
    const fX = -Math.sin(this.walk.yaw),
      fY = Math.cos(this.walk.yaw);
    const dx = (fX * fw + fY * st) * sp,
      dy = (fY * fw - fX * st) * sp;
    if (dx || dy) {
      const [nx, ny] = this.s.collide.move(this.walk.x, this.walk.y, dx, dy, 0.4);
      this.walk.x = nx;
      this.walk.y = ny;
    }
    this.s.camera.position.set(...toScene(this.walk.x, this.walk.y, EYE));
    this.applyWalkLook();
  }
  stepFollow(dt: number) {
    const id = store.getState().selectedId;
    const r = id ? this.robots.robots.get(id) : null;
    if (!r) return;
    const p = r.group.position;
    const back = new THREE.Vector3(-Math.cos(r.group.rotation.y) * 9, 6, Math.sin(r.group.rotation.y) * 9);
    this.s.camera.position.lerp(p.clone().add(back), 1 - Math.exp(-dt * 3));
    this.s.controls.target.lerp(p, 1 - Math.exp(-dt * 6));
    this.s.camera.lookAt(this.s.controls.target);
  }
  /** Virtual stick (UI) -> walk movement. f = forward, s = strafe right, both -1..1. */
  setWalkInput(f: number, s: number) {
    this.touchMove.f = f;
    this.touchMove.s = s;
  }
  /** Per frame: the flight in progress, the lens change, then walking, following or the orbit controls; the sun follows what is looked at. */
  update(dt: number) {
    // fly
    if (this.fly) {
      this.fly.t += dt / this.fly.dur;
      const k = this.fly.t >= 1 ? 1 : 1 - Math.pow(1 - this.fly.t, 3);
      this.s.camera.position.lerpVectors(this.fly.p0, this.fly.p1, k);
      this.s.controls.target.lerpVectors(this.fly.t0, this.fly.t1, k);
      if (this.fly.t >= 1) this.fly = null;
    }
    this.stepLens();
    if (this.s.mode === 'walk') this.stepWalk(dt);
    else if (this.s.mode === 'follow') this.stepFollow(dt);
    else {
      this.s.controls.update();
      // screen-space panning must not sink under the floor: lift camera and target together so the pan stays a pure translation
      const lift = Math.max(0, 1 - this.s.camera.position.y, -this.s.controls.target.y);
      if (lift > 0) {
        this.s.camera.position.y += lift;
        this.s.controls.target.y += lift;
      }
    }
    // sun follows target so shadows stay sharp near the viewer
    const T = this.s.mode === 'walk' ? this.s.camera.position : this.s.controls.target;
    this.s.sun.target.position.set(T.x, 0, T.z);
    this.s.sun.position.set(T.x + 40, 90, T.z + 30);
  }
}
