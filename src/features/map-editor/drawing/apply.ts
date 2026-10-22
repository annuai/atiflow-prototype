import { PALETTE } from '../model/structure/palette';
import { modelOf } from '../model/structure/ops';
import type { StructureElement } from '../model/structure/types';
import type { MapData } from '../model/types';
import type { Built } from './core/types';

const round = (v: number) => Math.round(v * 100) / 100;

/** The elements an import made earlier from the same drawing. */
export const importedFrom = (data: MapData, tag: string): number =>
  modelOf(data).elements.filter((e) => e.fromDrawing === tag).length;

/**
 * Adds what a drawing made to the draft as ordinary elements (walls, partitions, machines, pillars, doors, Work areas) marked with the drawing they came from. With `replace`, what an earlier
 * import of the same drawing made is removed first (hand-made elements and other drawings' elements stay).
 */
export function addBuilt(data: MapData, built: Built, tag: string, replace: boolean): MapData {
  const m = modelOf(data);
  const kept = replace ? m.elements.filter((e) => e.fromDrawing !== tag) : m.elements;
  let n =
    Math.max(
      0,
      ...kept.map((e) => (e.id.startsWith('E') ? parseInt(e.id.slice(1), 10) || 0 : 0)),
      ...m.elements.map((e) => (e.id.startsWith('E') ? parseInt(e.id.slice(1), 10) || 0 : 0)),
    ) + 1;
  const made: StructureElement[] = [];
  const count = (k: string) => kept.filter((e) => e.name?.startsWith(k)).length;
  let w = count('Wall '),
    pt = count('Partition '),
    mc = count('Machine '),
    pl = count('Pillar '),
    dr = count('Door ');
  for (const l of built.lines)
    made.push({
      id: `E${n++}`,
      kind: l.kind,
      points: l.points.map(([x, y]) => [round(x), round(y)]),
      thickness: l.thickness,
      height: l.height,
      name: l.kind === 'wall' ? `Wall ${++w}` : `Partition ${++pt}`,
      fromDrawing: tag,
    });
  for (const b of built.boxes)
    made.push({
      id: `E${n++}`,
      kind: b.kind,
      x: round(b.x),
      y: round(b.y),
      w: round(b.w),
      d: round(b.d),
      rot: Math.round(b.rot * 1000) / 1000,
      height: b.height,
      name: b.kind === 'machine' ? `Machine ${++mc}` : `Pillar ${++pl}`,
      ...(b.label ? { label: b.label } : {}),
      fromDrawing: tag,
    });
  for (const d of built.doors)
    made.push({
      id: `E${n++}`,
      kind: 'door',
      x: round(d.x),
      y: round(d.y),
      w: round(d.w),
      rot: d.rot,
      height: d.height,
      name: `Door ${++dr}`,
      fromDrawing: tag,
    });
  const used = new Set(kept.filter((e) => e.kind === 'area' && e.work).map((e) => e.color));
  let wa = kept.filter((e) => e.kind === 'area' && e.work).length;
  for (const a of built.areas) {
    const color = (PALETTE.find((p) => !used.has(p.color)) ?? PALETTE[wa % PALETTE.length]).color;
    used.add(color);
    wa++;
    const name = a.label ?? `Work area ${wa}`;
    made.push({
      id: `E${n++}`,
      kind: 'area',
      work: true,
      points: a.points.map(([x, y]) => [round(x), round(y)]),
      height: 0,
      color,
      name,
      label: name,
      fromDrawing: tag,
    });
  }
  return { ...data, model3d: { ...m, elements: [...kept, ...made] } };
}
