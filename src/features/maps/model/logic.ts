import type { FleetMap } from './types';

export type MapSort = 'name' | 'version' | 'updated';
const norm = (s: string) => s.trim().toLowerCase();

/** Names of the fleets that run on each map (map id -> fleet names). `nameOf` turns a fleet id (the key of a profile) into its name. */
export function fleetsByMap(
  profiles: Record<string, { mapId: string | null }>,
  nameOf: (fleet: string) => string,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  Object.entries(profiles).forEach(([fleet, p]) => {
    if (p.mapId) (out[p.mapId] ??= []).push(nameOf(fleet));
  });
  return out;
}

/** Search by map name or fleet name, then sort (name A-Z, newest routing version first, or most recently worked on first; `editedAt` gives when a map was last worked on). */
export function filterSortMaps(
  maps: FleetMap[],
  fleets: Record<string, string[]>,
  text: string,
  sort: MapSort,
  editedAt: (m: FleetMap) => number = (m) => m.updatedAt,
): FleetMap[] {
  const q = norm(text);
  const hit = maps.filter(
    (m) => !q || norm(m.name).includes(q) || (fleets[m.id] ?? []).some((f) => norm(f).includes(q)),
  );
  const byName = (a: FleetMap, b: FleetMap) => a.name.localeCompare(b.name);
  return [...hit].sort((a, b) =>
    sort === 'updated'
      ? editedAt(b) - editedAt(a) || byName(a, b)
      : sort === 'version'
        ? b.version - a.version || byName(a, b)
        : byName(a, b),
  );
}

export interface NewMapForm {
  name: string;
  robot: string;
  runData: string;
  version: string;
  zMin: string;
  zMax: string;
}
/** Field errors for the Generate Map form (empty object = valid). Z bounds are optional but must be numbers with min < max. */
export function validateNewMap(
  f: NewMapForm,
  existing: FleetMap[],
  msg: {
    name: string;
    nameTaken(n: string): string;
    robot: string;
    runData: string;
    version: string;
    z: string;
    number: string;
  },
): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = msg.name;
  else if (existing.some((m) => norm(m.name) === norm(f.name))) e.name = msg.nameTaken(f.name.trim());
  if (!f.robot) e.robot = msg.robot;
  if (!f.runData) e.runData = msg.runData;
  if (!f.version) e.version = msg.version;
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const lo = num(f.zMin),
    hi = num(f.zMax);
  if (lo !== null && Number.isNaN(lo)) e.zMin = msg.number;
  if (hi !== null && Number.isNaN(hi)) e.zMax = msg.number;
  if (!e.zMin && !e.zMax && lo !== null && hi !== null && lo >= hi) e.zMax = msg.z;
  return e;
}

/** When a map was last worked on: the newer of when it was made and its newest edit or publish (`lastEdit` of its version history). */
export const mapEditedAt = (map: FleetMap, lastWork: number | null) => Math.max(map.updatedAt, lastWork ?? 0);
