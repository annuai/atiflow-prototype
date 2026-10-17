import * as THREE from 'three';
import { toScene } from '../core/coords';
import type { NavGraph, SiteLayout, Zone } from '../core/types';
import { labelSprite } from './labels';
import { RulesLayer, SHARED_COLOR } from './rulesLayer';
import { CollisionWorld } from './walk';
import { localized } from '@/i18n';

const copy = localized('floor');
const KIND_COLOR: Record<string, number> = { 'smt-machine': 0x7e9a94, equipment: 0x9aa9a5, workstation: 0xb4beba };
const MUTED = 0xcfd5d3;

/**
 * One map as it is drawn: everything under ONE group (the building, its outline for the plan view, the zones and their labels, and the lane / station / traffic layer), the lookups that go
 * with it, and `dispose()`. Nothing here knows about the camera, robots or the page: an Engine (or a SceneManager holding several) adds `group` to its scene and calls `dispose()` when the
 * scene is dropped. See docs/design/map-scenes.md.
 */
export interface LoadedScene {
  group: THREE.Group;
  /** collision against the walls and machines (walk mode) */
  world: CollisionWorld;
  /** lanes, traffic zones, no-go zones and stations */
  rules: RulesLayer;
  zoneMeshes: { zone: Zone; mesh: THREE.Mesh; edge: THREE.LineLoop }[];
  zoneLabels: THREE.Sprite[];
  /** outlines of walls and machines, shown only in the plan view */
  planLines: THREE.LineSegments;
  /** what the Equipment / Zones / Labels layer switches show and hide */
  layers: { equipment: THREE.Object3D[]; zones: THREE.Object3D[]; labels: THREE.Object3D[] };
  /** the building's middle and size in metres (for framing the camera) */
  frame: { cx: number; cy: number; W: number; D: number };
  /** Frees every geometry, material and texture this scene created, and takes the group out of its parent. Safe to call twice. */
  dispose(): void;
}

/** Frees everything below `root`: geometries, materials and the textures they hold. */
export function disposeTree(root: THREE.Object3D) {
  const seen = new Set<unknown>();
  const free = (o: { dispose(): void }) => {
    if (seen.has(o)) return;
    seen.add(o);
    o.dispose();
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) free(m.geometry);
    const mats = (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) as THREE.Material[];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) free(v);
      free(mat);
    }
    if ((o as THREE.InstancedMesh).isInstancedMesh) free(o as THREE.InstancedMesh);
  });
  root.removeFromParent();
}

export function renderScene(site: SiteLayout, nav: NavGraph, opts: { plan: boolean }): LoadedScene {
  const group = new THREE.Group();
  const layers: LoadedScene['layers'] = { equipment: [], zones: [], labels: [] };
  const world = new CollisionWorld(site);
  const B = site.bounds;
  const cx = (B.minX + B.maxX) / 2,
    cy = (B.minY + B.maxY) / 2,
    W = B.maxX - B.minX,
    D = B.maxY - B.minY;
  const inActive = (x: number, y: number) =>
    site.zones.some(
      (z) => z.active && x >= z.polygon[0][0] && x <= z.polygon[2][0] && y >= z.polygon[0][1] && y <= z.polygon[2][1],
    );

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshStandardMaterial({ color: 0xe6ebe9, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, -0.05, -cy);
  ground.receiveShadow = true;
  group.add(ground);
  for (const poly of site.floorPolygons) {
    const sh = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
    const m = new THREE.Mesh(
      new THREE.ShapeGeometry(sh),
      new THREE.MeshStandardMaterial({ color: 0xf7f9f8, roughness: 0.95 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.scale.set(1, 1, 1);
    m.position.y = 0;
    m.receiveShadow = true;
    // ShapeGeometry lies in XY; rotating about X maps y -> -z, which matches toScene.
    group.add(m);
  }
  const grid = new THREE.GridHelper(Math.max(W, D) * 1.1, Math.round(Math.max(W, D) / 5), 0xd5dcda, 0xe3e8e6);
  grid.position.set(cx, 0.02, -cy);
  (grid.material as THREE.Material).opacity = 0.5;
  (grid.material as THREE.Material).transparent = true;
  group.add(grid);

  // walls (instanced)
  const wallMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    site.walls.length,
  );
  const m4 = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    col = new THREE.Color();
  site.walls.forEach((w, i) => {
    const dx = w.b[0] - w.a[0],
      dy = w.b[1] - w.a[1],
      L = Math.hypot(dx, dy),
      th = Math.max(w.t, 0.14);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dy, dx));
    m4.compose(
      new THREE.Vector3(...toScene((w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2, w.h / 2)),
      q,
      new THREE.Vector3(L + th, w.h, th),
    );
    wallMesh.setMatrixAt(i, m4);
    const act = inActive((w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2);
    wallMesh.setColorAt(i, col.set(w.layer === 'shell' ? 0x9aa6a2 : act ? 0x44534e : MUTED));
  });
  wallMesh.castShadow = wallMesh.receiveShadow = true;
  group.add(wallMesh);

  // equipment (instanced)
  const eq = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    site.equipment.length,
  );
  site.equipment.forEach((e, i) => {
    m4.compose(
      new THREE.Vector3(...toScene(e.x, e.y, e.h / 2)),
      new THREE.Quaternion(),
      new THREE.Vector3(e.w, e.h, e.d),
    );
    eq.setMatrixAt(i, m4);
    eq.setColorAt(i, col.set(KIND_COLOR[e.kind] ?? 0x9aa9a5));
  });
  eq.castShadow = eq.receiveShadow = true;
  group.add(eq);
  layers.equipment.push(eq);
  // outlines of walls and machines, drawn only in the plan view (flat drawings need crisp edges, shading does not exist there)
  const lines: number[] = [];
  const edge = (a: [number, number], b: [number, number], z: number) => {
    lines.push(...toScene(a[0], a[1], z), ...toScene(b[0], b[1], z));
  };
  const box = (bx: number, by: number, w: number, d: number, th: number, z: number) => {
    const c = Math.cos(th),
      sn = Math.sin(th);
    const P = (
      [
        [-w, -d],
        [w, -d],
        [w, d],
        [-w, d],
      ] as [number, number][]
    ).map(([x, y]): [number, number] => [bx + (x * c - y * sn) / 2, by + (x * sn + y * c) / 2]);
    for (let i = 0; i < 4; i++) edge(P[i], P[(i + 1) % 4], z);
  };
  site.equipment.forEach((e) => box(e.x, e.y, e.w, e.d, 0, e.h + 0.04));
  site.walls.forEach((w) => {
    const th = Math.max(w.t, 0.14);
    box(
      (w.a[0] + w.b[0]) / 2,
      (w.a[1] + w.b[1]) / 2,
      Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) + th,
      th,
      Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]),
      w.h + 0.04,
    );
  });
  const planLines = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)),
    new THREE.LineBasicMaterial({ color: 0x3d4a46, transparent: true, opacity: 0.75 }),
  );
  planLines.visible = opts.plan;
  planLines.frustumCulled = false;
  group.add(planLines);

  // zones
  const zoneMeshes: LoadedScene['zoneMeshes'] = [];
  const zoneLabels: THREE.Sprite[] = [];
  for (const z of site.zones) {
    const owners = nav.fleets.filter((f) => f.areas.includes(z.id));
    z.color = owners.length > 1 ? SHARED_COLOR : (owners[0]?.color ?? z.color); // map area tint = owning fleet; shared area = indigo
    const sh = new THREE.Shape(z.polygon.map(([x, y]) => new THREE.Vector2(x, y)));
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(sh),
      new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.1, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.05;
    const pts = z.polygon.map(([x, y]) => new THREE.Vector3(...toScene(x, y, 0.08)));
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: z.color, transparent: true, opacity: 0.9 }),
    );
    group.add(mesh, outline);
    zoneMeshes.push({ zone: z, mesh, edge: outline });
    layers.zones.push(mesh, outline);
    const lb = labelSprite(owners.length > 1 ? copy.labels3d.shared(z.name) : z.name, { size: 52 });
    const zx = (z.polygon[0][0] + z.polygon[2][0]) / 2,
      zy = (z.polygon[0][1] + z.polygon[2][1]) / 2;
    lb.position.set(...toScene(zx, zy, 6));
    lb.scale.set((18 * lb.userData.aspect) / 3.4, 18 / 3.4, 1);
    group.add(lb);
    zoneLabels.push(lb);
    layers.labels.push(lb);
  }
  const rules = new RulesLayer(group, site, nav);

  return {
    group,
    world,
    rules,
    zoneMeshes,
    zoneLabels,
    planLines,
    layers,
    frame: { cx, cy, W, D },
    dispose: () => disposeTree(group),
  };
}
