import * as THREE from 'three';
import { store } from '../../core/store';
import type { RobotLayer } from './robotLayer';
import type { Stage } from './stage';

/** What is shown: the layer switches, the zone highlight, and the look of the plan view (flat light, outlines, flat robot symbols). */
export class Layers {
  /** the zone under the pointer (lights up) */
  hoverZone: string | null = null;
  constructor(
    private readonly s: Stage,
    private readonly robots: RobotLayer,
  ) {}
  applyLayers() {
    const L = store.getState().layers;
    for (const e of this.s.manager.loaded()) {
      e.scene.layers.equipment.forEach((o) => (o.visible = L.equipment));
      e.scene.layers.zones.forEach((o) => (o.visible = L.zones));
      e.scene.layers.labels.forEach((o) => (o.visible = L.labels));
    }
    this.s.layerGroups.stations.forEach((o) => (o.visible = L.stations));
    const s = store.getState();
    this.robots.applyFilter(s.fleetId, s.query);
  }
  refreshZones() {
    const act = store.getState().activeZoneId;
    for (const z of this.s.active.flatMap((e) => e.scene.zoneMeshes)) {
      const on = z.zone.id === act;
      (z.mesh.material as THREE.MeshBasicMaterial).opacity = on
        ? 0.22
        : z.zone.active
          ? this.hoverZone === z.zone.id
            ? 0.2
            : 0.09
          : 0;
      z.edge.visible = z.zone.active;
    }
  }
  /** The look of the plan view: flat light (no sun, no shadows, no fog), outlines on walls and machines, robots as flat symbols. */
  setPlanLook(on: boolean) {
    if (this.s.plan === on) return;
    this.s.plan = on;
    this.s.sun.intensity = on ? 0 : 2.2;
    this.s.sun.castShadow = !on;
    this.s.hemi.intensity = on ? 3.1 : 2.1;
    this.s.scene.fog = on ? null : new THREE.Fog(0xe6ebe9, 500, 1500);
    this.s.manager.loaded().forEach((e) => (e.scene.planLines.visible = on));
    this.robots.robots.forEach((r) => {
      r.inner.visible = !on;
      r.glyph.visible = on;
      if (r.trolley) this.robots.showTrolleyAs(r.trolley);
    });
  }
}
