import type { MapData } from '../types';
import { DEFAULTS, DOOR_WIDTH, PALETTE } from './palette';
import {
  emptyModel,
  type BoxElement,
  type ElementKind,
  type MapModel3d,
  type P,
  type Section,
  type StructureElement,
} from './types';

/** Pure edits of the 3D structure (the draft's `model3d`). Each returns a NEW MapData; the lidar estimate (`structure`) is never changed. */
const round = (v: number) => Math.round(v * 100) / 100;
const rp = (p: P): P => [round(p[0]), round(p[1])];

export const modelOf = (data: MapData): MapModel3d => data.model3d ?? emptyModel();
const withModel = (data: MapData, f: (m: MapModel3d) => MapModel3d): MapData => ({
  ...data,
  model3d: f(modelOf(data)),
});
export const elementOf = (data: MapData, id: string): StructureElement | undefined =>
  modelOf(data).elements.find((e) => e.id === id);

const nextNumber = (ids: string[], prefix: string) =>
  Math.max(0, ...ids.map((i) => (i.startsWith(prefix) ? parseInt(i.slice(prefix.length), 10) || 0 : 0))) + 1;
const nextId = (data: MapData) =>
  `E${nextNumber(
    modelOf(data).elements.map((e) => e.id),
    'E',
  )}`;
const append = (data: MapData, el: StructureElement): { data: MapData; id: string } => ({
  id: el.id,
  data: withModel(data, (m) => ({ ...m, elements: [...m.elements, el] })),
});

const nameOf = (data: MapData, kind: ElementKind) =>
  `${kind[0].toUpperCase()}${kind.slice(1)} ${modelOf(data).elements.filter((e) => e.kind === kind).length + 1}`;

/** A wall or a partition along `points` (at least two). */
export function addLine(
  data: MapData,
  kind: 'wall' | 'partition',
  points: P[],
  extra: Partial<StructureElement> = {},
): { data: MapData; id: string | null } {
  const pts = points.reduce<P[]>(
    (a, p) => (a.length && Math.hypot(p[0] - a[a.length - 1][0], p[1] - a[a.length - 1][1]) < 0.05 ? a : [...a, rp(p)]),
    [],
  );
  if (pts.length < 2) return { data, id: null };
  const d = DEFAULTS[kind];
  return append(data, {
    id: nextId(data),
    kind,
    points: pts,
    thickness: d.thickness,
    height: d.height,
    name: nameOf(data, kind),
    ...extra,
  } as StructureElement);
}
/** A machine or a pillar standing between two opposite corners (not turned). */
export function addBox(
  data: MapData,
  kind: 'machine' | 'pillar',
  a: P,
  b: P,
  extra: Partial<BoxElement> = {},
): { data: MapData; id: string | null } {
  const w = Math.abs(b[0] - a[0]),
    d = Math.abs(b[1] - a[1]);
  if (w < 0.1 || d < 0.1) return { data, id: null };
  return append(data, {
    id: nextId(data),
    kind,
    x: round((a[0] + b[0]) / 2),
    y: round((a[1] + b[1]) / 2),
    w: round(w),
    d: round(d),
    rot: 0,
    height: DEFAULTS[kind].height,
    name: nameOf(data, kind),
    ...extra,
  });
}
/** Four walls round a rectangle, as one closed line. */
export function addRoom(data: MapData, a: P, b: P): { data: MapData; id: string | null } {
  if (Math.abs(b[0] - a[0]) < 0.5 || Math.abs(b[1] - a[1]) < 0.5) return { data, id: null };
  return addLine(data, 'wall', [a, [b[0], a[1]], b, [a[0], b[1]], a], { name: nameOf(data, 'wall') });
}
/** A floor area (height 0) or an extrusion of any outline. */
export function addArea(data: MapData, points: P[], height = 0): { data: MapData; id: string | null } {
  if (points.length < 3) return { data, id: null };
  return append(data, {
    id: nextId(data),
    kind: 'area',
    points: points.map(rp),
    height,
    name: nameOf(data, 'area'),
  });
}

/** The wall or partition segment nearest to `at` (within `within` m), with where on it and the way it runs. */
export function nearestWallSegment(data: MapData, at: P, within = 1.2) {
  let best: { id: string; at: P; rot: number; d: number } | null = null;
  for (const e of modelOf(data).elements) {
    if (e.kind !== 'wall' && e.kind !== 'partition') continue;
    for (let i = 1; i < e.points.length; i++) {
      const [ax, ay] = e.points[i - 1],
        [bx, by] = e.points[i];
      const dx = bx - ax,
        dy = by - ay,
        l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((at[0] - ax) * dx + (at[1] - ay) * dy) / l2)) : 0;
      const q: P = [ax + t * dx, ay + t * dy];
      const d = Math.hypot(at[0] - q[0], at[1] - q[1]);
      if (d <= within && (!best || d < best.d)) best = { id: e.id, at: q, rot: Math.atan2(dy, dx), d };
    }
  }
  return best;
}
/** A door where a wall or partition is clicked. Null when no wall is near. */
export function addDoor(data: MapData, at: P): { data: MapData; id: string | null } {
  const near = nearestWallSegment(data, at);
  if (!near) return { data, id: null };
  return append(data, {
    id: nextId(data),
    kind: 'door',
    x: round(near.at[0]),
    y: round(near.at[1]),
    w: DOOR_WIDTH,
    rot: near.rot,
    height: DEFAULTS.door.height,
    name: nameOf(data, 'door'),
  });
}

export function updateElement(data: MapData, id: string, patch: Partial<StructureElement>): MapData {
  return withModel(data, (m) => ({
    ...m,
    elements: m.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as StructureElement) : e)),
  }));
}
export const deleteElements = (data: MapData, ids: string[]): MapData =>
  withModel(data, (m) => ({ ...m, elements: m.elements.filter((e) => !ids.includes(e.id)) }));
const shift = (e: StructureElement, dx: number, dy: number): StructureElement =>
  'points' in e
    ? { ...e, points: e.points.map((p) => rp([p[0] + dx, p[1] + dy])) }
    : ({ ...e, x: round(e.x + dx), y: round(e.y + dy) } as StructureElement);
export function moveElement(data: MapData, id: string, dx: number, dy: number): MapData {
  return withModel(data, (m) => ({ ...m, elements: m.elements.map((e) => (e.id === id ? shift(e, dx, dy) : e)) }));
}
/** Move one point of a wall, partition or area. */
export function setPoint(data: MapData, id: string, index: number, to: P): MapData {
  return withModel(data, (m) => ({
    ...m,
    elements: m.elements.map((e) =>
      e.id === id && 'points' in e && index >= 0 && index < e.points.length
        ? { ...e, points: e.points.map((p, i) => (i === index ? rp(to) : p)) }
        : e,
    ),
  }));
}
/** A copy of an element, moved a little so it can be told from the first. */
export function duplicateElement(data: MapData, id: string, by: P = [1, 1]): { data: MapData; id: string | null } {
  const e = elementOf(data, id);
  if (!e) return { data, id: null };
  return append(data, { ...shift(e, by[0], by[1]), id: nextId(data), name: e.name ? `${e.name} copy` : undefined });
}

// ---------- sections ----------
export function addSection(data: MapData, name: string, color: string): { data: MapData; id: string } {
  const m = modelOf(data);
  const id = `S${nextNumber(
    m.sections.map((s) => s.id),
    'S',
  )}`;
  const s: Section = { id, name: name.trim() || `Section ${m.sections.length + 1}`, color, label: true };
  return { id, data: withModel(data, (x) => ({ ...x, sections: [...x.sections, s] })) };
}
export const updateSection = (data: MapData, id: string, patch: Partial<Omit<Section, 'id'>>): MapData =>
  withModel(data, (m) => ({ ...m, sections: m.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
/** Delete a section: its elements stay, without a section. */
export const deleteSection = (data: MapData, id: string): MapData =>
  withModel(data, (m) => ({
    sections: m.sections.filter((s) => s.id !== id),
    elements: m.elements.map((e) => (e.section === id ? { ...e, section: undefined } : e)),
    hiddenWalls: m.hiddenWalls,
    hiddenEquipment: m.hiddenEquipment,
  }));
export const setSection = (data: MapData, ids: string[], section: string | undefined): MapData =>
  withModel(data, (m) => ({ ...m, elements: m.elements.map((e) => (ids.includes(e.id) ? { ...e, section } : e)) }));

/** A new point on a wall, partition or area where it was double-clicked (between the two points of the nearest piece). Returns the new point's index. */
export function insertPoint(data: MapData, id: string, at: P): { data: MapData; index: number } {
  const e = elementOf(data, id);
  if (!e || !('points' in e)) return { data, index: -1 };
  const pts = e.points;
  const n = e.kind === 'area' ? pts.length : pts.length - 1; // an area's outline closes on its first point
  let best = 0,
    bd = Infinity;
  for (let i = 0; i < n; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dy) / l2)) : 0;
    const d = Math.hypot(at[0] - (a[0] + t * dx), at[1] - (a[1] + t * dy));
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  const next = [...pts.slice(0, best + 1), rp(at), ...pts.slice(best + 1)];
  return { index: best + 1, data: updateElement(data, id, { points: next } as Partial<StructureElement>) };
}
/** Remove one point of a wall, partition or area (a line keeps two, an area three). */
export function deletePoint(data: MapData, id: string, index: number): MapData {
  const e = elementOf(data, id);
  if (!e || !('points' in e) || e.points.length <= (e.kind === 'area' ? 3 : 2)) return data;
  return updateElement(data, id, { points: e.points.filter((_, i) => i !== index) } as Partial<StructureElement>);
}
/** Change a block's place and size (a machine or a pillar). */
export const setBox = (
  data: MapData,
  id: string,
  b: { x: number; y: number; w: number; d: number; rot: number },
): MapData =>
  updateElement(data, id, {
    x: round(b.x),
    y: round(b.y),
    w: round(b.w),
    d: round(b.d),
    rot: round(b.rot * 1000) / 1000,
  } as Partial<StructureElement>);

/** A Work area: a named, coloured part of the floor. It starts with the next colour of the palette that no other work area has. */
export function addWorkArea(data: MapData, points: P[]): { data: MapData; id: string | null } {
  if (points.length < 3) return { data, id: null };
  const works = modelOf(data).elements.filter((e) => e.kind === 'area' && e.work);
  const used = new Set(works.map((e) => e.color));
  const color = (PALETTE.find((p) => !used.has(p.color)) ?? PALETTE[works.length % PALETTE.length]).color;
  const name = `Work area ${works.length + 1}`;
  return append(data, {
    id: nextId(data),
    kind: 'area',
    work: true,
    points: points.map(rp),
    height: 0,
    color,
    name,
    label: name,
  });
}

/** The same change for several elements at once (a colour, a section, a height). */
export const updateElements = (data: MapData, ids: string[], patch: Partial<StructureElement>): MapData =>
  withModel(data, (m) => ({
    ...m,
    elements: m.elements.map((e) => (ids.includes(e.id) ? ({ ...e, ...patch } as StructureElement) : e)),
  }));
/** Moves several elements together. */
export const moveElements = (data: MapData, ids: string[], dx: number, dy: number): MapData =>
  ids.reduce((d, id) => moveElement(d, id, dx, dy), data);
