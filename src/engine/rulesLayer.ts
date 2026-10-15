import * as THREE from 'three';
import { toScene } from '../core/coords';
import type { NavGraph, SiteLayout, StationType } from '../core/types';
import type { TrafficZoneState } from '../core/rules';
import { LaneGraph } from '../core/lanes';
import { labelSprite, liveLabel, stripeTexture } from './labels';
import { localized } from '@/i18n';

const copy = localized('floor');

export const SHARED_COLOR = '#6366f1';
export const STATION_COLOR: Record<StationType, string> = {
  pick: '#14b8a6',
  drop: '#ec4899',
  buffer: '#3b82f6',
  asrs: '#f59e0b',
  charge: '#22c55e',
  park: '#64748b',
};
const lighten = (c: string, k: number) => new THREE.Color(c).lerp(new THREE.Color('#ffffff'), k);

/** Draws everything the map rules say: fleet lanes (one direction each, with arrows), traffic zones (live occupancy), forbidden zones, stations. */
export class RulesLayer {
  readonly root = new THREE.Group();
  readonly hits: THREE.Mesh[] = [];
  private laneGroups = new Map<string, THREE.Object3D[]>();
  private tz = new Map<
    string,
    { fill: THREE.Mesh; edge: THREE.LineLoop; label: ReturnType<typeof liveLabel>; center: THREE.Vector3 }
  >();
  private stations = new Map<
    string,
    {
      group: THREE.Group;
      ring: THREE.Mesh;
      halo: THREE.Mesh;
      label: THREE.Sprite;
      pos: THREE.Vector3;
      type: StationType;
    }
  >();
  private fzLabels: THREE.Sprite[] = [];
  private traffic: Record<string, TrafficZoneState> = {};
  private selected: string | null = null;
  readonly stationPos = new Map<string, THREE.Vector3>();

  constructor(
    parent: THREE.Object3D,
    private site: SiteLayout,
    private nav: NavGraph,
  ) {
    parent.add(this.root);
    this.buildLanes();
    this.buildTraffic();
    this.buildForbidden();
    this.buildStations();
  }

  private buildLanes() {
    const color = new Map(this.nav.fleets.map((f) => [f.id, f.color]));
    const groups = new Map<
      string,
      { segs: [number, number, number, number][]; arrows: [number, number, number][]; color: string }
    >();
    const lg = new LaneGraph(this.nav);
    const add = (fleets: string[], pts: { x: number; y: number }[], arrows: boolean) => {
      const key = fleets.length > 1 ? 'shared' : fleets[0];
      const g =
        groups.get(key) ??
        groups
          .set(key, { segs: [], arrows: [], color: key === 'shared' ? SHARED_COLOR : (color.get(key) ?? '#64748b') })
          .get(key)!;
      let acc = 2;
      for (let i = 0; i + 1 < pts.length; i++) {
        const { x: ax, y: ay } = pts[i],
          { x: bx, y: by } = pts[i + 1];
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 0.05) continue;
        g.segs.push([ax, ay, bx, by]);
        if (!arrows) continue;
        for (; acc < len; acc += 5)
          g.arrows.push([ax + ((bx - ax) * acc) / len, ay + ((by - ay) * acc) / len, Math.atan2(by - ay, bx - ax)]);
        acc -= len;
      }
    };
    for (const l of lg.roadLanes()) add(l.fleets, l.pts, true); // the lanes as driven, cut short at junctions
    for (const c of lg.connectors()) add(c.fleets, c.pts, false); // and one smooth curve for every turn that joins one lane to the next
    const arrowGeo = new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0.55, 0, 0, -0.3, 0, -0.34, -0.3, 0, 0.34], 3),
    );
    arrowGeo.setIndex([0, 1, 2]);
    arrowGeo.computeVertexNormals();
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      up = new THREE.Vector3(0, 1, 0);
    for (const [key, g] of groups) {
      const lines = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 0.02, 0.14),
        new THREE.MeshBasicMaterial({ color: g.color, transparent: true, opacity: 0.85 }),
        g.segs.length,
      );
      g.segs.forEach(([ax, ay, bx, by], i) => {
        q.setFromAxisAngle(up, Math.atan2(by - ay, bx - ax));
        m.compose(
          new THREE.Vector3(...toScene((ax + bx) / 2, (ay + by) / 2, 0.07)),
          q,
          new THREE.Vector3(Math.hypot(bx - ax, by - ay) + 0.14, 1, 1),
        );
        lines.setMatrixAt(i, m);
      });
      const arrows = new THREE.InstancedMesh(
        arrowGeo,
        new THREE.MeshBasicMaterial({ color: lighten(g.color, 0.15), side: THREE.DoubleSide }),
        g.arrows.length,
      );
      g.arrows.forEach(([x, y, a], i) => {
        q.setFromAxisAngle(up, a);
        m.compose(new THREE.Vector3(...toScene(x, y, 0.09)), q, new THREE.Vector3(1, 1, 1));
        arrows.setMatrixAt(i, m);
      });
      lines.frustumCulled = arrows.frustumCulled = false;
      this.root.add(lines, arrows);
      this.laneGroups.set(key, [lines, arrows]);
    }
  }

  private buildTraffic() {
    for (const z of this.nav.trafficZones) {
      const sh = new THREE.Shape(z.polygon.map(([x, y]) => new THREE.Vector2(x, y)));
      const fill = new THREE.Mesh(
        new THREE.ShapeGeometry(sh),
        new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.16, depthWrite: false }),
      );
      fill.rotation.x = -Math.PI / 2;
      fill.position.y = 0.1;
      const edge = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(z.polygon.map(([x, y]) => new THREE.Vector3(...toScene(x, y, 0.11)))),
        new THREE.LineBasicMaterial({ color: '#f59e0b' }),
      );
      const cx = z.polygon.reduce((a, p) => a + p[0], 0) / z.polygon.length,
        cy = z.polygon.reduce((a, p) => a + p[1], 0) / z.polygon.length;
      const label = liveLabel(300, 80);
      label.sprite.position.set(...toScene(cx, cy, 2.6));
      label.sprite.scale.set(3.6, 3.6 / label.sprite.userData.aspect, 1);
      label.set(z.id);
      this.root.add(fill, edge, label.sprite);
      this.tz.set(z.id, { fill, edge, label, center: new THREE.Vector3(...toScene(cx, cy, 0)) });
    }
  }

  private buildForbidden() {
    const tex = stripeTexture();
    for (const z of this.nav.forbiddenZones) {
      const xs = z.polygon.map((p) => p[0]),
        ys = z.polygon.map((p) => p[1]);
      const x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        y0 = Math.min(...ys),
        y1 = Math.max(...ys);
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set((x1 - x0) / 2, (y1 - y0) / 2);
      const fill = new THREE.Mesh(
        new THREE.PlaneGeometry(x1 - x0, y1 - y0),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(...toScene((x0 + x1) / 2, (y0 + y1) / 2, 0.1));
      const edge = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(z.polygon.map(([x, y]) => new THREE.Vector3(...toScene(x, y, 0.12)))),
        new THREE.LineBasicMaterial({ color: '#ef4444' }),
      );
      this.root.add(fill, edge);
      for (let i = 0; i < 4; i++) {
        // low translucent barrier so the zone reads in 3D
        const a = z.polygon[i],
          b = z.polygon[(i + 1) % 4];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const w = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.9, 0.08),
          new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.28, depthWrite: false }),
        );
        w.position.set(...toScene((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.45));
        w.rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]);
        this.root.add(w);
      }
      const lb = liveLabel(560, 80);
      lb.set(copy.labels3d.noGo(z.name), 'rgba(185,28,28,.92)');
      lb.sprite.position.set(...toScene((x0 + x1) / 2, (y0 + y1) / 2, 2.2));
      lb.sprite.scale.set(7, 7 / lb.sprite.userData.aspect, 1);
      this.root.add(lb.sprite);
      this.fzLabels.push(lb.sprite);
    }
  }

  private buildStations() {
    const nodes = new Map(this.nav.nodes.map((n) => [n.id, n]));
    for (const s of this.nav.stations) {
      const n = nodes.get(s.nodeId)!;
      const c = STATION_COLOR[s.type];
      const g = new THREE.Group();
      const pos = new THREE.Vector3(...toScene(n.x, n.y, 0));
      g.position.copy(pos);
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.75, 0.08, 28),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4 }),
      );
      ring.position.y = 0.06;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8),
        new THREE.MeshStandardMaterial({ color: '#334155' }),
      );
      pole.position.y = 0.95;
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 0.7, 4),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 }),
      );
      head.rotation.x = Math.PI;
      head.rotation.y = Math.PI / 4;
      head.position.y = 2.15;
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.25, 0.06, 8, 40),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.12;
      halo.visible = false;
      const label = labelSprite(s.id, { size: 44 });
      label.position.y = 3.2;
      label.userData.baseH = 1;
      label.renderOrder = 5;
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 3.4, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.y = 1.7;
      hit.userData.stationId = s.id;
      g.add(ring, pole, head, halo, label, hit);
      this.root.add(g);
      this.hits.push(hit);
      this.stations.set(s.id, { group: g, ring, halo, label, pos, type: s.type });
      this.stationPos.set(s.id, pos.clone());
    }
  }

  setTraffic(t: Record<string, TrafficZoneState>) {
    this.traffic = t;
  }
  setSelected(id: string | null) {
    this.selected = id;
    this.stations.forEach((s, k) => {
      s.halo.visible = k === id;
    });
  }
  setFleet(fleetId: string) {
    this.laneGroups.forEach((objs, key) => {
      const nav = this.nav;
      const vis =
        fleetId === 'all' ||
        key === fleetId ||
        (key === 'shared' && nav.lanes.some((l) => l.fleets.length > 1 && l.fleets.includes(fleetId)));
      objs.forEach((o) => (o.visible = vis));
    });
    this.stations.forEach((s, id) => {
      const st = this.nav.stations.find((q) => q.id === id)!;
      s.group.visible = fleetId === 'all' || st.fleets.includes(fleetId) || id === this.selected;
    });
  }

  /** `lens` = how much further away the camera is than in the 3D view (the plan view uses a narrow lens), so the same sizes and fade distances apply. */
  tick(time: number, camera: THREE.Camera, lens = 1) {
    this.tz.forEach((o, id) => {
      const st = this.traffic[id];
      const occ = st?.occupants.length ?? 0,
        wait = st?.waiting.length ?? 0;
      const over = !!st?.over;
      const mat = o.fill.material as THREE.MeshBasicMaterial,
        em = o.edge.material as THREE.LineBasicMaterial;
      const pulse = 0.5 + 0.5 * Math.sin(time * 6);
      const color = over ? '#d946ef' : wait ? '#ef4444' : occ ? '#f97316' : '#f59e0b';
      mat.color.set(color);
      em.color.set(color);
      mat.opacity = over ? 0.6 : wait ? 0.35 + 0.2 * pulse : occ ? 0.38 : 0.14;
      const d = camera.position.distanceTo(o.center) / lens;
      o.label.sprite.visible = occ > 0 || wait > 0 || d < 75;
      const cap = st?.zone.capacity ?? 1;
      o.label.set(
        wait
          ? copy.labels3d.zoneWaiting(id, occ, cap, wait)
          : occ
            ? copy.labels3d.zoneOccupied(id, occ, cap)
            : copy.labels3d.zoneFree(id),
        over
          ? 'rgba(162,28,175,.92)'
          : wait
            ? 'rgba(185,28,28,.92)'
            : occ
              ? 'rgba(194,65,12,.92)'
              : 'rgba(15,27,36,.82)',
      );
      const k = THREE.MathUtils.clamp(d * 0.022, 2.4, 9);
      o.label.sprite.scale.set(k * 1.45, (k * 1.45) / o.label.sprite.userData.aspect, 1);
    });
    this.stations.forEach((s, id) => {
      const d = camera.position.distanceTo(s.pos) / lens;
      const sel = id === this.selected;
      const k = THREE.MathUtils.clamp(d * 0.009, 0.55, 2.2);
      s.label.visible = sel || d < 130;
      s.label.scale.set(k * 1.7 * s.label.userData.aspect * 0.5, k * 0.85, 1);
      s.ring.scale.setScalar(sel ? 1.25 + 0.15 * Math.sin(time * 4) : 1);
      if (sel) s.halo.scale.setScalar(1 + 0.1 * Math.sin(time * 4));
    });
    this.fzLabels.forEach((l) => {
      l.visible = camera.position.distanceTo(l.position) / lens < 140;
    });
  }
  pick(ray: THREE.Raycaster): string | null {
    const h = ray.intersectObjects(
      this.hits.filter((m) => m.parent?.visible),
      false,
    )[0];
    return h ? (h.object.userData.stationId as string) : null;
  }
}
