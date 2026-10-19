import type { MapModel3d, StructureElement } from './types';

type Old = MapModel3d & { sections?: { id: string; color: string }[] };

/**
 * Sections are gone (Work areas replaced them). A map saved with sections keeps what people could see: an element without its own colour takes its section's colour, and the sections and
 * the `section` of every element are dropped. (The name label over a whole section is not kept.)
 */
export function withoutSections(m: MapModel3d | undefined): MapModel3d | undefined {
  if (!m) return m;
  const old = m as Old;
  if (!old.sections && !m.elements.some((e) => 'section' in e)) return m;
  const color = new Map((old.sections ?? []).map((s) => [s.id, s.color]));
  const { sections: _gone, ...rest } = old;
  return {
    ...rest,
    elements: m.elements.map((e) => {
      const { section, ...r } = e as StructureElement & { section?: string };
      const own = r.color ?? (section ? color.get(section) : undefined);
      return (own ? { ...r, color: own } : r) as StructureElement;
    }),
  };
}

/**
 * A plain floor Area (height 0) and a Work area were the same thing drawn twice. Floor patches become Work areas (a name over a tinted patch); a raised area (height above 0) stays as it was.
 */
export function floorAreasAreWorkAreas(m: MapModel3d | undefined): MapModel3d | undefined {
  if (!m?.elements.some((e) => e.kind === 'area' && !e.work && e.height === 0)) return m;
  return {
    ...m,
    elements: m.elements.map((e) =>
      e.kind === 'area' && !e.work && e.height === 0 ? { ...e, work: true, label: e.label ?? e.name } : e,
    ),
  };
}
