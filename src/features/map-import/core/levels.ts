import { encodeMaskPng } from './png';
import type { GridImage } from './types';

/** One compressed copy of the floor picture, with where it lies (see `MapBaseLevel`). */
export interface PngLevel {
  bytes: Uint8Array;
  width: number;
  height: number;
  res: number;
  originCol: number;
  originRow: number;
}
export const encodePngLevel = (g: GridImage): PngLevel => ({
  bytes: encodeMaskPng(g.alpha, g.width, g.height),
  width: g.width,
  height: g.height,
  res: g.res,
  originCol: g.originCol,
  originRow: g.originRow,
});
