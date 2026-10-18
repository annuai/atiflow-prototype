import type { IncomingMaterial, Material, MaterialGroup } from './types';
import { t } from '../text';
import type { FleetId } from '@/data/fleets';

const norm = (s: string) => s.trim().toLowerCase();
export const sameCode = (a: string, b: string) => norm(a) === norm(b);
export const hasCode = (list: Material[], code: string) => list.some((m) => sameCode(m.code, code));
/** Every code of the list, normalised, for fast "is it already there" checks over big lists. */
export const codeSet = (list: Material[]) => new Set(list.map((m) => norm(m.code)));
export const inCodeSet = (codes: Set<string>, code: string) => codes.has(norm(code));

/** Next free group id: GRP-001, GRP-002... */
export function nextGroupId(groups: MaterialGroup[]): string {
  const max = groups.reduce((n, g) => Math.max(n, +g.id.replace(/\D/g, '') || 0), 0);
  return `GRP-${String(max + 1).padStart(3, '0')}`;
}

/** Find a group by name (ignoring case) or create it. Used when imported rows carry a group name. */
export function ensureGroup(
  groups: MaterialGroup[],
  name: string,
  now: number,
): { groups: MaterialGroup[]; id: string } {
  const n = name.trim();
  if (!n) return { groups, id: '' };
  const found = groups.find((g) => norm(g.name) === norm(n));
  if (found) return { groups, id: found.id };
  const g: MaterialGroup = { id: nextGroupId(groups), name: n, prefix: '', updatedAt: now };
  return { groups: [...groups, g], id: g.id };
}

/** Merge incoming rows into the list. Existing materials stay untouched; codes already present are skipped. */
export function mergeMaterials(
  materials: Material[],
  groups: MaterialGroup[],
  incoming: IncomingMaterial[],
  now: number,
) {
  let g = groups;
  const out = [...materials];
  let added = 0;
  const seen = codeSet(materials);
  for (const row of incoming) {
    if (inCodeSet(seen, row.code)) continue;
    seen.add(norm(row.code));
    const r = ensureGroup(g, row.groupName ?? '', now);
    g = r.groups;
    out.push({ code: row.code.trim(), name: row.name.trim(), group: r.id, fleets: [], updatedAt: now });
    added++;
  }
  return { materials: out, groups: g, added };
}

/** Errors for a single material form: name and code required, code unique (ignoring case). `editing` skips the uniqueness check against itself. */
export function validateMaterial(
  values: { name: string; code: string },
  existing: Material[],
  editing?: string,
): Record<string, string> {
  const e: Record<string, string> = {};
  if (!values.name.trim()) e.name = t.masterData.errors.materialName;
  if (!values.code.trim()) e.code = t.masterData.errors.materialCode;
  else if (!editing && hasCode(existing, values.code)) e.code = t.masterData.errors.codeExists(values.code.trim());
  return e;
}

export function validateGroup(
  values: { name: string; prefix: string },
  groups: MaterialGroup[],
  editing?: string,
): Record<string, string> {
  const e: Record<string, string> = {};
  if (!values.name.trim()) e.name = t.masterData.errors.groupName;
  else if (groups.some((g) => g.id !== editing && norm(g.name) === norm(values.name)))
    e.name = t.masterData.errors.groupExists(values.name.trim());
  if (values.prefix && /\s/.test(values.prefix.trim())) e.prefix = t.masterData.errors.prefixSpaces;
  return e;
}

export interface MaterialFilter {
  text: string;
  group: string;
}
/** Search by code, name or group name; optional group id filter ('' = all). */
export function filterMaterials(list: Material[], groups: MaterialGroup[], f: MaterialFilter): Material[] {
  const q = norm(f.text);
  const names = new Map(groups.map((g) => [g.id, norm(g.name)]));
  return list.filter(
    (m) =>
      (!f.group || m.group === f.group) &&
      (!q || norm(m.code).includes(q) || norm(m.name).includes(q) || (names.get(m.group) ?? '').includes(q)),
  );
}

export const groupCount = (list: Material[], groupId: string) => list.filter((m) => m.group === groupId).length;

export function filterGroups(
  groups: MaterialGroup[],
  list: Material[],
  f: { text: string; scope: 'all' | 'used' | 'empty' },
): MaterialGroup[] {
  const q = norm(f.text);
  return groups.filter(
    (g) =>
      (!q || [g.id, g.name, g.prefix].some((x) => norm(x).includes(q))) &&
      (f.scope === 'all' || (f.scope === 'used') === groupCount(list, g.id) > 0),
  );
}

/** Codes of the materials assigned to a fleet (what the Workflow Builder offers). */
export const codesForFleet = (list: Material[], fleet: FleetId) =>
  list.filter((m) => m.fleets.includes(fleet)).map((m) => m.code);

/** Assign materials to a fleet (already assigned ones are left alone). */
export const assignToFleet = (list: Material[], codes: string[], fleet: FleetId, now: number): Material[] =>
  list.map((m) =>
    codes.includes(m.code) && !m.fleets.includes(fleet) ? { ...m, fleets: [...m.fleets, fleet], updatedAt: now } : m,
  );
export const unassignFromFleet = (list: Material[], code: string, fleet: FleetId, now: number): Material[] =>
  list.map((m) => (m.code === code ? { ...m, fleets: m.fleets.filter((f) => f !== fleet), updatedAt: now } : m));

/** Keep materials whose code starts with the prefix (empty prefix = all). */
export const filterByPrefix = (list: Material[], prefix: string) =>
  prefix.trim() ? list.filter((m) => m.code.toLowerCase().startsWith(prefix.trim().toLowerCase())) : list;
