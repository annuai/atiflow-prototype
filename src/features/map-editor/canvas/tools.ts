import { zoneTypesOf } from '../model/zoneTypes';
import type { ZoneTypeId } from '../model/types';

export type Module = 'stations' | 'routes' | 'exclusive' | 'zones';

/** What a click on the map does. The module (Stations, Routes, Traffic Gates, Zones) decides which tools it offers. */
export type Tool =
  | { kind: 'select' }
  | { kind: 'station' }
  | { kind: 'staging' }
  | { kind: 'road'; oneWay: boolean }
  | { kind: 'gate'; shape: 'line' | 'box' }
  | { kind: 'zone'; type: ZoneTypeId };
export const SELECT: Tool = { kind: 'select' };
/** A tool that draws: it collects points until the shape is complete. `one` = finished by a single click, `two` = two points, `many` = double-click / Enter to finish. */
export function drawMode(t: Tool): 'none' | 'one' | 'two' | 'many' {
  switch (t.kind) {
    case 'station':
    case 'staging':
      return 'one';
    case 'gate':
      return 'two';
    case 'road':
    case 'zone':
      return 'many';
    default:
      return 'none';
  }
}
export const minPoints = (t: Tool) => (t.kind === 'zone' ? 3 : 2);

/** What each module lets you draw (the arrow next to its icon): ids are the `choice`. Labels come from `copy`/the zone registry. */
export const CHOICES: Record<Exclude<Module, 'zones'>, string[]> = {
  stations: ['station', 'staging'],
  routes: ['road', 'one-way'],
  exclusive: ['line', 'box'],
};
export const choicesOf = (m: Module): string[] => (m === 'zones' ? zoneTypesOf('zones').map((z) => z.id) : CHOICES[m]);
export const DEFAULT_CHOICE: Record<Module, string> = {
  stations: 'station',
  routes: 'road',
  exclusive: 'line',
  zones: zoneTypesOf('zones')[0]?.id ?? 'area',
};
/** The tool for a module and one of its choices. */
export function toolFor(m: Module, choice: string): Tool {
  switch (m) {
    case 'stations':
      return choice === 'staging' ? { kind: 'staging' } : { kind: 'station' };
    case 'routes':
      return { kind: 'road', oneWay: choice === 'one-way' };
    case 'exclusive':
      return { kind: 'gate', shape: choice === 'box' ? 'box' : 'line' };
    default:
      return { kind: 'zone', type: choice };
  }
}
export const moduleOfTool = (t: Tool): Module | null =>
  t.kind === 'station' || t.kind === 'staging'
    ? 'stations'
    : t.kind === 'road'
      ? 'routes'
      : t.kind === 'gate'
        ? 'exclusive'
        : t.kind === 'zone'
          ? 'zones'
          : null;
