import type { Box } from './flatten';

/** Metres per drawing unit for a DXF `$INSUNITS` code, or null when the file does not say (0) or the unit is not a length we know. */
export function unitFactor(code: number | null): number | null {
  switch (code) {
    case 1:
      return 0.0254; // inches
    case 2:
      return 0.3048; // feet
    case 4:
      return 0.001;
    case 5:
      return 0.01;
    case 6:
      return 1;
    case 7:
      return 1000;
    case 14:
      return 0.1; // decimetres
    case 15:
      return 10; // decametres
    default:
      return null;
  }
}
/** One PostScript point (what an Illustrator file is drawn in), in metres. */
export const POINT = 0.0254 / 72;

/** A unit from the size of the drawing, for files that do not say: a building is between ten and some hundred metres across, so a drawing 20,000 wide is millimetres, 2,000 to 20,000 centimetres, otherwise metres. */
export function guessUnit(extent: Box): number {
  const size = Math.max(extent.maxX - extent.minX, extent.maxY - extent.minY);
  if (size > 20000) return 0.001;
  if (size > 1500) return 0.01;
  return 1;
}
/** The units a person can pick (the names are in the language catalog under their id). */
export const UNITS = [
  { id: 'mm', factor: 0.001 },
  { id: 'cm', factor: 0.01 },
  { id: 'm', factor: 1 },
  { id: 'in', factor: 0.0254 },
  { id: 'ft', factor: 0.3048 },
  { id: 'pt', factor: POINT },
] as const;
