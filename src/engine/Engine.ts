import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { store } from '../core/store';
import { toScene, fromScene } from '../core/coords';
import type { CameraMode, LayerKey, NavGraph, RobotTelemetry, SiteLayout, Zone } from '../core/types';
import { CollisionWorld } from './walk';
import { labelSprite, dotSprite } from './labels';
import type { RobotTypeId } from '../data/robotTypes';
import { ROBOT_MODELS, DEFAULT_MODEL, buildTrolley, robotPlanTexture } from './robotMesh';
import { RulesLayer, SHARED_COLOR } from './rulesLayer';
import { STATE_COLOR, STATE_PULSE } from './stateStyle';

const KIND_COLOR: Record<string, number> = { 'smt-machine': 0x7e9a94, equipment: 0x9aa9a5, workstation: 0xb4beba };
const MUTED = 0xcfd5d3;
const ROBOT_SCALE = 1;   // true size: the simulator keeps robots 1 m apart in neighbouring lanes, so anything larger would visibly overlap
const EYE = 1.7;
/** Plan (2D) view = the same scene seen with a very narrow field of view from far away: no perspective, so the plan is to scale everywhere. `kOf` is how many times further away the camera sits than in the 3D view for the same picture. */
const FOV_3D = 42, FOV_PLAN = 5;
const kOf = (fov: number) => Math.tan(THREE.MathUtils.degToRad(FOV_3D / 2)) / Math.tan(THREE.MathUtils.degToRad(fov / 2));

interface RobotVis { group: THREE.Group; light: THREE.Mesh; dot: THREE.Sprite; halo: THREE.Mesh; ring: THREE.Mesh; tgt: { x: number; y: number; th: number }; v: number; t?: RobotTelemetry; lightMat: THREE.MeshBasicMaterial;
  /** Smooth playback between telemetry ticks: from the pose shown when the tick arrived to the new pose, finished when the next tick is due. */
  from: { x: number; y: number; th: number }; tArr: number; dt: number;
  glyph: THREE.Group; glyphMat: THREE.MeshBasicMaterial; bodyMat: THREE.MeshBasicMaterial; inner: THREE.Group;
  trolley: THREE.Group | null; trolleyKey: string; trFrom: { x: number; y: number; th: number } | null; trTgt: { x: number; y: number; th: number } | null }
const lerpAngle = (a: number, b: number, k: number) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;

export class Engine {
  readonly renderer: THREE.WebGLRenderer; readonly scene = new THREE.Scene(); readonly camera: THREE.PerspectiveCamera;
  private controls: OrbitControls; private clock = new THREE.Clock(); private raf = 0;
  private site!: SiteLayout; private nav!: NavGraph; private world!: CollisionWorld;
  private robots = new Map<string, RobotVis>(); private robotRoot = new THREE.Group();
  private layerGroups: Record<LayerKey, THREE.Object3D[]> = { robots: [], routes: [], stations: [], zones: [], labels: [], equipment: [], alerts: [] };
  private zoneMeshes: { zone: Zone; mesh: THREE.Mesh; edge: THREE.LineLoop }[] = [];
  private zoneLabels: THREE.Sprite[] = []; private rules!: RulesLayer; private incoming = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xf59e0b }));
  private pathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x14b8a6 }));
  private hoverZone: string | null = null; private ray = new THREE.Raycaster(); private ptr = new THREE.Vector2();
  private fly: { t: number; dur: number; p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3 } | null = null;
  private mode: CameraMode = 'orbit'; private keys = new Set<string>(); private walk = { x: 0, y: 0, yaw: 0, pitch: 0 };
  private hemi!: THREE.HemisphereLight; private planLines: THREE.LineSegments | null = null; private plan = false; private fovAnim: { f0: number; f1: number; F0: number; F1: number } | null = null;
  private sun!: THREE.DirectionalLight; private unsub: (() => void)[] = []; private homePos = new THREE.Vector3(); private homeTarget = new THREE.Vector3();
  private lastView = 0; onView: (v: { x: number; y: number; yaw: number; dist: number; zoomPct: number }) => void = () => {};
  private downAt = { x: 0, y: 0 }; private ptrType = 'mouse';
  /** Touch support state */
  readonly coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  private touchPts = new Map<number, { x: number; y: number }>(); private twistPrev: number | null = null;
  private lastTap = { t: 0, x: 0, y: 0 }; private lookPrev = new Map<number, { x: number; y: number }>();
  private touchMove = { f: 0, s: 0 };                 // virtual-stick input for walk mode, each -1..1

  constructor(private holder: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.coarse ? 1.5 : 2)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    holder.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.3, 3000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: Math.PI / 2.05, minDistance: 6, maxDistance: 700, screenSpacePanning: true, zoomToCursor: true,
      mouseButtons: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN },
      touches: { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN } });   // touch: 1 finger orbits, 2 fingers pinch-zoom + pan (twist rotates, see onTouchGesture)   // like DCC tools: MMB-drag pans, LMB orbits, wheel zooms
    this.scene.background = new THREE.Color(0xe6ebe9); this.scene.fog = new THREE.Fog(0xe6ebe9, 500, 1500);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8ea39c, 2.1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2); this.sun.castShadow = true; this.sun.shadow.mapSize.set(this.coarse ? 1024 : 2048, this.coarse ? 1024 : 2048);
    Object.assign(this.sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 }); this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target, this.robotRoot);
    this.pathLine.visible = false; this.scene.add(this.pathLine); this.incoming.frustumCulled = false; this.incoming.visible = false; this.scene.add(this.incoming);
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onMove); el.addEventListener('pointerdown', (e) => { this.downAt = { x: e.clientX, y: e.clientY }; this.ptrType = e.pointerType; });
    // middle button: no browser auto-scroll, grab cursor while dragging
    el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); el.addEventListener('auxclick', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => { if (e.button === 1) el.style.cursor = 'grabbing'; });
    const endMmb = (e: PointerEvent) => { if (e.button === 1) el.style.cursor = 'grab'; }; el.addEventListener('pointerup', endMmb); el.addEventListener('pointercancel', endMmb);
    el.addEventListener('pointerdown', this.onTouchDown); el.addEventListener('pointermove', this.onTouchMove);
    el.addEventListener('pointerup', this.onTouchEnd); el.addEventListener('pointercancel', this.onTouchEnd);
    el.addEventListener('dblclick', (e) => { if (this.ptrType !== 'touch' && e.button === 0) this.doubleTap(e.clientX, e.clientY); });   // desktop double-click = same zoom-to-point
    el.addEventListener('contextmenu', (e) => e.preventDefault());                                   // long-press must not open the browser menu
    el.addEventListener('pointerup', this.onUp); window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey);
    document.addEventListener('pointerlockchange', this.onLock); document.addEventListener('mousemove', this.onLook);
    new ResizeObserver(() => this.resize()).observe(holder); this.resize();
    this.unsub.push(store.subscribe((s, p) => {
      if (s.cameraMode !== p.cameraMode) this.setMode(s.cameraMode);
      if (s.layers !== p.layers) this.applyLayers();
      if (s.selectedId !== p.selectedId) { this.onSelect(); if (!s.selectedId && this.mode === 'follow') store.getState().setCameraMode('orbit'); }   // nothing left to follow
      if (s.traffic !== p.traffic) this.rules?.setTraffic(s.traffic);
      if (s.selectedStationId !== p.selectedStationId) { this.rules?.setSelected(s.selectedStationId); if (s.selectedStationId) this.focusStation(s.selectedStationId); }
      if (s.fleetId !== p.fleetId) this.rules?.setFleet(s.fleetId);
      if (s.activeZoneId !== p.activeZoneId) this.refreshZones();
    }));
    if (import.meta.env.DEV) Object.assign(window, { __engine: this, __store: store }); // dev-only debug handles
    this.loop();
  }

  /** How much further away the camera is than in the 3D view (1 in 3D, about 8 in the plan view). Every distance that decides what is shown (labels, dots) is divided by it. */
  private get k() { return kOf(this.camera.fov); }
  /** The `k` the view will have when the lens change in progress is over: distances for camera moves are worked out with it. */
  private get kTarget() { return kOf(this.fovAnim ? this.fovAnim.f1 : this.camera.fov); }
  private dist(p: THREE.Vector3) { return this.camera.position.distanceTo(p) / this.k; }

  // ---------------------------------------------------------------- scene
  load(site: SiteLayout, nav: NavGraph) {
    this.site = site; this.nav = nav; this.world = new CollisionWorld(site);
    const B = site.bounds; const cx = (B.minX + B.maxX) / 2, cy = (B.minY + B.maxY) / 2, W = B.maxX - B.minX, D = B.maxY - B.minY;
    const inActive = (x: number, y: number) => site.zones.some((z) => z.active && x >= z.polygon[0][0] && x <= z.polygon[2][0] && y >= z.polygon[0][1] && y <= z.polygon[2][1]);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0xe6ebe9, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.05, -cy); ground.receiveShadow = true; this.scene.add(ground);
    for (const poly of site.floorPolygons) {
      const sh = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: 0xf7f9f8, roughness: 0.95 }));
      m.rotation.x = -Math.PI / 2; m.scale.set(1, 1, 1); m.position.y = 0; m.receiveShadow = true;
      // ShapeGeometry lies in XY; rotating about X maps y -> -z, which matches toScene.
      this.scene.add(m);
    }
    const grid = new THREE.GridHelper(Math.max(W, D) * 1.1, Math.round(Math.max(W, D) / 5), 0xd5dcda, 0xe3e8e6); grid.position.set(cx, 0.02, -cy); (grid.material as THREE.Material).opacity = 0.5; (grid.material as THREE.Material).transparent = true; this.scene.add(grid);

    // walls (instanced)
    const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), site.walls.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    site.walls.forEach((w, i) => {
      const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], L = Math.hypot(dx, dy), th = Math.max(w.t, 0.14);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dy, dx));
      m4.compose(new THREE.Vector3(...toScene((w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2, w.h / 2)), q, new THREE.Vector3(L + th, w.h, th));
      wallMesh.setMatrixAt(i, m4);
      const act = inActive((w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2);
      wallMesh.setColorAt(i, col.set(w.layer === 'shell' ? 0x9aa6a2 : act ? 0x44534e : MUTED));
    });
    wallMesh.castShadow = wallMesh.receiveShadow = true; this.scene.add(wallMesh);

    // equipment (instanced)
    const eq = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.7 }), site.equipment.length);
    site.equipment.forEach((e, i) => {
      m4.compose(new THREE.Vector3(...toScene(e.x, e.y, e.h / 2)), new THREE.Quaternion(), new THREE.Vector3(e.w, e.h, e.d)); eq.setMatrixAt(i, m4);
      eq.setColorAt(i, col.set(KIND_COLOR[e.kind] ?? 0x9aa9a5));
    });
    eq.castShadow = eq.receiveShadow = true; this.scene.add(eq); this.layerGroups.equipment.push(eq);
    // outlines of walls and machines, drawn only in the plan view (flat drawings need crisp edges, shading does not exist there)
    const lines: number[] = []; const edge = (a: [number, number], b: [number, number], z: number) => { lines.push(...toScene(a[0], a[1], z), ...toScene(b[0], b[1], z)); };
    const box = (cx: number, cy: number, w: number, d: number, th: number, z: number) => { const c = Math.cos(th), sn = Math.sin(th); const P = ([[-w, -d], [w, -d], [w, d], [-w, d]] as [number, number][]).map(([x, y]): [number, number] => [cx + (x * c - y * sn) / 2, cy + (x * sn + y * c) / 2]); for (let i = 0; i < 4; i++) edge(P[i], P[(i + 1) % 4], z); };
    site.equipment.forEach((e) => box(e.x, e.y, e.w, e.d, 0, e.h + 0.04)); site.walls.forEach((w) => { const th = Math.max(w.t, 0.14); box((w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2, Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) + th, th, Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]), w.h + 0.04); });
    this.planLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)), new THREE.LineBasicMaterial({ color: 0x3d4a46, transparent: true, opacity: 0.75 })); this.planLines.visible = this.plan; this.planLines.frustumCulled = false; this.scene.add(this.planLines);

    // zones
    for (const z of site.zones) {
      const owners = nav.fleets.filter((f) => f.areas.includes(z.id)); z.color = owners.length > 1 ? SHARED_COLOR : owners[0]?.color ?? z.color;   // map area tint = owning fleet; shared area = indigo
      const sh = new THREE.Shape(z.polygon.map(([x, y]) => new THREE.Vector2(x, y)));
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.1, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.05;
      const pts = z.polygon.map(([x, y]) => new THREE.Vector3(...toScene(x, y, 0.08)));
      const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: z.color, transparent: true, opacity: 0.9 }));
      this.scene.add(mesh, edge); this.zoneMeshes.push({ zone: z, mesh, edge }); this.layerGroups.zones.push(mesh, edge);
      const lb = labelSprite(owners.length > 1 ? `${z.name} · shared` : z.name, { size: 52 }); const cxz = (z.polygon[0][0] + z.polygon[2][0]) / 2, cyz = (z.polygon[0][1] + z.polygon[2][1]) / 2;
      lb.position.set(...toScene(cxz, cyz, 6)); lb.scale.set(18 * lb.userData.aspect / 3.4, 18 / 3.4, 1); this.scene.add(lb); this.zoneLabels.push(lb); this.layerGroups.labels.push(lb);
    }
    this.rules = new RulesLayer(this.scene, site, nav); this.rules.setTraffic(store.getState().traffic);
    // camera home: whole building
    const asp = Math.max(0.3, this.holder.clientWidth / Math.max(1, this.holder.clientHeight)); const dist = Math.max(W, D) * 1.15 * (asp < 1 ? Math.pow(1 / asp, 0.7) : 1); this.homeTarget.set(...toScene(cx, cy, 0)); this.homePos.set(cx - dist * 0.35, dist * 0.8, -(cy - dist * 0.75));
    this.camera.position.copy(this.homePos); this.controls.target.copy(this.homeTarget); this.controls.update();
    this.applyLayers(); this.refreshZones();
  }

  // ---------------------------------------------------------------- robots
  private ensure(t: RobotTelemetry): RobotVis {
    let r = this.robots.get(t.id); if (r) return r;
    const def = ROBOT_MODELS[t.model as RobotTypeId] ?? ROBOT_MODELS[DEFAULT_MODEL]; const { group, light } = def.build();
    const inner = new THREE.Group(); inner.add(group); inner.scale.setScalar(ROBOT_SCALE);
    const root = new THREE.Group(); root.add(inner); root.userData.robotId = t.id;
    group.traverse((o) => { o.userData.robotId = t.id; });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.07, 10, 48), new THREE.MeshBasicMaterial({ color: 0x14b8a6, transparent: true, opacity: 0.9, depthWrite: false })); halo.rotation.x = Math.PI / 2; halo.position.y = 0.1; halo.visible = false;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.07, 10, 48), new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.8, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; ring.visible = false;
    const dot = dotSprite('#14b8a6'); dot.position.y = 2.4; dot.renderOrder = 10; dot.userData.robotId = t.id;
    // top view for the plan view: the same yellow robot with its black details, plus a small LED in the state colour at the tail
    const [fw, fd] = def.footprint; const glyph = new THREE.Group(); glyph.position.y = 0.4; glyph.visible = this.plan; const glyphMat = new THREE.MeshBasicMaterial({ color: STATE_COLOR.idle, transparent: true, depthTest: false });
    const bodyMat = new THREE.MeshBasicMaterial({ map: robotPlanTexture(), transparent: true, depthTest: false });
    const flat = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), bodyMat); flat.rotation.x = -Math.PI / 2; flat.renderOrder = 20;
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), glyphMat); led.rotation.x = -Math.PI / 2; led.position.set(-fw * 0.38, 0.01, 0); led.renderOrder = 21;
    glyph.add(flat, led); glyph.traverse((o) => { o.userData.robotId = t.id; });
    root.add(halo, ring, dot, glyph); this.robotRoot.add(root); this.layerGroups.robots.push(root);
    r = { group: root, light, dot, halo, ring, glyph, glyphMat, bodyMat, inner, tgt: { x: t.pose.x, y: t.pose.y, th: t.pose.theta }, v: 0, lightMat: light.material as THREE.MeshBasicMaterial, from: { x: t.pose.x, y: t.pose.y, th: t.pose.theta }, tArr: performance.now(), dt: 100, trolley: null, trolleyKey: '', trFrom: null, trTgt: null };
    const [x, , z] = toScene(t.pose.x, t.pose.y); root.position.set(x, 0, z); root.rotation.y = t.pose.theta; this.robots.set(t.id, r); return r;
  }
  /** Drops every robot (the feed restarted with a different set of robots; the next batch draws the new ones). */
  clearRobots() { this.robots.forEach((r) => { this.robotRoot.remove(r.group); if (r.trolley) this.robotRoot.remove(r.trolley); }); this.robots.clear(); this.layerGroups.robots.length = 0; }
  /** A trolley is its 3D model in the 3D views and a flat rectangle in the plan view. */
  private showTrolleyAs(g: THREE.Group) { g.children.forEach((c) => { c.visible = c.userData.flat ? this.plan : !this.plan; }); }
  /** The look of the plan view: flat light (no sun, no shadows, no fog), outlines on walls and machines, robots as flat symbols. */
  private setPlanLook(on: boolean) {
    if (this.plan === on) return; this.plan = on;
    this.sun.intensity = on ? 0 : 2.2; this.sun.castShadow = !on; this.hemi.intensity = on ? 3.1 : 2.1; this.scene.fog = on ? null : new THREE.Fog(0xe6ebe9, 500, 1500);
    if (this.planLines) this.planLines.visible = on;
    this.robots.forEach((r) => { r.inner.visible = !on; r.glyph.visible = on; if (r.trolley) this.showTrolleyAs(r.trolley); });
  }
  /** Pose currently drawn for a robot (playback between the last two telemetry ticks). */
  private shown(r: RobotVis, now = performance.now()) { const k = Math.min(1, Math.max(0, (now - r.tArr) / r.dt)); return { x: r.from.x + (r.tgt.x - r.from.x) * k, y: r.from.y + (r.tgt.y - r.from.y) * k, th: lerpAngle(r.from.th, r.tgt.th, k) }; }
  /** A trolley hangs behind the robot only while it tows one (payload + trailer pose reported); empty robots are drawn alone. */
  private syncTrolley(r: RobotVis, t: RobotTelemetry) {
    const key = t.trailer && t.payload ? `${t.payload.kind}|${t.payload.qty ?? 3}` : '';
    if (key !== r.trolleyKey) {
      if (r.trolley) { this.robotRoot.remove(r.trolley); r.trolley = null; }
      r.trolleyKey = key;
      if (key) { const g = buildTrolley(t.payload!.kind, t.payload!.qty); g.userData.robotId = t.id; g.traverse((o) => { o.userData.robotId = t.id; }); const flatT = new THREE.Group(); flatT.userData.flat = true; flatT.position.y = 0.38; flatT.visible = false;
        const tm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshBasicMaterial({ color: 0xd9dedb })); tm.rotation.x = -Math.PI / 2; flatT.add(tm, new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-0.55, -0.35], [0.55, -0.35], [0.55, 0.35], [-0.55, 0.35]].map(([x, z]) => new THREE.Vector3(x, 0.01, z))), new THREE.LineBasicMaterial({ color: 0x1f2937 }))); flatT.traverse((o) => { o.userData.robotId = t.id; });
        g.add(flatT); this.robotRoot.add(g); r.trolley = g; r.trFrom = null; this.showTrolleyAs(g); }
    }
    if (t.trailer) { r.trFrom = r.trTgt ? { ...r.trTgt } : { x: t.trailer.x, y: t.trailer.y, th: t.trailer.theta }; r.trTgt = { x: t.trailer.x, y: t.trailer.y, th: t.trailer.theta }; } else { r.trFrom = r.trTgt = null; }
  }
  updateRobots(batch: RobotTelemetry[]) {
    for (const t of batch) {
      const r = this.ensure(t); const now = performance.now(); r.t = t; r.v = t.speed;
      const cur = this.shown(r); const gap = now - r.tArr; if (r.t && gap > 0) r.dt = THREE.MathUtils.clamp(0.5 * r.dt + 0.5 * gap, 40, 1500);
      r.from = Math.hypot(cur.x - t.pose.x, cur.y - t.pose.y) > 8 ? { x: t.pose.x, y: t.pose.y, th: t.pose.theta } : cur; r.tgt = { x: t.pose.x, y: t.pose.y, th: t.pose.theta }; r.tArr = now;
      this.syncTrolley(r, t);
      const c = STATE_COLOR[t.state]; r.lightMat.color.set(c); (r.dot.material as THREE.SpriteMaterial).color.set(c === '#cbd5e1' ? '#ffffff' : '#ffffff'); this.tintDot(r, c);
    }
    const s = store.getState(); this.applyFilter(s.fleetId, s.query);
  }
  private tintDot(r: RobotVis, c: string) { const m = r.dot.material as THREE.SpriteMaterial; if (r.dot.userData.c !== c) { r.dot.userData.c = c; const n = dotSprite(c); m.map = n.material.map; m.needsUpdate = true; } }
  applyFilter(fleetId: string, query: string) {
    void query;                                                  // the bottom search box locates a robot or station; it no longer hides the others
    this.rules?.setFleet(fleetId);
    this.robots.forEach((r, id) => { const t = r.t; r.group.visible = store.getState().layers.robots && (!t || ((fleetId === 'all' || t.fleetId === fleetId))); });
  }
  private onSelect() {
    const id = store.getState().selectedId; this.robots.forEach((r, k) => (r.halo.visible = k === id));
    this.pathLine.visible = false;
  }
  private updateSelectedPath() {
    const id = store.getState().selectedId; const r = id ? this.robots.get(id) : null;
    if (!r?.t?.path?.length || !store.getState().layers.routes) { this.pathLine.visible = false; return; }
    const pts = [new THREE.Vector3(...toScene(r.tgt.x, r.tgt.y, 0.25)), ...r.t.path.map((p) => new THREE.Vector3(...toScene(p.x, p.y, 0.25)))];
    this.pathLine.geometry.setFromPoints(pts); this.pathLine.visible = true;
  }
  private applyLayers() {
    const L = store.getState().layers;
    (Object.keys(this.layerGroups) as LayerKey[]).forEach((k) => this.layerGroups[k].forEach((o) => { if (k !== 'robots') o.visible = L[k]; }));
    this.layerGroups.stations.forEach((o) => (o.visible = L.stations)); this.layerGroups.labels.forEach((o) => (o.visible = L.labels));
    const s = store.getState(); this.applyFilter(s.fleetId, s.query);
  }
  private refreshZones() {
    const act = store.getState().activeZoneId;
    for (const z of this.zoneMeshes) { const on = z.zone.id === act; (z.mesh.material as THREE.MeshBasicMaterial).opacity = on ? 0.22 : z.zone.active ? (this.hoverZone === z.zone.id ? 0.2 : 0.09) : 0; z.edge.visible = z.zone.active; }
  }

  // ---------------------------------------------------------------- camera
  private setMode(m: CameraMode) {
    const prev = this.mode; this.mode = m;
    if (prev === 'walk' && m !== 'walk') { this.touchMove = { f: 0, s: 0 }; this.lookPrev.clear(); if (document.pointerLockElement) document.exitPointerLock(); this.syncTargetFromCamera(); }
    this.setPlanLook(m === 'top');
    // the plan view is the same scene seen through a very narrow lens: the lens change is animated together with the camera flight so the picture stays the same size
    const wantFov = m === 'top' ? FOV_PLAN : FOV_3D; this.fovAnim = null;
    if (this.camera.fov !== wantFov) { if (m === 'top' || (m === 'orbit' && prev === 'top')) this.fovAnim = (() => { const F = this.camera.position.distanceTo(this.controls.target) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)); return { f0: this.camera.fov, f1: wantFov, F0: F, F1: F }; })(); else { this.camera.fov = wantFov; this.camera.updateProjectionMatrix(); } }
    const c = this.controls; c.enabled = m === 'orbit' || m === 'top';
    // in the 2D plan a drag (mouse or one finger) pans; it never spins the view (3D orbits)
    c.mouseButtons.LEFT = m === 'top' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE; c.touches.ONE = m === 'top' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    c.maxPolarAngle = m === 'top' ? 0.0001 : Math.PI / 2.05; c.minPolarAngle = m === 'top' ? 0 : 0.05;
    if (m === 'top') { const t = c.target.clone(); this.flyTo(new THREE.Vector3(t.x, Math.max(this.dist(t), 60) * this.kTarget, t.z + 0.001), t); }
    if (m === 'walk') this.enterWalk();
    if (m === 'orbit' && prev === 'top') { const t = c.target.clone(); const d = this.dist(t); this.flyTo(new THREE.Vector3(t.x - d * 0.3, d * 0.8, t.z + d * 0.55), t); }
  }
  /** Walk mode moves the camera directly, so the orbit target is stale. Re-aim it along the current view direction so leaving walk mode keeps the picture exactly as it was. */
  private syncTargetFromCamera() {
    const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir); const pos = this.camera.position;
    let d = dir.y < -0.05 ? -pos.y / dir.y : 25;                    // aim at the floor when looking down, otherwise 25 m ahead
    d = THREE.MathUtils.clamp(d, this.controls.minDistance + 1, 60);
    this.controls.target.copy(pos).addScaledVector(dir, d); if (this.controls.target.y < 0) this.controls.target.y = 0;
    this.fly = null; this.controls.update();
  }
  private enterWalk() {
    const t = this.controls.target; const zone = this.zoneMeshes.find((z) => z.zone.id === store.getState().activeZoneId)?.zone ?? this.site.zones.find((z) => z.active)!;
    const p = fromScene(t.x, 0, t.z); let sx = p.x, sy = p.y;
    if (!(sx >= zone.polygon[0][0] && sx <= zone.polygon[2][0] && sy >= zone.polygon[0][1] && sy <= zone.polygon[2][1])) { sx = (zone.polygon[0][0] + zone.polygon[2][0]) / 2; sy = (zone.polygon[0][1] + zone.polygon[2][1]) / 2; }
    for (let r = 0; r < 20 && this.world.hits(sx, sy, 0.4); r += 1) { sx += 1; }
    this.walk = { x: sx, y: sy, yaw: 0, pitch: 0 }; this.camera.position.set(...toScene(sx, sy, EYE)); this.applyWalkLook();
    if (!this.coarse) Promise.resolve(this.renderer.domElement.requestPointerLock?.()).catch(() => {});   // touch devices look by dragging instead
  }
  private applyWalkLook() { this.camera.rotation.set(this.walk.pitch, this.walk.yaw, 0, 'YXZ'); }
  private onLock = () => { if (!document.pointerLockElement && this.mode === 'walk') store.getState().setCameraMode('orbit'); };
  private onLook = (e: MouseEvent) => { if (this.mode !== 'walk' || !document.pointerLockElement) return; this.walk.yaw -= e.movementX * 0.0022; this.walk.pitch = Math.max(-1.2, Math.min(1.2, this.walk.pitch - e.movementY * 0.0022)); this.applyWalkLook(); };
  private onKey = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') return; e.type === 'keydown' ? this.keys.add(e.code) : this.keys.delete(e.code); if (e.code === 'Escape' && this.mode === 'follow') store.getState().setCameraMode('orbit'); };
  flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur = 1) { if (this.fovAnim) this.fovAnim.F1 = (pos.distanceTo(target) / this.kTarget) * Math.tan(THREE.MathUtils.degToRad(FOV_3D / 2)); this.fly = { t: 0, dur, p0: this.camera.position.clone(), p1: pos, t0: this.controls.target.clone(), t1: target }; }
  home() { store.getState().setZone(null); store.getState().select(null); store.getState().setCameraMode('orbit'); this.flyTo(this.homePos.clone(), this.homeTarget.clone()); }
  zoomBy(f: number) { const o = this.camera.position.clone().sub(this.controls.target).multiplyScalar(f); const L = THREE.MathUtils.clamp(o.length(), this.controls.minDistance, this.controls.maxDistance); this.camera.position.copy(this.controls.target).add(o.setLength(L)); }
  focusZone(id: string) {
    const z = this.site.zones.find((q) => q.id === id); if (!z) return; store.getState().setZone(id); if (this.mode === 'walk' || this.mode === 'follow') store.getState().setCameraMode('orbit');
    const cx = (z.polygon[0][0] + z.polygon[2][0]) / 2, cy = (z.polygon[0][1] + z.polygon[2][1]) / 2, w = z.polygon[2][0] - z.polygon[0][0], d = z.polygon[2][1] - z.polygon[0][1];
    const dist = Math.max(w, d) * 1.5; const tgt = new THREE.Vector3(...toScene(cx, cy, 0));
    this.flyTo(this.mode === 'top' ? new THREE.Vector3(tgt.x, dist * 1.1 * this.kTarget, tgt.z + 0.001) : new THREE.Vector3(tgt.x - dist * 0.3, dist * 0.85, tgt.z + dist * 0.65), tgt);
  }
  flyToSite(x: number, y: number) { const t = new THREE.Vector3(...toScene(x, y, 0)); const d = Math.max(30, this.dist(this.controls.target) * 0.6); this.flyTo(this.mode === 'top' ? new THREE.Vector3(t.x, d * this.kTarget, t.z + 0.001) : new THREE.Vector3(t.x - d * 0.3, d * 0.8, t.z + d * 0.55), t); }
  focusStation(id: string) {
    const p = this.rules.stationPos.get(id); if (!p) return; const d = 16;
    this.flyTo(this.mode === 'top' ? new THREE.Vector3(p.x, 30 * this.kTarget, p.z + 0.001) : new THREE.Vector3(p.x - d * 0.4, d * 0.9, p.z + d * 0.8), p.clone(), 0.9);
  }
  private updateIncoming() {
    const id = store.getState().selectedStationId; const sp = id ? this.rules.stationPos.get(id) : null; if (!id || !sp) { this.incoming.visible = false; return; }
    const pts: THREE.Vector3[] = []; this.robots.forEach((r) => { if (r.t?.task?.to === id && r.t.state !== 'working' && r.t.state !== 'charging') pts.push(r.group.position.clone().setY(0.4), sp.clone().setY(0.4)); });
    this.incoming.geometry.setFromPoints(pts); this.incoming.visible = pts.length > 0;
  }
  focusRobot(id: string) {
    const r = this.robots.get(id); if (!r) return; store.getState().select(id);
    const p = r.group.position.clone(); this.flyTo(this.mode === 'top' ? new THREE.Vector3(p.x, 22 * this.kTarget, p.z + 0.001) : new THREE.Vector3(p.x - 14, 16, p.z + 14), p, 0.9);
  }

  // ---------------------------------------------------------------- input
  private pick(e: PointerEvent) {
    const b = this.renderer.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); this.ray.setFromCamera(this.ptr, this.camera);
    const hits = this.ray.intersectObjects([...this.robotRoot.children.filter((c) => c.visible)], true);
    const rh = hits.find((h) => h.object.userData.robotId || h.object.parent?.userData.robotId);
    let rid: string | null = null; if (rh) { let o: THREE.Object3D | null = rh.object; while (o && !o.userData.robotId) o = o.parent; rid = o?.userData.robotId ?? null; }
    const pt = new THREE.Vector3(); let zone: string | null = null;
    if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) { const p = fromScene(pt.x, 0, pt.z); zone = this.site.zones.find((z) => z.active && p.x >= z.polygon[0][0] && p.x <= z.polygon[2][0] && p.y >= z.polygon[0][1] && p.y <= z.polygon[2][1])?.id ?? null; }
    const sid = rid ? null : this.rules?.pick(this.ray) ?? null;
    return { rid, zone, sid };
  }
  private onMove = (e: PointerEvent) => {
    if (!this.site || this.mode === 'walk' || e.pointerType === 'touch') return; const { rid, zone, sid } = this.pick(e);   // no hover on touch
    this.renderer.domElement.style.cursor = rid || sid || zone ? 'pointer' : 'grab';
    if (zone !== this.hoverZone) { this.hoverZone = zone; this.refreshZones(); }
  };
  private onUp = (e: PointerEvent) => {
    if (e.button !== 0) return;   // only the primary button selects; MMB/RMB are camera drags
    const touch = e.pointerType === 'touch';
    if (!this.site || this.mode === 'walk' || this.twistPrev !== null || Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > (touch ? 10 : 5)) return;   // fingers wobble more than a mouse
    if (touch) { const now = performance.now(); const dbl = now - this.lastTap.t < 320 && Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 30; this.lastTap = { t: dbl ? 0 : now, x: e.clientX, y: e.clientY }; if (dbl) { this.doubleTap(e.clientX, e.clientY); return; } }
    const { rid, zone, sid } = this.pick(e); const s = store.getState();
    if (rid) { s.select(rid); return; }
    if (sid) { s.selectStation(sid); return; }
    s.select(null); s.selectStation(null); if (zone) this.focusZone(zone); else if (s.activeZoneId) this.home();
  };

  // ---------------------------------------------------------------- touch
  private onTouchDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return; this.touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touchPts.size === 2) this.twistPrev = this.twistAngle();
    if (this.mode === 'walk') this.lookPrev.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  private onTouchMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !this.touchPts.has(e.pointerId)) return; this.touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.mode === 'walk') {                         // one-finger drag looks around (no pointer lock on touch)
      const p = this.lookPrev.get(e.pointerId); if (p) { this.walk.yaw -= (e.clientX - p.x) * 0.0055; this.walk.pitch = THREE.MathUtils.clamp(this.walk.pitch - (e.clientY - p.y) * 0.0055, -1.2, 1.2); this.applyWalkLook(); this.lookPrev.set(e.pointerId, { x: e.clientX, y: e.clientY }); }
      return;
    }
    if (this.touchPts.size === 2 && this.twistPrev !== null && (this.mode === 'orbit' || this.mode === 'top')) {   // two-finger twist rotates the view about the look-at point
      const a = this.twistAngle(); let d = a - this.twistPrev; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; this.twistPrev = a;
      if (Math.abs(d) < 0.6) { const off = this.camera.position.clone().sub(this.controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), d); this.camera.position.copy(this.controls.target).add(off); }
    }
  };
  private onTouchEnd = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return; this.touchPts.delete(e.pointerId); this.lookPrev.delete(e.pointerId);
    if (this.touchPts.size < 2) setTimeout(() => { if (this.touchPts.size < 2) this.twistPrev = null; }, 0);   // keep the flag through this pointerup so a gesture does not count as a tap
  };
  private twistAngle() { const [a, b] = [...this.touchPts.values()]; return Math.atan2(b.y - a.y, b.x - a.x); }
  /** Double-tap / double-click: zoom in on the tapped floor point; on a robot, locate it. */
  private doubleTap(cx: number, cy: number) {
    if (!this.site || this.mode === 'walk' || this.mode === 'follow') return;
    const b = this.renderer.domElement.getBoundingClientRect(); this.ptr.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1); this.ray.setFromCamera(this.ptr, this.camera);
    const hits = this.ray.intersectObjects([...this.robotRoot.children.filter((c) => c.visible)], true); const rh = hits.find((h) => h.object.userData.robotId || h.object.parent?.userData.robotId);
    if (rh) { let o: THREE.Object3D | null = rh.object; while (o && !o.userData.robotId) o = o.parent; if (o) { this.focusRobot(o.userData.robotId); return; } }
    const pt = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) return;
    const off = this.camera.position.clone().sub(this.controls.target); const d = Math.max(this.controls.minDistance + 2, off.length() * 0.5);
    this.flyTo(pt.clone().add(off.setLength(d)), pt, 0.5);
  }
  /** Virtual stick (UI) -> walk movement. f = forward, s = strafe right, both -1..1. */
  setWalkInput(f: number, s: number) { this.touchMove.f = f; this.touchMove.s = s; }

  // ---------------------------------------------------------------- loop
  private resize() { const w = this.holder.clientWidth, h = this.holder.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h); this.camera.aspect = w / h; this.applyInset(w, h); }
  private inset = 0;
  setInset(px: number) { this.inset = px; this.resize(); }
  private applyInset(w: number, h: number) { if (this.inset) this.camera.setViewOffset(w, h, -this.inset / 2, 0, w, h); else this.camera.clearViewOffset(); this.camera.updateProjectionMatrix(); }
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop); const dt = Math.min(this.clock.getDelta(), 0.05), time = this.clock.elapsedTime;
    if (!this.site) { this.renderer.render(this.scene, this.camera); return; }
    // robots: dead-reckon + smooth toward telemetry
    this.robots.forEach((r) => {
      const g = r.group; const now = performance.now(); const p = this.shown(r, now); const [px, , pz] = toScene(p.x, p.y); g.position.set(px, 0, pz); g.rotation.y = p.th;
      if (r.trolley && r.trTgt) {
        const f = r.trFrom ?? r.trTgt; const k = Math.min(1, Math.max(0, (now - r.tArr) / r.dt)); const [qx, , qz] = toScene(f.x + (r.trTgt.x - f.x) * k, f.y + (r.trTgt.y - f.y) * k);
        r.trolley.position.set(qx, 0, qz); r.trolley.rotation.y = lerpAngle(f.th, r.trTgt.th, k); r.trolley.visible = g.visible && this.dist(r.trolley.position) < 400;
      }
      const st = r.t?.state ?? 'idle'; const pu = STATE_PULSE[st]; const s = pu ? 0.5 + 0.5 * Math.sin(time * pu * 6) : 0;
      r.ring.visible = st === 'blocked' || st === 'error' || !!r.t?.alerts?.some((a) => a.severity === 'critical'); if (r.ring.visible) { (r.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.55 * s; r.ring.scale.setScalar(1 + 0.12 * s); }
      if (r.halo.visible) { (r.halo.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(time * 3.2)); r.halo.scale.setScalar(1 + 0.1 * (0.5 + 0.5 * Math.sin(time * 3.2))); }
      const dist = this.dist(g.position); const ds = THREE.MathUtils.clamp(dist * 0.014, 1.1, 9); r.dot.scale.set(ds, ds, 1); r.dot.position.y = ds * 0.55 + 1.2; r.dot.visible = dist > 25 && !this.plan;
      r.group.children[0].visible = !this.plan && dist < 400; if (this.plan) { r.glyphMat.color.set(STATE_COLOR[st]); r.glyphMat.opacity = r.bodyMat.opacity = st === 'offline' ? 0.45 : 1; } r.lightMat.opacity = st === 'offline' ? 0.4 : 1; r.lightMat.transparent = true;
    });
    this.updateSelectedPath();
    // labels: zone labels fade when close, station labels when far
    const cd = this.dist(this.controls.target);
    this.zoneLabels.forEach((l) => { l.material.opacity = THREE.MathUtils.clamp((cd - 110) / 60, 0, 1); });
    this.rules?.tick(time, this.camera, this.k); this.updateIncoming();
    // fly
    if (this.fly) { this.fly.t += dt / this.fly.dur; const k = this.fly.t >= 1 ? 1 : 1 - Math.pow(1 - this.fly.t, 3); this.camera.position.lerpVectors(this.fly.p0, this.fly.p1, k); this.controls.target.lerpVectors(this.fly.t0, this.fly.t1, k); if (this.fly.t >= 1) this.fly = null; }
    this.stepLens();
    if (this.mode === 'walk') this.stepWalk(dt);
    else if (this.mode === 'follow') this.stepFollow(dt);
    else {
      this.controls.update();
      // screen-space panning must not sink under the floor: lift camera and target together so the pan stays a pure translation
      const lift = Math.max(0, 1 - this.camera.position.y, -this.controls.target.y);
      if (lift > 0) { this.camera.position.y += lift; this.controls.target.y += lift; }
    }
    // sun follows target so shadows stay sharp near the viewer
    const T = this.mode === 'walk' ? this.camera.position : this.controls.target; this.sun.target.position.set(T.x, 0, T.z); this.sun.position.set(T.x + 40, 90, T.z + 30);
    this.renderer.render(this.scene, this.camera);
    if (time - this.lastView > 0.15) { this.lastView = time; const p = this.mode === 'walk' ? this.camera.position : this.controls.target; const f = fromScene(this.camera.position.x, 0, this.camera.position.z); const v = fromScene(p.x, 0, p.z); const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
      this.onView({ x: this.mode === 'walk' ? f.x : v.x, y: this.mode === 'walk' ? f.y : v.y, yaw: Math.atan2(-dir.z, dir.x), dist: cd, zoomPct: this.mode === 'walk' ? 100 : Math.round((100 * 120) / Math.max(cd, 1)) }); }
  };
  /** Lens change between the 3D and the plan view: the camera sits at the distance that keeps the same picture size, so the view zooms out of perspective instead of jumping. */
  private stepLens() {
    const a = this.fovAnim; if (a) {
      const done = !this.fly; const t = done ? 1 : Math.min(1, this.fly!.t); const k = 1 - Math.pow(1 - t, 3); const fov = a.f0 + (a.f1 - a.f0) * k;
      const dir = this.camera.position.clone().sub(this.controls.target); if (dir.lengthSq() < 1e-9) dir.set(0, 1, 0); dir.normalize();
      const F = a.F0 + (a.F1 - a.F0) * k; this.camera.fov = fov; this.camera.position.copy(this.controls.target).addScaledVector(dir, F / Math.tan(THREE.MathUtils.degToRad(fov / 2))); if (done) this.fovAnim = null;
    }
    const k = this.k; const c = this.controls; c.minDistance = 6 * k; c.maxDistance = 700 * k; this.camera.near = 0.3 * k; this.camera.far = 3000 * k; this.camera.updateProjectionMatrix();
  }
  private stepWalk(dt: number) {
    const mag = Math.hypot(this.touchMove.f, this.touchMove.s); const sp = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || mag > 0.9 ? 6 : 2.6) * dt; const fw = Math.max(-1, Math.min(1, (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) + this.touchMove.f));
    const st = Math.max(-1, Math.min(1, (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.touchMove.s)); this.walk.yaw -= ((this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0)) * dt * 1.6;
    // camera looks along three (-sin yaw, 0, -cos yaw) => site forward (x = -sin yaw, y = cos yaw)
    const fX = -Math.sin(this.walk.yaw), fY = Math.cos(this.walk.yaw);
    const dx = (fX * fw + fY * st) * sp, dy = (fY * fw - fX * st) * sp;
    if (dx || dy) { const [nx, ny] = this.world.move(this.walk.x, this.walk.y, dx, dy, 0.4); this.walk.x = nx; this.walk.y = ny; }
    this.camera.position.set(...toScene(this.walk.x, this.walk.y, EYE)); this.applyWalkLook();
  }
  private stepFollow(dt: number) {
    const id = store.getState().selectedId; const r = id ? this.robots.get(id) : null; if (!r) return;
    const p = r.group.position; const back = new THREE.Vector3(-Math.cos(r.group.rotation.y) * 9, 6, Math.sin(r.group.rotation.y) * 9);
    this.camera.position.lerp(p.clone().add(back), 1 - Math.exp(-dt * 3)); this.controls.target.lerp(p, 1 - Math.exp(-dt * 6)); this.camera.lookAt(this.controls.target);
  }
  screenshot() { return this.renderer.domElement.toDataURL('image/png'); }
  dispose() { cancelAnimationFrame(this.raf); this.unsub.forEach((u) => u()); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
