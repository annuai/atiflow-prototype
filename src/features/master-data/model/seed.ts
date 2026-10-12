import { buildArea, type AreaSpec } from './areas';
import type { Material, MaterialGroup, StagingArea } from './types';
import { FLEET_NAME } from '@/data/fleets';

const MIN = 60_000, H = 60 * MIN, DAY = 24 * H;
/** Starting data (what the design shows). Replace with a backend later; nothing else in the feature holds data. */
const GROUPS: [name: string, prefix: string, ageMs: number][] = [
  ['Fasteners & Fixings', 'FST', 2 * MIN], ['Packaging', 'PKG', H], ['Sub-Assemblies', 'SUB', DAY], ['Consumables', 'CON', 2 * DAY],
  ['Electrical', 'ELC', 3 * DAY], ['Raw Materials', 'RAW', 7 * DAY], ['Seals & Gaskets', 'SEA', 7 * DAY], ['Paint & Coatings', 'PNT', 21 * DAY],
];
const MATERIALS: [code: string, name: string, group: string, fleets: string[]][] = [
  ['DCP-1001', 'Drive Chain Pin 8mm', 'Fasteners & Fixings', [FLEET_NAME.lineSide]],
  ['DCP-1002', 'Drive Chain Plate 12mm', 'Sub-Assemblies', [FLEET_NAME.lineSide]],
  ['DCP-1003', 'Chain Sprocket 24T', 'Sub-Assemblies', [FLEET_NAME.lineSide]],
  ['DCP-1004', 'DC Power Cable 2m', 'Electrical', [FLEET_NAME.lineSide]],
  ['DCP-1005', 'Drive Coupling Pad', 'Consumables', [FLEET_NAME.assembly]],
  ['DCP-1006', 'Dust Cover Panel', 'Packaging', [FLEET_NAME.assembly]],
];
const AREAS: [id: string, spec: AreaSpec][] = [
  ['SA-001', { name: 'SA 001', rows: 20, cols: 10, filled: 14, reserved: 2, blocked: 1 }],
  ['SA-002', { name: 'SA 002', rows: 20, cols: 10, filled: 62, reserved: 6, blocked: 3 }],
  ['SA-003', { name: 'SA 003', rows: 8, cols: 10, filled: 48, reserved: 4, blocked: 2 }],
];

export function seedGroups(now: number): MaterialGroup[] {
  return GROUPS.map(([name, prefix, age], i) => ({ id: `GRP-${String(i + 1).padStart(3, '0')}`, name, prefix, updatedAt: now - age }));
}
export function seedMaterials(now: number, groups: MaterialGroup[]): Material[] {
  return MATERIALS.map(([code, name, group, fleets], i) => ({ code, name, group: groups.find((g) => g.name === group)?.id ?? '', fleets, updatedAt: now - i * MIN }));
}
export const seedAreas = (): StagingArea[] => AREAS.map(([id, spec], i) => buildArea(id, spec, 7 + i));
