import { buildArea, type AreaSpec } from '@/features/master-data/model/areas';
import type { Material, MaterialGroup, StagingArea } from '@/features/master-data/model/types';
import { FLEET_ID, type FleetId } from '@/data/fleets';

const MIN = 60_000,
  H = 60 * MIN,
  DAY = 24 * H;
/** Starting data (what the design shows). Replace with a backend later; nothing else in the feature holds data. */
const GROUPS: [name: string, prefix: string, ageMs: number][] = [
  ['Fasteners & Fixings', 'FST', 2 * MIN],
  ['Packaging', 'PKG', H],
  ['Sub-Assemblies', 'SUB', DAY],
  ['Consumables', 'CON', 2 * DAY],
  ['Electrical', 'ELC', 3 * DAY],
  ['Raw Materials', 'RAW', 7 * DAY],
  ['Seals & Gaskets', 'SEA', 7 * DAY],
  ['Paint & Coatings', 'PNT', 21 * DAY],
];
const MATERIALS: [code: string, name: string, group: string, fleets: FleetId[]][] = [
  ['DCP-1001', 'Drive Chain Pin 8mm', 'Fasteners & Fixings', [FLEET_ID.lineSide]],
  ['DCP-1002', 'Drive Chain Plate 12mm', 'Sub-Assemblies', [FLEET_ID.lineSide]],
  ['DCP-1003', 'Chain Sprocket 24T', 'Sub-Assemblies', [FLEET_ID.lineSide]],
  ['DCP-1004', 'DC Power Cable 2m', 'Electrical', [FLEET_ID.lineSide]],
  ['DCP-1005', 'Drive Coupling Pad', 'Consumables', [FLEET_ID.assembly]],
  ['DCP-1006', 'Dust Cover Panel', 'Packaging', [FLEET_ID.assembly]],
];
/** The demo areas and the fleet whose materials they hold (SA-003 is the second map's). */
const AREAS: [id: string, spec: AreaSpec, fleet: FleetId][] = [
  ['SA-001', { name: 'SA 001', rows: 20, cols: 10, filled: 14, reserved: 2, blocked: 1 }, FLEET_ID.lineSide],
  ['SA-002', { name: 'SA 002', rows: 20, cols: 10, filled: 62, reserved: 6, blocked: 3 }, FLEET_ID.lineSide],
  ['SA-003', { name: 'SA 003', rows: 8, cols: 10, filled: 48, reserved: 4, blocked: 2 }, FLEET_ID.lineSide],
];

export function seedGroups(now: number): MaterialGroup[] {
  return GROUPS.map(([name, prefix, age], i) => ({
    id: `GRP-${String(i + 1).padStart(3, '0')}`,
    name,
    prefix,
    updatedAt: now - age,
  }));
}
export function seedMaterials(now: number, groups: MaterialGroup[]): Material[] {
  return MATERIALS.map(([code, name, group, fleets], i) => ({
    code,
    name,
    group: groups.find((g) => g.name === group)?.id ?? '',
    fleets,
    updatedAt: now - i * MIN,
  }));
}
export const seedAreas = (materials: Material[] = [], now = 0): StagingArea[] =>
  AREAS.map(([id, spec, fleet], i) =>
    buildArea(
      id,
      spec,
      7 + i,
      materials.filter((m) => m.fleets.includes(fleet)).map((m) => m.code),
      now,
    ),
  );
