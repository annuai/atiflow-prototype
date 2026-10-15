import { ROBOT_TYPES } from '@/data/robotTypes';
import type { MapData, StagingAreaDef } from './types';

/** Pure edits and geometry of staging areas: rows x columns of cells laid out from the centre of the A1 cell. */
const round = (v: number) => Math.round(v * 100) / 100;
export const colLetter = (c: number): string => { let s = '', n = c; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
/** "A1": column letter then row number (both start at 1). */
export const cellRef = (row: number, col: number) => `${colLetter(col)}${row}`;
/** The key Master Data keeps a cell's state under. */
export const cellKey = (row: number, col: number) => `${row}-${col}`;
export const totalCells = (a: Pick<StagingAreaDef, 'rows' | 'cols'>) => a.rows * a.cols;

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Centre of a cell: columns run along the area's direction, rows go to the right-hand side of it ("down" at rotation 0). */
export function cellCenter(a: StagingAreaDef, row: number, col: number): { x: number; y: number } {
  const t = rad(a.rotation), dx = Math.cos(t), dy = Math.sin(t), rx = Math.sin(t), ry = -Math.cos(t);
  return { x: a.x + (col - 1) * a.cellLength * dx + (row - 1) * a.cellWidth * rx, y: a.y + (col - 1) * a.cellLength * dy + (row - 1) * a.cellWidth * ry };
}
/** The outline of the whole area (four corners). */
export function outline(a: StagingAreaDef): [number, number][] {
  const t = rad(a.rotation), dx = Math.cos(t), dy = Math.sin(t), rx = Math.sin(t), ry = -Math.cos(t); const l = a.cellLength, w = a.cellWidth; const o = { x: a.x - (l / 2) * dx - (w / 2) * rx, y: a.y - (l / 2) * dy - (w / 2) * ry };
  const L = a.cols * l, W = a.rows * w; return [[o.x, o.y], [o.x + L * dx, o.y + L * dy], [o.x + L * dx + W * rx, o.y + L * dy + W * ry], [o.x + W * rx, o.y + W * ry]];
}
const nextId = (d: MapData, taken: string[]) => `SA-${String(Math.max(0, ...d.stagingAreas.map((s) => parseInt(s.id.replace(/\D/g, ''), 10) || 0), ...taken.map((s) => parseInt(s.replace(/\D/g, ''), 10) || 0)) + 1).padStart(3, '0')}`;
export function addStagingArea(data: MapData, at: { x: number; y: number }, taken: string[] = []): { data: MapData; id: string } {
  const id = nextId(data, taken); const n = data.stagingAreas.length + 1;
  const a: StagingAreaDef = { id, name: `Staging area ${n}`, sherpaType: ROBOT_TYPES[0].label, rotation: 0, x: round(at.x), y: round(at.y), rows: 2, cols: 2, cellLength: 1.2, cellWidth: 1, };
  return { id, data: { ...data, stagingAreas: [...data.stagingAreas, a] } };
}
export const updateStagingArea = (data: MapData, id: string, patch: Partial<Omit<StagingAreaDef, 'id'>>): MapData => ({ ...data, stagingAreas: data.stagingAreas.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
export const deleteStagingArea = (data: MapData, id: string): MapData => ({ ...data, stagingAreas: data.stagingAreas.filter((s) => s.id !== id) });
/** What is wrong with the values of an area ('' per field = fine). */
export function stagingProblems(data: MapData, a: StagingAreaDef): Record<string, string> {
  const e: Record<string, string> = {}; const t = a.name.trim();
  if (!t) e.name = 'Give the staging area a name'; else if (data.stagingAreas.some((s) => s.id !== a.id && s.name.trim().toLowerCase() === t.toLowerCase())) e.name = 'Another staging area already has this name';
  if (!Number.isInteger(a.rows) || a.rows < 1 || a.rows > 200) e.rows = 'Rows: a whole number from 1 to 200'; if (!Number.isInteger(a.cols) || a.cols < 1 || a.cols > 200) e.cols = 'Columns: a whole number from 1 to 200';
  if (!(a.cellLength > 0)) e.cellLength = 'Length must be above 0'; if (!(a.cellWidth > 0)) e.cellWidth = 'Width must be above 0';
  return e;
}
