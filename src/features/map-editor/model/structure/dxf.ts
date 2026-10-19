import { modelOf } from './ops';
import type { MapData } from '../types';
import type { BoxElement, P, StructureElement } from './types';

const LAYER: Record<StructureElement['kind'], string> = {
  wall: 'WALL',
  partition: 'PARTITION',
  machine: 'MACHINE',
  pillar: 'PILLAR',
  area: 'AREA',
  door: 'DOOR',
};

/** The outline of an element as closed or open runs of points. */
function runs(e: StructureElement): { pts: P[]; closed: boolean }[] {
  if (e.kind === 'wall' || e.kind === 'partition') return [{ pts: e.points, closed: false }];
  if (e.kind === 'area') return [{ pts: e.points, closed: true }];
  const b: { x: number; y: number; w: number; d: number; rot: number } =
    e.kind === 'door' ? { x: e.x, y: e.y, w: e.w, d: 0.1, rot: e.rot } : (e as BoxElement);
  const c = Math.cos(b.rot),
    s = Math.sin(b.rot);
  const at = ([x, y]: P): P => [b.x + x * c - y * s, b.y + x * s + y * c];
  const [hw, hd] = [b.w / 2, b.d / 2];
  return [{ pts: [at([-hw, -hd]), at([hw, -hd]), at([hw, hd]), at([-hw, hd])], closed: true }];
}

const num = (n: number) => (Math.round(n * 1e4) / 1e4).toString();

/**
 * The structure as an ASCII DXF (R12, units metres) any CAD program opens: one layer per kind, every outline as LINEs with the element's base as Z and its height as thickness, machine and
 * area labels as TEXT. A drawing for looking at and editing outside; our own JSON stays the source of truth.
 */
export function structureDxf(data: MapData): string {
  const m = modelOf(data);
  const out: (string | number)[] = [
    0,
    'SECTION',
    2,
    'HEADER',
    9,
    '$ACADVER',
    1,
    'AC1009',
    9,
    '$INSUNITS',
    70,
    6,
    0,
    'ENDSEC',
  ];
  out.push(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, Object.keys(LAYER).length);
  for (const l of Object.values(LAYER)) out.push(0, 'LAYER', 2, l, 70, 0, 62, 7, 6, 'CONTINUOUS');
  out.push(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
  for (const e of m.elements) {
    const layer = LAYER[e.kind];
    const z = e.base ?? 0;
    for (const { pts, closed } of runs(e)) {
      const n = closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) {
        const a = pts[i],
          b = pts[(i + 1) % pts.length];
        out.push(
          0,
          'LINE',
          8,
          layer,
          39,
          num(e.height),
          10,
          num(a[0]),
          20,
          num(a[1]),
          30,
          num(z),
          11,
          num(b[0]),
          21,
          num(b[1]),
          31,
          num(z),
        );
      }
    }
    if (e.label?.trim()) {
      const p = runs(e)[0].pts;
      const cx = p.reduce((s, q) => s + q[0], 0) / p.length,
        cy = p.reduce((s, q) => s + q[1], 0) / p.length;
      out.push(
        0,
        'TEXT',
        8,
        layer,
        10,
        num(cx),
        20,
        num(cy),
        30,
        num(z + e.height),
        40,
        0.5,
        1,
        e.label.replace(/[\r\n]+/g, ' '),
      );
    }
  }
  out.push(0, 'ENDSEC', 0, 'EOF');
  return out.map(String).join('\n') + '\n';
}
