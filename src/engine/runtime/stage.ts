import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraMode, LayerKey, Zone } from '../../core/types';
import { SceneManager, composeCollision, type SceneEntry } from '../SceneManager';
import { kOf } from './shared';

/** What every part of the engine shares: the renderer, scene, camera and controls, the scenes on screen, the camera mode and the plan look. It has no behaviour beyond a few derived values. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  manager!: SceneManager;
  /** the scenes on screen now, and the key of that combination */
  active: SceneEntry[] = [];
  activeKey = '';
  collide = composeCollision(() => this.active.map((e) => e.scene.world));
  /** the plan (2D) look is on */
  plan = false;
  mode: CameraMode = 'orbit';
  /** a lens change between the 3D view and the plan view that is under way */
  fovAnim: { f0: number; f1: number; F0: number; F1: number } | null = null;
  layerGroups: Record<LayerKey, THREE.Object3D[]> = {
    robots: [],
    routes: [],
    stations: [],
    zones: [],
    labels: [],
    equipment: [],
    alerts: [],
  };
  /** Touch support */
  readonly coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  constructor(readonly holder: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.coarse ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    holder.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.3, 3000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.12, // 0.08 made the view keep gliding after the fingers stopped, which felt slow to settle
      zoomSpeed: 1.8, // wheel, trackpad pinch and touch pinch all use it (the default 1 felt slow on a laptop trackpad)
      maxPolarAngle: Math.PI / 2.05,
      minDistance: 6,
      maxDistance: 700,
      screenSpacePanning: true,
      zoomToCursor: true,
      mouseButtons: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN },
      touches: { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN },
    }); // touch: 1 finger orbits, 2 fingers pinch-zoom + pan (twist rotates, see onTouchGesture)   // like DCC tools: MMB-drag pans, LMB orbits, wheel zooms

    this.scene.background = new THREE.Color(0xe6ebe9);
    this.scene.fog = new THREE.Fog(0xe6ebe9, 500, 1500);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8ea39c, 2.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.coarse ? 1024 : 2048, this.coarse ? 1024 : 2048);
    Object.assign(this.sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target);
  }
  /** How much further away the camera is than in the 3D view (1 in 3D, about 8 in the plan view). Every distance that decides what is shown (labels, dots) is divided by it. */
  get k() {
    return kOf(this.camera.fov);
  }
  /** The `k` the view will have when the lens change in progress is over: distances for camera moves are worked out with it. */
  get kTarget() {
    return kOf(this.fovAnim ? this.fovAnim.f1 : this.camera.fov);
  }
  get zones(): Zone[] {
    return this.active.flatMap((e) => e.source.site.zones);
  }
  dist(p: THREE.Vector3) {
    return this.camera.position.distanceTo(p) / this.k;
  }
  stationPos(id: string): THREE.Vector3 | undefined {
    for (const e of this.active) {
      const p = e.scene.rules.stationPos.get(id);
      if (p) return p;
    }
    return undefined;
  }
  robotObjects(): THREE.Object3D[] {
    return this.active.flatMap((e) => e.robots.children).filter((c) => c.visible);
  }
  pose() {
    return { pos: this.camera.position.clone(), target: this.controls.target.clone() };
  }
}
