import { zoneTypesOf } from '../model/zoneTypes';
import type { ZoneTypeId } from '../model/types';

export type Module = 'stations' | 'routes' | 'exclusive' | 'zones' | 'structure';
/** What the Structure module draws: walls and partitions (a line of points), machines and pillars (a block between two corners), a room (four walls round a rectangle), an area (any outline), a door (a click on a wall), tracing a wall of the lidar estimate (a click) and erasing a rectangle. */
export type StructureTool = 'wall' | 'partition' | 'machine' | 'pillar' | 'room' | 'area' | 'work' | 'door' | 'erase';

/** What a click on the map does. The module (Stations, Routes, Traffic Gates, Zones) decides which tools it offers. */
export type Tool =
  | { kind: 'select' }
  | { kind: 'station' }
  | { kind: 'staging' }
  | { kind: 'place'; id: string }
  | { kind: 'road'; oneWay: boolean }
  | { kind: 'gate'; shape: 'line' | 'box' }
  | { kind: 'zone'; type: ZoneTypeId }
  | { kind: 'structure'; what: StructureTool };
export const SELECT: Tool = { kind: 'select' };
/** A tool that draws: it collects points until the shape is complete. `one` = finished by a single click, `two` = two points (a rectangle's opposite corners, or a line), `many` = double-click / Enter to finish. */
export function drawMode(t: Tool): 'none' | 'one' | 'two' | 'many' {
  switch (t.kind) {
    case 'station':
    case 'staging':
    case 'place':
      return 'one';
    case 'gate':
    case 'zone':
      return 'two';
    case 'road':
      return 'many';
    case 'structure':
      return t.what === 'wall' || t.what === 'partition' || t.what === 'area' || t.what === 'work'
        ? 'many'
        : t.what === 'door'
          ? 'one'
          : 'two';
    default:
      return 'none';
  }
}

/** What each module lets you draw (the arrow next to its icon): ids are the `choice`. Labels come from `copy`/the zone registry. */
const CHOICES: Record<Exclude<Module, 'zones'>, string[]> = {
  stations: ['station', 'staging'],
  routes: ['road', 'one-way'],
  exclusive: ['line', 'box'],
  structure: ['wall', 'partition', 'machine', 'pillar', 'room', 'work', 'area', 'door', 'erase'],
};
export const choicesOf = (m: Module): string[] => (m === 'zones' ? zoneTypesOf('zones').map((z) => z.id) : CHOICES[m]);
export const DEFAULT_CHOICE: Record<Module, string> = {
  stations: 'station',
  routes: 'road',
  exclusive: 'line',
  structure: 'wall',
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
    case 'structure':
      return { kind: 'structure', what: choice as StructureTool };
    default:
      return { kind: 'zone', type: choice };
  }
}
export const moduleOfTool = (t: Tool): Module | null =>
  t.kind === 'station' || t.kind === 'staging' || t.kind === 'place'
    ? 'stations'
    : t.kind === 'road'
      ? 'routes'
      : t.kind === 'gate'
        ? 'exclusive'
        : t.kind === 'zone'
          ? 'zones'
          : t.kind === 'structure'
            ? 'structure'
            : null;
