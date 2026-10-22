import type { Equipment, Shape3d, SiteLayout, Wall, Zone } from '@/core/types';
import type { MapData } from '../types';
import { DEFAULTS } from './palette';
import { cellBoxes } from '../staging';
import { modelOf } from './ops';
import type { LineElement, P, StructureElement } from './types';

/**
 * What the 3D scene draws for a map: the lidar estimate that has not been hidden, plus the elements, as the walls, machines, shapes and labels the 3D engine already knows. A door cuts the wall
 * it is on (with the wall still above it), a colour comes from the element, else the kind's own. Pure.
 */
export interface StructureSite {
  walls: Wall[];
  equipment: Equipment[];
  shapes: Shape3d[];
  labels: NonNullable<SiteLayout['labels']>;
  /** the Work areas */
  zones: Zone[];
}

const colorOf = (e: StructureElement) => e.color ?? DEFAULTS[e.kind].color;
/** The colour an element is shown in: its own, else its kind's. */
export const elementColor = (_data: MapData, e: StructureElement): string => colorOf(e);
const len = (a: P, b: P) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** The pieces of one wall segment once the doors on it are cut out: what is left either side, and the wall left above each opening. */
function cutSegment(w: Wall, doors: Extract<StructureElement, { kind: 'door' }>[]): Wall[] {
  const L = len(w.a, w.b);
  if (L < 0.05) return [w];
  const ux = (w.b[0] - w.a[0]) / L,
    uy = (w.b[1] - w.a[1]) / L;
  const spans: { s: number; e: number; h: number }[] = [];
  for (const d of doors) {
    const s = (d.x - w.a[0]) * ux + (d.y - w.a[1]) * uy;
    const off = Math.abs(-(d.x - w.a[0]) * uy + (d.y - w.a[1]) * ux);
    const turn = Math.abs(Math.sin(d.rot - Math.atan2(uy, ux)));
    if (off <= Math.max(w.t / 2, 0.3) + 0.15 && turn < 0.3 && s > -d.w / 2 && s < L + d.w / 2)
      spans.push({ s: Math.max(0, s - d.w / 2), e: Math.min(L, s + d.w / 2), h: d.height });
  }
  if (!spans.length) return [w];
  spans.sort((a, b) => a.s - b.s);
  const out: Wall[] = [];
  const piece = (s0: number, s1: number, base: number, h: number) => {
    if (s1 - s0 < 0.05 || h < 0.05) return;
    out.push({ ...w, a: [w.a[0] + ux * s0, w.a[1] + uy * s0], b: [w.a[0] + ux * s1, w.a[1] + uy * s1], base, h });
  };
  let at = 0;
  for (const sp of spans) {
    piece(at, sp.s, w.base ?? 0, w.h);
    piece(sp.s, sp.e, (w.base ?? 0) + sp.h, w.h - sp.h); // the wall above the opening
    at = Math.max(at, sp.e);
  }
  piece(at, L, w.base ?? 0, w.h);
  return out;
}

/** The text shown on top of a machine or pillar: its own text, else its name (a machine traced from the scan only has an automatic name, which is not shown). */
export const shownText = (e: StructureElement): string | undefined =>
  e.label?.trim() || (e.traced || e.fromSite || e.fromDrawing ? undefined : e.name?.trim()) || undefined;

export function structureSite(data: MapData): StructureSite {
  const m = modelOf(data);
  const hiddenW = new Set(m.hiddenWalls),
    hiddenE = new Set(m.hiddenEquipment);
  const walls: Wall[] = (data.structure?.walls ?? []).filter((_, i) => !hiddenW.has(i));
  const equipment: Equipment[] = (data.structure?.equipment ?? []).filter((_, i) => !hiddenE.has(i));
  const shapes: Shape3d[] = [];
  const labels: StructureSite['labels'] = [];
  const zones: Zone[] = [];
  const doors = m.elements.filter((e): e is Extract<StructureElement, { kind: 'door' }> => e.kind === 'door');
  const lit = (e: StructureElement) => ({
    color: colorOf(e),
    ...(e.opacity !== undefined ? { opacity: e.opacity } : {}),
    id: e.id,
  });
  for (const a of data.stagingAreas)
    for (const c of cellBoxes(a)) equipment.push({ kind: 'staging', layer: 'staging', color: '#7dd3fc', ...c }); // cells stand apart like a table without a frame
  for (const e of m.elements) {
    const top = (e.base ?? 0) + e.height;
    if (e.kind === 'wall' || e.kind === 'partition') {
      for (let i = 1; i < e.points.length; i++) {
        const seg: Wall = {
          a: e.points[i - 1],
          b: e.points[i],
          t: e.thickness,
          h: e.height,
          layer: e.kind,
          ...(e.base ? { base: e.base } : {}),
          ...lit(e),
        };
        walls.push(...cutSegment(seg, doors));
      }
    } else if (e.kind === 'machine' || e.kind === 'pillar') {
      equipment.push({
        kind: e.kind,
        x: e.x,
        y: e.y,
        w: e.w,
        d: e.d,
        h: e.height,
        layer: e.kind,
        rot: e.rot,
        ...(e.base ? { base: e.base } : {}),
        ...(shownText(e) ? { label: shownText(e) } : {}),
        ...lit(e),
      });
    } else if (e.kind === 'area' && e.work) {
      zones.push({
        id: e.fromZone ?? e.id,
        name: e.label?.trim() || e.name || e.id,
        kind: 'work',
        active: true,
        color: colorOf(e),
        polygon: e.points,
        own: true,
      });
    } else if (e.kind === 'area') {
      shapes.push({ points: e.points, height: e.height, ...(e.base ? { base: e.base } : {}), ...lit(e) });
      if (e.label) {
        const c = e.points.reduce<P>((a, p) => [a[0] + p[0] / e.points.length, a[1] + p[1] / e.points.length], [0, 0]);
        labels.push({ text: e.label, x: c[0], y: c[1], z: top + 0.5 });
      }
    }
  }
  return { walls, equipment, shapes, labels, zones };
}
export const lineElements = (data: MapData): LineElement[] =>
  modelOf(data).elements.filter((e): e is LineElement => e.kind === 'wall' || e.kind === 'partition');
