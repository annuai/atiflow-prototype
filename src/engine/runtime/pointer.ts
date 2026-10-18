import * as THREE from 'three';
import { store } from '../../core/store';
import { fromScene } from '../../core/coords';
import type { CameraRig } from './cameraRig';
import type { Layers } from './layers';
import type { RobotLayer } from './robotLayer';
import type { Stage } from './stage';

/** Picking and touch: hover, select, double-tap, two-finger twist and the walk-mode look drag. */
export class Pointer {
  private ray = new THREE.Raycaster();
  private ptr = new THREE.Vector2();
  downAt = { x: 0, y: 0 };
  ptrType = 'mouse';
  private touchPts = new Map<number, { x: number; y: number }>();
  private twistPrev: number | null = null;
  private lastTap = { t: 0, x: 0, y: 0 };
  constructor(
    private readonly s: Stage,
    private readonly robots: RobotLayer,
    private readonly layers: Layers,
    private readonly rig: CameraRig,
  ) {}
  // ---------------------------------------------------------------- input
  pick(e: PointerEvent) {
    const b = this.s.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.s.camera);
    const hits = this.ray.intersectObjects(this.s.robotObjects(), true);
    const rh = hits.find((h) => h.object.userData.robotId || h.object.parent?.userData.robotId);
    let rid: string | null = null;
    if (rh) {
      let o: THREE.Object3D | null = rh.object;
      while (o && !o.userData.robotId) o = o.parent;
      rid = o?.userData.robotId ?? null;
    }
    const pt = new THREE.Vector3();
    let zone: string | null = null;
    if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) {
      const p = fromScene(pt.x, 0, pt.z);
      zone =
        this.s.zones.find(
          (z) =>
            z.active &&
            p.x >= z.polygon[0][0] &&
            p.x <= z.polygon[2][0] &&
            p.y >= z.polygon[0][1] &&
            p.y <= z.polygon[2][1],
        )?.id ?? null;
    }
    const sid = rid ? null : (this.s.active.map((e) => e.scene.rules.pick(this.ray)).find(Boolean) ?? null);
    return { rid, zone, sid };
  }
  onMove = (e: PointerEvent) => {
    if (!this.s.active.length || this.s.mode === 'walk' || e.pointerType === 'touch') return;
    const { rid, zone, sid } = this.pick(e); // no hover on touch
    this.s.renderer.domElement.style.cursor = rid || sid || zone ? 'pointer' : 'grab';
    if (zone !== this.layers.hoverZone) {
      this.layers.hoverZone = zone;
      this.layers.refreshZones();
    }
  };
  onUp = (e: PointerEvent) => {
    if (e.button !== 0) return; // only the primary button selects; MMB/RMB are camera drags
    const touch = e.pointerType === 'touch';
    if (
      !this.s.active.length ||
      this.s.mode === 'walk' ||
      this.twistPrev !== null ||
      Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > (touch ? 10 : 5)
    )
      return; // fingers wobble more than a mouse
    if (touch) {
      const now = performance.now();
      const dbl = now - this.lastTap.t < 320 && Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 30;
      this.lastTap = { t: dbl ? 0 : now, x: e.clientX, y: e.clientY };
      if (dbl) {
        this.doubleTap(e.clientX, e.clientY);
        return;
      }
    }
    const { rid, zone, sid } = this.pick(e);
    const s = store.getState();
    if (rid) {
      s.select(rid);
      return;
    }
    if (sid) {
      s.selectStation(sid);
      return;
    }
    s.select(null);
    s.selectStation(null);
    if (zone) this.rig.focusZone(zone);
    else if (s.activeZoneId) this.rig.home();
  };
  // ---------------------------------------------------------------- touch
  onTouchDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    this.touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touchPts.size === 2) this.twistPrev = this.twistAngle();
    if (this.s.mode === 'walk') this.rig.lookPrev.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  onTouchMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !this.touchPts.has(e.pointerId)) return;
    this.touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.s.mode === 'walk') {
      // one-finger drag looks around (no pointer lock on touch)
      const p = this.rig.lookPrev.get(e.pointerId);
      if (p) {
        this.rig.walk.yaw -= (e.clientX - p.x) * 0.0055;
        this.rig.walk.pitch = THREE.MathUtils.clamp(this.rig.walk.pitch - (e.clientY - p.y) * 0.0055, -1.2, 1.2);
        this.rig.applyWalkLook();
        this.rig.lookPrev.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      return;
    }
    if (this.touchPts.size === 2 && this.twistPrev !== null && this.s.mode === 'orbit') {
      // two-finger twist rotates the 3D view about the look-at point (the 2D plan never rotates)
      const a = this.twistAngle();
      let d = a - this.twistPrev;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      this.twistPrev = a;
      if (Math.abs(d) < 0.6) {
        const off = this.s.camera.position
          .clone()
          .sub(this.s.controls.target)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), d);
        this.s.camera.position.copy(this.s.controls.target).add(off);
      }
    }
  };
  onTouchEnd = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    this.touchPts.delete(e.pointerId);
    this.rig.lookPrev.delete(e.pointerId);
    if (this.touchPts.size < 2)
      setTimeout(() => {
        if (this.touchPts.size < 2) this.twistPrev = null;
      }, 0); // keep the flag through this pointerup so a gesture does not count as a tap
  };
  twistAngle() {
    const [a, b] = [...this.touchPts.values()];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
  /** Double-tap / double-click: zoom in on the tapped floor point; on a robot, locate it. */
  doubleTap(cx: number, cy: number) {
    if (!this.s.active.length || this.s.mode === 'walk' || this.s.mode === 'follow') return;
    const b = this.s.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.s.camera);
    const hits = this.ray.intersectObjects(this.s.robotObjects(), true);
    const rh = hits.find((h) => h.object.userData.robotId || h.object.parent?.userData.robotId);
    if (rh) {
      let o: THREE.Object3D | null = rh.object;
      while (o && !o.userData.robotId) o = o.parent;
      if (o) {
        this.rig.focusRobot(o.userData.robotId);
        return;
      }
    }
    const pt = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) return;
    const off = this.s.camera.position.clone().sub(this.s.controls.target);
    const d = Math.max(this.s.controls.minDistance + 2, off.length() * 0.5);
    this.rig.flyTo(pt.clone().add(off.setLength(d)), pt, 0.5);
  }
}
