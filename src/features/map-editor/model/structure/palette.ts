import type { ElementKind } from './types';

/** User-interface friendly colours for elements: soft, distinct from each other, readable behind a black label box. */
export const PALETTE: { id: string; color: string }[] = [
  { id: 'slate', color: '#94a3b8' },
  { id: 'stone', color: '#a8a29e' },
  { id: 'teal', color: '#5eead4' },
  { id: 'sky', color: '#7dd3fc' },
  { id: 'blue', color: '#93c5fd' },
  { id: 'indigo', color: '#a5b4fc' },
  { id: 'violet', color: '#c4b5fd' },
  { id: 'pink', color: '#f9a8d4' },
  { id: 'rose', color: '#fda4af' },
  { id: 'orange', color: '#fdba74' },
  { id: 'amber', color: '#fcd34d' },
  { id: 'lime', color: '#bef264' },
  { id: 'green', color: '#86efac' },
];

/** What each kind of element starts as: height, thickness, colour. A wall is high, a partition lower, a machine about as high as a partition or a little more. */
export const DEFAULTS: Record<ElementKind, { height: number; thickness: number; color: string }> = {
  wall: { height: 4, thickness: 0.2, color: '#9aa6a2' },
  partition: { height: 1.6, thickness: 0.1, color: '#b8c2be' },
  machine: { height: 1.8, thickness: 0, color: '#9aa9a5' },
  pillar: { height: 4, thickness: 0, color: '#8b9692' },
  area: { height: 0, thickness: 0, color: '#c7d2cf' },
  door: { height: 2.2, thickness: 0, color: '#f59e0b' },
};
export const DOOR_WIDTH = 1.4;

const HEX = /^#[0-9a-fA-F]{6}$/;
/** A colour as `#rrggbb` (what a colour box gives back, in either case), or null when it is not one. */
export const asHex = (v: string): string | null => (HEX.test(v.trim()) ? v.trim().toLowerCase() : null);
