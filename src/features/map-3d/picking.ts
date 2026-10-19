import * as THREE from 'three';
import type { Engine } from '@/engine/Engine';
import type { SiteLayout } from '@/core/types';

/** Things of the scene that stand for an element of the structure: instanced meshes carry `userData.ids` (one id per instance), the others `userData.id`. */
const pickable = (eng: Engine): THREE.Object3D[] => {
  const out: THREE.Object3D[] = [];
  eng.scene.traverse((o) => {
    if (o.userData.ids || o.userData.id) out.push(o);
  });
  return out;
};
const elementOf = (o: THREE.Object3D, instance: number | undefined): string | undefined =>
  o.userData.ids ? o.userData.ids[instance ?? -1] : o.userData.id;

/** The element under a screen point, or null. */
export function pickAt(eng: Engine, clientX: number, clientY: number): string | null {
  const r = eng.renderer.domElement.getBoundingClientRect();
  const ray = new THREE.Raycaster();
  ray.setFromCamera(
    new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1),
    eng.camera,
  );
  const hit = ray.intersectObjects(pickable(eng), false).find((h) => elementOf(h.object, h.instanceId));
  return hit ? (elementOf(hit.object, hit.instanceId) ?? null) : null;
}

/** The elements whose centre lies inside a box dragged on the screen (client coordinates). */
export function elementsInScreenRect(eng: Engine, x0: number, y0: number, x1: number, y1: number): string[] {
  const r = eng.renderer.domElement.getBoundingClientRect();
  const [lx, hx] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [ly, hy] = [Math.min(y0, y1), Math.max(y0, y1)];
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const out = new Set<string>();
  const test = (id: string | undefined, world: THREE.Vector3) => {
    if (!id) return;
    v.copy(world).project(eng.camera);
    const sx = r.left + ((v.x + 1) / 2) * r.width,
      sy = r.top + ((1 - v.y) / 2) * r.height;
    if (v.z < 1 && sx >= lx && sx <= hx && sy >= ly && sy <= hy) out.add(id);
  };
  for (const o of pickable(eng)) {
    o.updateWorldMatrix(true, false);
    if ((o as THREE.InstancedMesh).isInstancedMesh) {
      const ids = o.userData.ids as (string | undefined)[];
      ids.forEach((id, i) => {
        (o as THREE.InstancedMesh).getMatrixAt(i, m);
        m.premultiply(o.matrixWorld);
        test(id, v.setFromMatrixPosition(m).clone());
      });
    } else {
      const box = new THREE.Box3().setFromObject(o);
      test(o.userData.id, box.getCenter(new THREE.Vector3()));
    }
  }
  return [...out];
}

/** A click (not a drag) on the 3D view picks the element under the pointer (or nothing: null; Shift adds). Returns the function that stops listening. */
export function onPick(eng: Engine, pick: (id: string | null, additive: boolean) => void): () => void {
  const el = eng.renderer.domElement;
  let down: { x: number; y: number } | null = null;
  const press = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const release = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return; // a drag turns the view
    pick(pickAt(eng, e.clientX, e.clientY), e.shiftKey);
  };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  return () => {
    el.removeEventListener('pointerdown', press);
    el.removeEventListener('pointerup', release);
  };
}

/** An outline round the selected element (drawn through everything so it can be seen); returns the function that takes it away. `site` changes when the scene is rebuilt. */
export function outline(eng: Engine, id: string | null, site: SiteLayout | null): () => void {
  if (!id || !site) return () => undefined;
  const found = pickable(eng)
    .map((o) => ({
      o,
      i: o.userData.ids ? (o.userData.ids as (string | undefined)[]).indexOf(id) : o.userData.id === id ? 0 : -1,
    }))
    .find((x) => x.i >= 0);
  if (!found) return () => undefined;
  const { o, i } = found;
  const m = new THREE.Matrix4();
  let geo: THREE.BufferGeometry;
  if ((o as THREE.InstancedMesh).isInstancedMesh) {
    (o as THREE.InstancedMesh).getMatrixAt(i, m);
    geo = new THREE.BoxGeometry(1, 1, 1);
  } else {
    geo = (o as THREE.Mesh).geometry;
  }
  o.updateWorldMatrix(true, false);
  m.premultiply(o.matrixWorld);
  const lines = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x0d9488, depthTest: false, transparent: true }),
  );
  lines.matrixAutoUpdate = false;
  lines.matrix.copy(m);
  lines.renderOrder = 10;
  eng.scene.add(lines);
  return () => {
    eng.scene.remove(lines);
    lines.geometry.dispose();
    (lines.material as THREE.Material).dispose();
    if (!(o as THREE.InstancedMesh).isInstancedMesh) return;
    geo.dispose();
  };
}
