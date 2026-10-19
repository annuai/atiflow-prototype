import * as THREE from 'three';
import { fromScene, toScene } from '../core/coords';
import { store } from '../core/store';
import type { NavGraph, RobotTelemetry, SiteLayout } from '../core/types';
import { SceneManager, type SceneSource } from './SceneManager';
import { renderScene } from './SceneRenderer';
import { CameraRig } from './runtime/cameraRig';
import { Layers } from './runtime/layers';
import { Pointer } from './runtime/pointer';
import { RobotLayer } from './runtime/robotLayer';
import { Stage } from './runtime/stage';

/** The 3D engine of the Live Floor and the 3D map page: the renderer loop on top of the parts in `runtime/` (stage, robots, layers, camera, pointer). Pages talk only to this class. */
export class Engine {
  private readonly s: Stage;
  private readonly robots: RobotLayer;
  private readonly layers: Layers;
  private readonly rig: CameraRig;
  private readonly pointer: Pointer;
  private clock = new THREE.Clock();
  private raf = 0;
  private unsub: (() => void)[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private lastView = 0;
  private inset = 0;
  onView: (v: { x: number; y: number; yaw: number; dist: number; zoomPct: number }) => void = () => {};

  constructor(private holder: HTMLElement) {
    this.s = new Stage(holder);
    this.robots = new RobotLayer(this.s);
    this.layers = new Layers(this.s, this.robots);
    this.rig = new CameraRig(this.s, this.robots, this.layers);
    this.robots.rig = this.rig;
    this.pointer = new Pointer(this.s, this.robots, this.layers, this.rig);
    this.s.manager = new SceneManager({
      capacity: 3,
      parent: this.s.scene,
      build: (src) => renderScene(src.site, src.nav, { plan: this.s.plan }),
      onEvict: (e) => this.robots.parkRobotsOf(e),
    });
    const el = this.s.renderer.domElement;
    el.addEventListener('pointermove', this.pointer.onMove);
    el.addEventListener('pointerdown', (e) => {
      this.pointer.downAt = { x: e.clientX, y: e.clientY };
      this.pointer.ptrType = e.pointerType;
    });
    // middle button: no browser auto-scroll, grab cursor while dragging
    el.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault();
    });
    el.addEventListener('auxclick', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (e.button === 1) el.style.cursor = 'grabbing';
    });
    const endMmb = (e: PointerEvent) => {
      if (e.button === 1) el.style.cursor = 'grab';
    };
    el.addEventListener('pointerup', endMmb);
    el.addEventListener('pointercancel', endMmb);
    el.addEventListener('pointerdown', this.pointer.onTouchDown);
    el.addEventListener('pointermove', this.pointer.onTouchMove);
    el.addEventListener('pointerup', this.pointer.onTouchEnd);
    el.addEventListener('pointercancel', this.pointer.onTouchEnd);
    el.addEventListener('dblclick', (e) => {
      if (this.pointer.ptrType !== 'touch' && e.button === 0) this.pointer.doubleTap(e.clientX, e.clientY);
    }); // desktop double-click = same zoom-to-point
    el.addEventListener('contextmenu', (e) => e.preventDefault()); // long-press must not open the browser menu
    el.addEventListener('pointerup', this.pointer.onUp);
    window.addEventListener('keydown', this.rig.onKey);
    window.addEventListener('keyup', this.rig.onKey);
    document.addEventListener('pointerlockchange', this.rig.onLock);
    document.addEventListener('mousemove', this.rig.onLook);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(holder);
    this.resize();
    this.unsub.push(
      store.subscribe((s, p) => {
        if (s.cameraMode !== p.cameraMode) this.rig.setMode(s.cameraMode);
        if (s.layers !== p.layers) this.layers.applyLayers();
        if (s.selectedId !== p.selectedId) {
          this.robots.onSelect();
          if (!s.selectedId && this.s.mode === 'follow') store.getState().setCameraMode('orbit');
        } // nothing left to follow
        if (s.traffic !== p.traffic) this.s.manager.loaded().forEach((e) => e.scene.rules.setTraffic(s.traffic));
        if (s.selectedStationId !== p.selectedStationId) {
          this.s.manager.loaded().forEach((e) => e.scene.rules.setSelected(s.selectedStationId));
          if (s.selectedStationId) this.rig.focusStation(s.selectedStationId);
        }
        if (s.fleetId !== p.fleetId) this.s.manager.loaded().forEach((e) => e.scene.rules.setFleet(s.fleetId));
        if (s.activeZoneId !== p.activeZoneId) this.layers.refreshZones();
      }),
    );

    if (import.meta.env.DEV) Object.assign(window, { __engine: this, __store: store }); // dev-only debug handles
    this.loop();
  }
  // the parts of the engine a page may touch
  get scene() {
    return this.s.scene;
  }
  get camera() {
    return this.s.camera;
  }
  get renderer() {
    return this.s.renderer;
  }
  get coarse() {
    return this.s.coarse;
  }
  updateRobots(batch: RobotTelemetry[]) {
    this.robots.updateRobots(batch);
  }
  clearRobots() {
    this.robots.clearRobots();
  }
  applyFilter(fleetId: string, query: string) {
    this.robots.applyFilter(fleetId, query);
  }
  flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur = 1) {
    this.rig.flyTo(pos, target, dur);
  }
  /** Fly to look at a patch of the floor: centred on (x, y) in site metres, `width` metres wide on screen, from the south and above. */
  lookAtSite(x: number, y: number, width: number, dur = 0.6) {
    const t = new THREE.Vector3(...toScene(x, y, 0));
    const d =
      width / 2 / (Math.tan(THREE.MathUtils.degToRad(this.s.camera.fov / 2)) * Math.max(0.5, this.s.camera.aspect));
    const tilt = THREE.MathUtils.degToRad(55);
    this.rig.flyTo(new THREE.Vector3(t.x, d * Math.sin(tilt), t.z + d * Math.cos(tilt)), t, dur);
  }
  home() {
    this.rig.home();
  }
  zoomBy(f: number) {
    this.rig.zoomBy(f);
  }
  focusZone(id: string) {
    this.rig.focusZone(id);
  }
  flyToSite(x: number, y: number) {
    this.rig.flyToSite(x, y);
  }
  focusStation(id: string) {
    this.rig.focusStation(id);
  }
  focusRobot(id: string) {
    this.rig.focusRobot(id);
  }
  /** Virtual stick (UI) -> walk movement. f = forward, s = strafe right, both -1..1. */
  setWalkInput(f: number, s: number) {
    this.rig.setWalkInput(f, s);
  }
  // ---------------------------------------------------------------- scene
  /** A single scene with no fleet of its own (the 3D map page): everything under one catch-all scene. */
  load(site: SiteLayout, nav: NavGraph) {
    this.setScenes([{ key: 'single', site, nav, fleets: [] }], ['single']);
  }
  private refreshes = 0;
  /** The scene on screen is replaced by a changed one (the 3D editor, after every edit) and the camera stays where it was. */
  refreshScene(site: SiteLayout, nav: NavGraph) {
    const was = this.s.active.length ? this.s.pose() : null;
    const key = `single-${++this.refreshes}`;
    this.setScenes([{ key, site, nav, fleets: [] }], [key]);
    if (was) {
      this.s.camera.position.copy(was.pos);
      this.s.controls.target.copy(was.target);
      this.s.controls.update();
    }
  }
  /**
   * Shows these scenes (each one loaded the first time it is shown and then kept, up to the budget) and hides every other: the scene is the unit, so a fleet on another map is a different
   * scene, not a filter on this one. Robots follow their fleet's scene; the camera goes back to where it was in this combination of scenes, or frames them.
   */
  setScenes(sources: SceneSource[], show: string[]) {
    if (this.s.active.length) this.s.manager.remember(this.s.activeKey, this.s.pose());
    const want = sources.filter((src) => show.includes(src.key));
    // the same scenes asked for again (the page does it whenever it becomes ready or its fleet is confirmed): nothing is reloaded, so the camera is left alone and a flight that is
    // already under way (Locate on map) is not cancelled by a reframe
    const unchanged = this.s.active.length > 0 && SceneManager.setKey(want.map((src) => src.key)) === this.s.activeKey;
    want.forEach((src) => this.s.manager.ensure(src));
    this.s.active = this.s.manager.show(want.map((src) => src.key));
    this.s.activeKey = SceneManager.setKey(want.map((src) => src.key));
    const st = store.getState();
    for (const e of this.s.manager.loaded()) {
      e.scene.rules.setTraffic(st.traffic);
      e.scene.rules.setFleet(st.fleetId);
      e.scene.rules.setSelected(st.selectedStationId);
    }
    this.robots.reattachRobots();
    // nothing stays selected that is not in a scene on screen
    if (st.selectedId && !this.s.robotObjects().some((o) => o.userData.robotId === st.selectedId)) st.select(null);
    if (st.selectedStationId && !this.s.stationPos(st.selectedStationId)) st.selectStation(null);
    if (st.activeZoneId && !this.s.zones.some((z) => z.id === st.activeZoneId)) st.setZone(null);
    if (!unchanged) this.rig.frameActive();
    this.layers.applyLayers();
    this.layers.refreshZones();
  }

  private resize() {
    const w = this.holder.clientWidth,
      h = this.holder.clientHeight;
    if (!w || !h) return;
    this.s.renderer.setSize(w, h);
    this.s.camera.aspect = w / h;
    this.applyInset(w, h);
  }
  setInset(px: number) {
    this.inset = px;
    this.resize();
  }
  private applyInset(w: number, h: number) {
    if (this.inset) this.s.camera.setViewOffset(w, h, -this.inset / 2, 0, w, h);
    else this.s.camera.clearViewOffset();
    this.s.camera.updateProjectionMatrix();
  }
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05),
      time = this.clock.elapsedTime;
    if (!this.s.active.length) {
      this.s.renderer.render(this.s.scene, this.s.camera);
      return;
    }
    this.robots.animate(time);
    this.robots.updateSelectedPath();
    // labels: zone labels fade when close, station labels when far
    const cd = this.s.dist(this.s.controls.target);
    this.s.active
      .flatMap((e) => e.scene.zoneLabels)
      .forEach((l) => {
        l.material.opacity = THREE.MathUtils.clamp((cd - 110) / 60, 0, 1);
      });
    this.s.active.forEach((e) => e.scene.rules.tick(time, this.s.camera, this.s.k));
    this.robots.updateIncoming();
    this.rig.update(dt);
    this.s.renderer.render(this.s.scene, this.s.camera);
    if (time - this.lastView > 0.15) {
      this.lastView = time;
      const p = this.s.mode === 'walk' ? this.s.camera.position : this.s.controls.target;
      const f = fromScene(this.s.camera.position.x, 0, this.s.camera.position.z);
      const v = fromScene(p.x, 0, p.z);
      const dir = new THREE.Vector3();
      this.s.camera.getWorldDirection(dir);
      this.onView({
        x: this.s.mode === 'walk' ? f.x : v.x,
        y: this.s.mode === 'walk' ? f.y : v.y,
        yaw: Math.atan2(-dir.z, dir.x),
        dist: cd,
        zoomPct: this.s.mode === 'walk' ? 100 : Math.round((100 * 120) / Math.max(cd, 1)),
      });
    }
  };
  screenshot() {
    return this.s.renderer.domElement.toDataURL('image/png');
  }
  dispose() {
    cancelAnimationFrame(this.raf);
    this.s.manager.dispose();
    this.s.active = [];
    this.unsub.forEach((u) => u());
    // listeners on the window and the document outlive the page: left in place they keep this whole Engine (scene, renderer, models) alive after every visit
    window.removeEventListener('keydown', this.rig.onKey);
    window.removeEventListener('keyup', this.rig.onKey);
    document.removeEventListener('pointerlockchange', this.rig.onLock);
    document.removeEventListener('mousemove', this.rig.onLook);
    this.resizeObserver?.disconnect();
    // OrbitControls puts a keydown listener on the canvas's root node (the document) and takes it off through the same call: once the page has already
    // removed the canvas, that root is the detached canvas itself and the document keeps the listener (and this Engine) for good, so put the canvas back first
    const canvas = this.s.renderer.domElement;
    if (!canvas.isConnected) document.body.appendChild(canvas);
    this.s.controls.dispose();
    this.s.renderer.dispose();
    this.s.renderer.forceContextLoss(); // the browser allows only a handful of live WebGL contexts
    this.s.renderer.domElement.remove();
  }
}
