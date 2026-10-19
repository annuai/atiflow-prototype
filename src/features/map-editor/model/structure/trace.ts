import type { MapData } from '../types';
import { DEFAULTS } from './palette';
import { modelOf } from './ops';
import type { P, StructureElement } from './types';

/**
 * The lidar estimate (`MapData.structure`) as something to pick from: click a wall of the estimate to turn it into a wall of our own (the estimate's one is then hidden, so nothing is drawn
 * twice), or sweep a rectangle to remove what is inside it. The estimate itself is never changed: the hidden lists say what is not shown, and restoring is clearing them.
 */
const round = (v: number) => Math.round(v * 100) / 100;
const segDist = (p: P, a: P, b: P) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};
const nextNumber = (data: MapData) =>
  Math.max(0, ...modelOf(data).elements.map((e) => parseInt(e.id.replace(/\D/g, ''), 10) || 0)) + 1;

/** Index of the estimate wall nearest to `at` (within `within` m) that is still shown, or -1. */
export function nearestEstimateWall(data: MapData, at: P, within = 1): number {
  const hidden = new Set(modelOf(data).hiddenWalls);
  let best = -1,
    bd = within;
  (data.structure?.walls ?? []).forEach((w, i) => {
    if (hidden.has(i)) return;
    const d = segDist(at, w.a, w.b);
    if (d <= bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
/** Index of the estimate machine whose block holds (or is nearest to, within `within`) `at`, or -1. */
export function nearestEstimateMachine(data: MapData, at: P, within = 0.6): number {
  const hidden = new Set(modelOf(data).hiddenEquipment);
  let best = -1,
    bd = within;
  (data.structure?.equipment ?? []).forEach((q, i) => {
    if (hidden.has(i)) return;
    const d = Math.hypot(Math.max(Math.abs(at[0] - q.x) - q.w / 2, 0), Math.max(Math.abs(at[1] - q.y) - q.d / 2, 0));
    if (d <= bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

const wallElement = (data: MapData, index: number, n: number): StructureElement | null => {
  const w = data.structure?.walls[index];
  if (!w) return null;
  return {
    id: `E${n}`,
    kind: 'wall',
    points: [
      [round(w.a[0]), round(w.a[1])],
      [round(w.b[0]), round(w.b[1])],
    ],
    thickness: round(Math.max(w.t, 0.1)),
    height: w.h || DEFAULTS.wall.height,
    name: `Wall ${n}`,
  };
};
const machineElement = (data: MapData, index: number, n: number): StructureElement | null => {
  const q = data.structure?.equipment[index];
  if (!q) return null;
  return {
    id: `E${n}`,
    kind: 'machine',
    x: round(q.x),
    y: round(q.y),
    w: round(q.w),
    d: round(q.d),
    rot: 0,
    height: q.h || DEFAULTS.machine.height,
    name: `Machine ${n}`,
  };
};

/** Turn estimate walls into walls of our own (the estimate's are hidden). Returns the new ids. */
export function traceWalls(data: MapData, indexes: number[]): { data: MapData; ids: string[] } {
  const m = modelOf(data);
  const hidden = new Set(m.hiddenWalls);
  const made: StructureElement[] = [];
  let n = nextNumber(data);
  for (const i of indexes) {
    if (hidden.has(i)) continue;
    const e = wallElement(data, i, n);
    if (!e) continue;
    made.push({ ...e, traced: true } as StructureElement);
    hidden.add(i);
    n++;
  }
  return {
    ids: made.map((e) => e.id),
    data: { ...data, model3d: { ...m, elements: [...m.elements, ...made], hiddenWalls: [...hidden] } },
  };
}
export function traceMachines(data: MapData, indexes: number[]): { data: MapData; ids: string[] } {
  const m = modelOf(data);
  const hidden = new Set(m.hiddenEquipment);
  const made: StructureElement[] = [];
  let n = nextNumber(data);
  for (const i of indexes) {
    if (hidden.has(i)) continue;
    const e = machineElement(data, i, n);
    if (!e) continue;
    made.push({ ...e, traced: true } as StructureElement);
    hidden.add(i);
    n++;
  }
  return {
    ids: made.map((e) => e.id),
    data: { ...data, model3d: { ...m, elements: [...m.elements, ...made], hiddenEquipment: [...hidden] } },
  };
}
/** Every wall and machine of the estimate that is still shown becomes an element of our own. */
export function traceAll(data: MapData): MapData {
  const hw = new Set(modelOf(data).hiddenWalls),
    he = new Set(modelOf(data).hiddenEquipment);
  const walls = (data.structure?.walls ?? []).map((_, i) => i).filter((i) => !hw.has(i));
  const machines = (data.structure?.equipment ?? []).map((_, i) => i).filter((i) => !he.has(i));
  return traceMachines(traceWalls(data, walls).data, machines).data;
}

/** Remove what is inside a rectangle: estimate walls and machines are hidden, elements that lie wholly inside it are deleted. */
export function eraseRect(data: MapData, a: P, b: P): MapData {
  const x0 = Math.min(a[0], b[0]),
    x1 = Math.max(a[0], b[0]),
    y0 = Math.min(a[1], b[1]),
    y1 = Math.max(a[1], b[1]);
  const inside = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const m = modelOf(data);
  const hw = new Set(m.hiddenWalls),
    he = new Set(m.hiddenEquipment);
  (data.structure?.walls ?? []).forEach((w, i) => {
    if (inside(w.a[0], w.a[1]) && inside(w.b[0], w.b[1])) hw.add(i);
  });
  (data.structure?.equipment ?? []).forEach((q, i) => {
    if (inside(q.x, q.y)) he.add(i);
  });
  const whole = (e: StructureElement) => ('points' in e ? e.points.every((p) => inside(p[0], p[1])) : inside(e.x, e.y));
  return {
    ...data,
    model3d: { ...m, elements: m.elements.filter((e) => !whole(e)), hiddenWalls: [...hw], hiddenEquipment: [...he] },
  };
}
/** Bring the whole estimate back. */
export const restoreEstimate = (data: MapData): MapData => ({
  ...data,
  model3d: { ...modelOf(data), hiddenWalls: [], hiddenEquipment: [] },
});
