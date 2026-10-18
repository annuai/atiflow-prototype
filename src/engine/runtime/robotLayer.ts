import * as THREE from 'three';
import { store } from '../../core/store';
import { toScene } from '../../core/coords';
import { dotSprite } from '../labels';
import { ROBOT_MODELS, DEFAULT_MODEL, buildTrolley, robotPlanTexture } from '../robotMesh';
import { STATE_COLOR, STATE_PULSE } from '../stateStyle';
import type { RobotTelemetry } from '../../core/types';
import type { RobotTypeId } from '../../data/robotTypes';
import { type SceneEntry } from '../SceneManager';
import { ROBOT_SCALE, lerpAngle, type RobotVis } from './shared';
import type { Stage } from './stage';
import type { CameraRig } from './cameraRig';

/** The robots: their meshes, playback between telemetry ticks, trolleys, tints, the selected robot's path and the lines to a station they are heading for. */
export class RobotLayer {
  readonly robots = new Map<string, RobotVis>();
  /** where a robot waits when no loaded scene is its own (hidden): robots are normally children of their scene's `robots` group */
  readonly robotRoot = new THREE.Group();
  readonly pathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x14b8a6 }));
  readonly incoming = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xf59e0b }),
  );
  /** A robot to fly to as soon as its first report has made it (Locate on map right after the page opened, before the fleet has told us where the robot is). */
  pendingFocus: { id: string; until: number } | null = null;
  /** set by the engine once the camera exists: the layer asks it to fly to a robot that has just appeared */
  rig!: CameraRig;
  constructor(private readonly s: Stage) {
    this.robotRoot.visible = false;
    s.scene.add(this.robotRoot);
    this.pathLine.visible = false;
    s.scene.add(this.pathLine);
    this.incoming.frustumCulled = false;
    this.incoming.visible = false;
    s.scene.add(this.incoming);
  }
  // ---------------------------------------------------------------- robots
  ensure(t: RobotTelemetry): RobotVis {
    let r = this.robots.get(t.id);
    if (r) return r;
    const def = ROBOT_MODELS[t.model as RobotTypeId] ?? ROBOT_MODELS[DEFAULT_MODEL];
    const { group, light } = def.build();
    const inner = new THREE.Group();
    inner.add(group);
    inner.scale.setScalar(ROBOT_SCALE);
    const root = new THREE.Group();
    root.add(inner);
    root.userData.robotId = t.id;
    group.traverse((o) => {
      o.userData.robotId = t.id;
    });
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.07, 10, 48),
      new THREE.MeshBasicMaterial({ color: 0x14b8a6, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.1;
    halo.visible = false;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.07, 10, 48),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    ring.visible = false;
    const dot = dotSprite('#14b8a6');
    dot.position.y = 2.4;
    dot.renderOrder = 10;
    dot.userData.robotId = t.id;
    // top view for the plan view: the same yellow robot with its black details, plus a small LED in the state colour at the tail
    const [fw, fd] = def.footprint;
    const glyph = new THREE.Group();
    glyph.position.y = 0.4;
    glyph.visible = this.s.plan;
    const glyphMat = new THREE.MeshBasicMaterial({ color: STATE_COLOR.idle, transparent: true, depthTest: false });
    const bodyMat = new THREE.MeshBasicMaterial({ map: robotPlanTexture(), transparent: true, depthTest: false });
    const flat = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), bodyMat);
    flat.rotation.x = -Math.PI / 2;
    flat.renderOrder = 20;
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), glyphMat);
    led.rotation.x = -Math.PI / 2;
    led.position.set(-fw * 0.38, 0.01, 0);
    led.renderOrder = 21;
    glyph.add(flat, led);
    glyph.traverse((o) => {
      o.userData.robotId = t.id;
    });
    root.add(halo, ring, dot, glyph);
    this.homeOf(t.fleetId).add(root);
    this.s.layerGroups.robots.push(root);
    r = {
      group: root,
      light,
      dot,
      halo,
      ring,
      glyph,
      glyphMat,
      bodyMat,
      inner,
      tgt: { x: t.pose.x, y: t.pose.y, th: t.pose.theta },
      v: 0,
      lightMat: light.material as THREE.MeshBasicMaterial,
      from: { x: t.pose.x, y: t.pose.y, th: t.pose.theta },
      tArr: performance.now(),
      dt: 100,
      trolley: null,
      trolleyKey: '',
      trFrom: null,
      trTgt: null,
    };
    const [x, , z] = toScene(t.pose.x, t.pose.y);
    root.position.set(x, 0, z);
    root.rotation.y = t.pose.theta;
    this.robots.set(t.id, r);
    return r;
  }
  /** Drops every robot (the feed restarted with a different set of robots; the next batch draws the new ones). */
  clearRobots() {
    this.robots.forEach((r) => {
      r.group.removeFromParent();
      r.trolley?.removeFromParent();
    });
    this.robots.clear();
    this.s.layerGroups.robots.length = 0;
  }
  /** A trolley is its 3D model in the 3D views and a flat rectangle in the plan view. */
  showTrolleyAs(g: THREE.Group) {
    g.children.forEach((c) => {
      c.visible = c.userData.flat ? this.s.plan : !this.s.plan;
    });
  }
  /** Pose currently drawn for a robot (playback between the last two telemetry ticks). */
  shown(r: RobotVis, now = performance.now()) {
    const k = Math.min(1, Math.max(0, (now - r.tArr) / r.dt));
    return {
      x: r.from.x + (r.tgt.x - r.from.x) * k,
      y: r.from.y + (r.tgt.y - r.from.y) * k,
      th: lerpAngle(r.from.th, r.tgt.th, k),
    };
  }
  /** A trolley hangs behind the robot only while it tows one (payload + trailer pose reported); empty robots are drawn alone. */
  syncTrolley(r: RobotVis, t: RobotTelemetry) {
    const key = t.trailer && t.payload ? `${t.payload.kind}|${t.payload.qty ?? 3}` : '';
    if (key !== r.trolleyKey) {
      if (r.trolley) {
        r.trolley.removeFromParent();
        r.trolley = null;
      }
      r.trolleyKey = key;
      if (key) {
        const g = buildTrolley(t.payload!.kind, t.payload!.qty);
        g.userData.robotId = t.id;
        g.traverse((o) => {
          o.userData.robotId = t.id;
        });
        const flatT = new THREE.Group();
        flatT.userData.flat = true;
        flatT.position.y = 0.38;
        flatT.visible = false;
        const tm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshBasicMaterial({ color: 0xd9dedb }));
        tm.rotation.x = -Math.PI / 2;
        flatT.add(
          tm,
          new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(
              [
                [-0.55, -0.35],
                [0.55, -0.35],
                [0.55, 0.35],
                [-0.55, 0.35],
              ].map(([x, z]) => new THREE.Vector3(x, 0.01, z)),
            ),
            new THREE.LineBasicMaterial({ color: 0x1f2937 }),
          ),
        );
        flatT.traverse((o) => {
          o.userData.robotId = t.id;
        });
        g.add(flatT);
        (r.group.parent ?? this.robotRoot).add(g);
        r.trolley = g;
        r.trFrom = null;
        this.showTrolleyAs(g);
      }
    }
    if (t.trailer) {
      r.trFrom = r.trTgt ? { ...r.trTgt } : { x: t.trailer.x, y: t.trailer.y, th: t.trailer.theta };
      r.trTgt = { x: t.trailer.x, y: t.trailer.y, th: t.trailer.theta };
    } else {
      r.trFrom = r.trTgt = null;
    }
  }
  updateRobots(batch: RobotTelemetry[]) {
    for (const t of batch) {
      const r = this.ensure(t);
      const now = performance.now();
      r.t = t;
      const home = this.homeOf(t.fleetId);
      if (r.group.parent !== home) {
        home.add(r.group); // its fleet's scene changed
        if (r.trolley) home.add(r.trolley);
      }
      r.v = t.speed;
      const cur = this.shown(r);
      const gap = now - r.tArr;
      if (r.t && gap > 0) r.dt = THREE.MathUtils.clamp(0.5 * r.dt + 0.5 * gap, 40, 1500);
      r.from =
        Math.hypot(cur.x - t.pose.x, cur.y - t.pose.y) > 8 ? { x: t.pose.x, y: t.pose.y, th: t.pose.theta } : cur;
      r.tgt = { x: t.pose.x, y: t.pose.y, th: t.pose.theta };
      r.tArr = now;
      this.syncTrolley(r, t);
      const c = STATE_COLOR[t.state];
      r.lightMat.color.set(c);
      (r.dot.material as THREE.SpriteMaterial).color.set(c === '#cbd5e1' ? '#ffffff' : '#ffffff');
      this.tintDot(r, c);
    }
    const s = store.getState();
    this.applyFilter(s.fleetId, s.query);
    const want = this.pendingFocus;
    if (want && this.robots.has(want.id)) this.rig.focusRobot(want.id);
    else if (want && performance.now() > want.until) this.pendingFocus = null;
  }
  tintDot(r: RobotVis, c: string) {
    const m = r.dot.material as THREE.SpriteMaterial;
    if (r.dot.userData.c !== c) {
      r.dot.userData.c = c;
      const n = dotSprite(c);
      m.map = n.material.map;
      m.needsUpdate = true;
    }
  }
  applyFilter(fleetId: string, query: string) {
    void query; // the bottom search box locates a robot or station; it no longer hides the others
    this.s.manager.loaded().forEach((e) => e.scene.rules.setFleet(fleetId));
    this.robots.forEach((r) => {
      const t = r.t;
      r.group.visible = store.getState().layers.robots && (!t || fleetId === 'all' || t.fleetId === fleetId);
    });
  }
  onSelect() {
    const id = store.getState().selectedId;
    this.robots.forEach((r, k) => (r.halo.visible = k === id));
    this.pathLine.visible = false;
  }
  updateSelectedPath() {
    const id = store.getState().selectedId;
    const r = id ? this.robots.get(id) : null;
    if (!r?.t?.path?.length || !store.getState().layers.routes) {
      this.pathLine.visible = false;
      return;
    }
    const pts = [
      new THREE.Vector3(...toScene(r.tgt.x, r.tgt.y, 0.25)),
      ...r.t.path.map((p) => new THREE.Vector3(...toScene(p.x, p.y, 0.25))),
    ];
    this.pathLine.geometry.setFromPoints(pts);
    this.pathLine.visible = true;
  }
  updateIncoming() {
    const id = store.getState().selectedStationId;
    const sp = id ? this.s.stationPos(id) : null;
    if (!id || !sp) {
      this.incoming.visible = false;
      return;
    }
    const pts: THREE.Vector3[] = [];
    this.robots.forEach((r) => {
      if (r.t?.task?.to === id && r.t.state !== 'working' && r.t.state !== 'charging')
        pts.push(r.group.position.clone().setY(0.4), sp.clone().setY(0.4));
    });
    this.incoming.geometry.setFromPoints(pts);
    this.incoming.visible = pts.length > 0;
  }
  /** Moves every robot (and its trolley) to the robots group of the scene its fleet runs on. */
  reattachRobots() {
    this.robots.forEach((r) => {
      const dest = this.homeOf(r.t?.fleetId);
      if (r.group.parent !== dest) dest.add(r.group);
      if (r.trolley && r.trolley.parent !== dest) dest.add(r.trolley);
    });
  }
  /** A scene is being freed: its robots wait (hidden) until a scene of their fleet is loaded again. */
  parkRobotsOf(e: SceneEntry) {
    [...e.robots.children].forEach((c) => this.robotRoot.add(c));
  }
  /** The scene whose robots group a fleet's robots belong in: the one on screen that has the fleet, else any loaded one that has it, else a catch-all scene. */
  entryOfFleet(fleetId: string | undefined): SceneEntry | undefined {
    if (!fleetId) return this.s.manager.loaded().find((e) => e.source.fleets.length === 0);
    const has = (e: SceneEntry) => e.source.fleets.includes(fleetId);
    return (
      this.s.active.find(has) ??
      this.s.manager.loaded().find(has) ??
      this.s.manager.loaded().find((e) => e.source.fleets.length === 0)
    );
  }
  homeOf(fleetId: string | undefined): THREE.Object3D {
    return this.entryOfFleet(fleetId)?.robots ?? this.robotRoot;
  }
  /** Per frame: play each robot's pose between telemetry ticks, its trolley, its rings, its dot and its plan-view symbol. */
  animate(time: number) {
    // robots: dead-reckon + smooth toward telemetry
    this.robots.forEach((r) => {
      const g = r.group;
      const now = performance.now();
      const p = this.shown(r, now);
      const [px, , pz] = toScene(p.x, p.y);
      g.position.set(px, 0, pz);
      g.rotation.y = p.th;
      if (r.trolley && r.trTgt) {
        const f = r.trFrom ?? r.trTgt;
        const k = Math.min(1, Math.max(0, (now - r.tArr) / r.dt));
        const [qx, , qz] = toScene(f.x + (r.trTgt.x - f.x) * k, f.y + (r.trTgt.y - f.y) * k);
        r.trolley.position.set(qx, 0, qz);
        r.trolley.rotation.y = lerpAngle(f.th, r.trTgt.th, k);
        r.trolley.visible = g.visible && this.s.dist(r.trolley.position) < 400;
      }
      const st = r.t?.state ?? 'idle';
      const pu = STATE_PULSE[st];
      const s = pu ? 0.5 + 0.5 * Math.sin(time * pu * 6) : 0;
      r.ring.visible = st === 'blocked' || st === 'error' || !!r.t?.alerts?.some((a) => a.severity === 'critical');
      if (r.ring.visible) {
        (r.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.55 * s;
        r.ring.scale.setScalar(1 + 0.12 * s);
      }
      if (r.halo.visible) {
        (r.halo.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(time * 3.2));
        r.halo.scale.setScalar(1 + 0.1 * (0.5 + 0.5 * Math.sin(time * 3.2)));
      }
      const dist = this.s.dist(g.position);
      const ds = THREE.MathUtils.clamp(dist * 0.014, 1.1, 9);
      r.dot.scale.set(ds, ds, 1);
      r.dot.position.y = ds * 0.55 + 1.2;
      r.dot.visible = dist > 25 && !this.s.plan;
      r.group.children[0].visible = !this.s.plan && dist < 400;
      if (this.s.plan) {
        r.glyphMat.color.set(STATE_COLOR[st]);
        r.glyphMat.opacity = r.bodyMat.opacity = st === 'offline' ? 0.45 : 1;
      }
      r.lightMat.opacity = st === 'offline' ? 0.4 : 1;
      r.lightMat.transparent = true;
    });
  }
}
