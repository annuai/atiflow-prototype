import { localized } from '@/i18n';
import { text } from '../text';
import { degrees } from './shape';
import type { MapData, StagingAreaDef, ZoneShape } from './types';

/** Pure edits and geometry of staging areas: rows x columns of cells laid out from the centre of the A1 cell. */
const round = (v: number) => Math.round(v * 100) / 100;
export const colLetter = (c: number): string => {
  let s = '',
    n = c;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
/** "A1": column letter then row number (both start at 1). */
export const cellRef = (row: number, col: number) => `${colLetter(col)}${row}`;
/** The key Master Data keeps a cell's state under. */
export const cellKey = (row: number, col: number) => `${row}-${col}`;
export const totalCells = (a: Pick<StagingAreaDef, 'rows' | 'cols'>) => a.rows * a.cols;

/** How much further down the rows `row` lies than a grid without aisles puts it: each aisle before it adds its length and one row gap. */
export const aisleShift = (a: Pick<StagingAreaDef, 'aisles' | 'rowGap'>, row: number): number =>
  (a.aisles ?? []).filter((x) => x.after < row).reduce((n, x) => n + x.length + (a.rowGap ?? 0), 0);
/** The height of the rows of an area (m), aisles included: `rows` real rows (default: the area's own count). */
export const rowsSpan = (a: Pick<StagingAreaDef, 'aisles' | 'rowGap' | 'cellWidth' | 'rows'>, rows = a.rows): number =>
  rows * a.cellWidth +
  (rows - 1) * (a.rowGap ?? 0) +
  (a.aisles ?? []).filter((x) => x.after <= rows).reduce((n, x) => n + x.length + (a.rowGap ?? 0), 0);

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Centre of a cell: columns run along the area's direction, rows go to the right-hand side of it ("down" at rotation 0). */
export function cellCenter(a: StagingAreaDef, row: number, col: number): { x: number; y: number } {
  const t = rad(a.rotation),
    dx = Math.cos(t),
    dy = Math.sin(t),
    rx = Math.sin(t),
    ry = -Math.cos(t);
  return {
    x:
      a.x +
      (col - 1) * (a.cellLength + (a.colGap ?? 0)) * dx +
      ((row - 1) * (a.cellWidth + (a.rowGap ?? 0)) + aisleShift(a, row)) * rx,
    y:
      a.y +
      (col - 1) * (a.cellLength + (a.colGap ?? 0)) * dy +
      ((row - 1) * (a.cellWidth + (a.rowGap ?? 0)) + aisleShift(a, row)) * ry,
  };
}
/** The outline of the whole area (four corners). */
export function outline(a: StagingAreaDef): [number, number][] {
  const t = rad(a.rotation),
    dx = Math.cos(t),
    dy = Math.sin(t),
    rx = Math.sin(t),
    ry = -Math.cos(t);
  const l = a.cellLength,
    w = a.cellWidth;
  const lead = aisleShift(a, 1); // an aisle before the first row pushes A1 away from the corner
  const o = { x: a.x - (l / 2) * dx - (w / 2 + lead) * rx, y: a.y - (l / 2) * dy - (w / 2 + lead) * ry };
  const L = a.cols * l + (a.cols - 1) * (a.colGap ?? 0),
    W = rowsSpan(a);
  return [
    [o.x, o.y],
    [o.x + L * dx, o.y + L * dy],
    [o.x + L * dx + W * rx, o.y + L * dy + W * ry],
    [o.x + W * rx, o.y + W * ry],
  ];
}
const nextId = (d: MapData, taken: string[]) =>
  `SA-${String(Math.max(0, ...d.stagingAreas.map((s) => parseInt(s.id.replace(/\D/g, ''), 10) || 0), ...taken.map((s) => parseInt(s.replace(/\D/g, ''), 10) || 0)) + 1).padStart(3, '0')}`;
export function addStagingArea(
  data: MapData,
  at: { x: number; y: number },
  taken: string[] = [],
): { data: MapData; id: string } {
  const id = nextId(data, taken);
  const n = data.stagingAreas.length + 1;
  const a: StagingAreaDef = {
    id,
    name: text.defaultNames.staging(n),
    rotation: 0,
    x: round(at.x),
    y: round(at.y),
    rows: 2,
    cols: 2,
    cellLength: 1.2,
    cellWidth: 1,
    retrieval: 'fifo',
  };
  return { id, data: { ...data, stagingAreas: [...data.stagingAreas, a] } };
}
export const updateStagingArea = (data: MapData, id: string, patch: Partial<Omit<StagingAreaDef, 'id'>>): MapData => ({
  ...data,
  stagingAreas: data.stagingAreas.map((s) => (s.id === id ? { ...s, ...patch } : s)),
});
export const deleteStagingArea = (data: MapData, id: string): MapData => ({
  ...data,
  stagingAreas: data.stagingAreas.filter((s) => s.id !== id),
});
/** What is wrong with the values of an area ('' per field = fine). */
export function stagingProblems(data: MapData, a: StagingAreaDef): Record<string, string> {
  const e: Record<string, string> = {};
  const t = a.name.trim();
  if (!t) e.name = text.nameProblems.staging.empty;
  else if (data.stagingAreas.some((s) => s.id !== a.id && s.name.trim().toLowerCase() === t.toLowerCase()))
    e.name = text.nameProblems.staging.taken;
  if (!Number.isInteger(a.rows) || a.rows < 1 || a.rows > 200) e.rows = text.stagingProblems.rows;
  if (!Number.isInteger(a.cols) || a.cols < 1 || a.cols > 200) e.cols = text.stagingProblems.cols;
  if (!(a.cellLength > 0)) e.cellLength = text.stagingProblems.cellLength;
  if (!(a.cellWidth > 0)) e.cellWidth = text.stagingProblems.cellWidth;
  if (
    (a.aisles ?? []).some(
      (x) => !Number.isInteger(x.after) || x.after < 0 || x.after > a.rows || !Number.isFinite(x.length),
    )
  )
    e.aisles = localized('approach').aisles.problem;
  if (!(a.stationOffset === undefined || (a.stationOffset >= 0 && a.stationOffset <= 20)))
    e.stationOffset = text.stagingProblems.stationOffset;
  return e;
}

type Rect = Extract<ZoneShape, { kind: 'rect' }>;
const spanOf = (n: number, size: number, gap: number) => n * size + (n - 1) * gap;
/** The area as one rectangle (its whole outline), turned by the area's rotation: what the eight resize handles and the rotate handle work on. Its x axis runs along the columns. */
export function stagingRect(a: StagingAreaDef): Rect {
  const t = rad(a.rotation),
    L = spanOf(a.cols, a.cellLength, a.colGap ?? 0),
    W = rowsSpan(a);
  // the centre of A1 sits at local (-L/2 + l/2, +W/2 - w/2 - lead): walk from it back to the middle
  const u = (L - a.cellLength) / 2,
    v = (W - a.cellWidth) / 2 - aisleShift(a, 1);
  return {
    kind: 'rect',
    cx: round(a.x + u * Math.cos(t) + v * Math.sin(t)),
    cy: round(a.y + u * Math.sin(t) - v * Math.cos(t)),
    w: L,
    h: W,
    rot: t,
  };
}

/**
 * What changes in an area when its rectangle is moved, resized or turned by the handles (`from` is the area when the drag began, `r` the rectangle the handles give). A resize only ever adds or
 * removes whole rows and columns (the size of a cell stays): the edge being dragged follows the pointer in steps of one cell, the opposite edge stays where it is.
 */
export function areaFromRect(from: StagingAreaDef, r: Rect): Partial<StagingAreaDef> {
  const f = stagingRect(from);
  const gc = from.colGap ?? 0;
  const snap = (len: number, size: number, gap: number) =>
    Math.min(200, Math.max(1, Math.round((len + gap) / (size + gap))));
  const turned = Math.abs(r.rot - f.rot) > 1e-6;
  const cols = turned ? from.cols : snap(r.w, from.cellLength, gc);
  // the number of rows whose height (aisles included) is nearest to the rectangle's
  const rowsFor = (len: number) =>
    Array.from({ length: 200 }, (_, i) => i + 1).reduce((best, n) =>
      Math.abs(rowsSpan(from, n) - len) < Math.abs(rowsSpan(from, best) - len) ? n : best,
    );
  const rows = turned ? from.rows : rowsFor(r.h);
  const kept = (from.aisles ?? []).filter((x) => x.after <= rows); // an aisle beyond the last row goes with the rows
  const sized = { ...from, rows, aisles: kept };
  const w2 = spanOf(cols, from.cellLength, gc),
    h2 = rowsSpan(sized);
  // the new centre, in the old frame: a moved or turned rectangle keeps the handles' centre; a resized edge keeps its opposite edge still
  const t0 = f.rot,
    dx = r.cx - f.cx,
    dy = r.cy - f.cy;
  let lx = dx * Math.cos(t0) + dy * Math.sin(t0),
    ly = -dx * Math.sin(t0) + dy * Math.cos(t0);
  if (!turned) {
    if (Math.abs(r.w - f.w) > 0.005) lx = Math.abs(lx - (r.w - f.w) / 2) < 0.05 ? (w2 - f.w) / 2 : -(w2 - f.w) / 2;
    if (Math.abs(r.h - f.h) > 0.005) ly = Math.abs(ly - (r.h - f.h) / 2) < 0.05 ? (h2 - f.h) / 2 : -(h2 - f.h) / 2;
  }
  const cx = f.cx + lx * Math.cos(t0) - ly * Math.sin(t0),
    cy = f.cy + lx * Math.sin(t0) + ly * Math.cos(t0);
  const rot = turned ? r.rot : t0,
    u = (w2 - from.cellLength) / 2,
    v = (h2 - from.cellWidth) / 2 - aisleShift(sized, 1);
  return {
    rows,
    cols,
    ...(kept.length !== (from.aisles ?? []).length ? { aisles: kept } : {}),
    rotation: degrees(rot),
    x: round(cx - u * Math.cos(rot) - v * Math.sin(rot)),
    y: round(cy - u * Math.sin(rot) + v * Math.cos(rot)),
  };
}

/** Every cell of an area as a box for the 3D view: a low block (cells stand apart like a table without a frame), turned with the area. */
export const CELL_HEIGHT = 0.25;
export function cellBoxes(a: StagingAreaDef) {
  const out: { x: number; y: number; w: number; d: number; rot: number; h: number }[] = [];
  for (let row = 1; row <= a.rows; row++)
    for (let col = 1; col <= a.cols; col++) {
      const c = cellCenter(a, row, col);
      out.push({ x: c.x, y: c.y, w: a.cellLength, d: a.cellWidth, rot: cellHeadingAt(a, row, col), h: CELL_HEIGHT });
    }
  return out;
}

export { DEFAULT_SEQ, sequenceKeys } from '@/core/cellOrder';

/** The direction the cells face, in radians: the area's rotation plus the cell angle. */
export const cellHeading = (a: Pick<StagingAreaDef, 'rotation' | 'cellAngle'>) => rad(a.rotation + (a.cellAngle ?? 0));
/** What one cell sets for itself (nothing: the area's setting counts). */
export const cellOverride = (a: Pick<StagingAreaDef, 'cellSettings'>, row: number, col: number) =>
  a.cellSettings?.[cellRef(row, col)];
/** The way one cell faces (radians) and how far in front of it its station stands (m): its own setting, else the area's. */
export const cellHeadingAt = (a: StagingAreaDef, row: number, col: number) =>
  rad(a.rotation + (cellOverride(a, row, col)?.angle ?? a.cellAngle ?? 0));
export const cellOffsetAt = (a: StagingAreaDef, row: number, col: number) =>
  cellOverride(a, row, col)?.offset ?? a.stationOffset ?? 0;
/** Cells may tilt at most this far either way; more makes the area unusable. */
export const MAX_CELL_ANGLE = 60;
export const clampCellAngle = (deg: number) => Math.max(-MAX_CELL_ANGLE, Math.min(MAX_CELL_ANGLE, deg));
/** The station of a cell: `stationOffset` metres from the cell's centre along the way the area's direction points (the Deployment Manager's meaning: 0 = at the centre). It faces the way the cell faces. */
export function stationPoint(a: StagingAreaDef, row: number, col: number): { x: number; y: number; heading: number } {
  const c = cellCenter(a, row, col),
    t = rad(a.rotation),
    d = cellOffsetAt(a, row, col);
  return { x: c.x + d * Math.cos(t), y: c.y + d * Math.sin(t), heading: cellHeadingAt(a, row, col) };
}
/** Corners of one cell, turned by the cell angle round the cell's own centre. */
export function cellCorners(a: StagingAreaDef, row: number, col: number): [number, number][] {
  const c = cellCenter(a, row, col),
    t = cellHeadingAt(a, row, col),
    ex = [Math.cos(t), Math.sin(t)],
    ey = [Math.sin(t), -Math.cos(t)],
    hl = a.cellLength / 2,
    hw = a.cellWidth / 2;
  return (
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const
  ).map(([sx, sy]) => [c.x + sx * hl * ex[0] + sy * hw * ey[0], c.y + sx * hl * ex[1] + sy * hw * ey[1]]);
}
