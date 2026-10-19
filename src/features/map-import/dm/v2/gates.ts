import { fitRect, rectCorners } from '@/core/rect';
import { pyFloat, type PyValue } from '../pyjson';
import { co, drop, list, maxNum, obj, pt, put, xy, type Doc } from '../tree';
import { near, type P } from './context';
import type { MapData } from '@/features/map-editor';

const edges = (poly: P[]): PyValue => poly.map((p, i) => [pt(...p), pt(...poly[(i + 1) % poly.length])]);
const idOf = (z: { extra?: Record<string, unknown> }) =>
  (z.extra?.dm as { externalId?: unknown } | undefined)?.externalId;

/**
 * Gates (exclusive zones) of `ez.json`: the name and outline of each, new ones added with the Deployment Manager's own defaults, deleted ones removed. A gate is held here as the
 * rectangle around its outline, so only a rectangle that differs from that one counts as an edit.
 */
export function patchGates(ez: Doc, data: MapData) {
  const gates = obj(ez.tree.get('ez_gates'));
  const ours = new Map(
    data.zones.flatMap((z) => (z.type === 'exclusive' && idOf(z) !== undefined ? [[String(idOf(z)), z] as const] : [])),
  );
  for (const [id, g] of [...gates]) {
    const z = ours.get(id);
    if (!z) {
      drop(ez, gates, id);
      continue;
    }
    const m = obj(g);
    put(ez, m, 'name', z.name);
    const was = rectCorners(
      fitRect(
        list(m.get('polygon_edges'))
          .flatMap((e) => list(e).slice(0, 1))
          .map((p) => xy(p)),
      ),
    );
    if (was.length !== z.polygon.length || !was.every((p, i) => near(p, z.polygon[i], 0.02)))
      put(ez, m, 'polygon_edges', edges(z.polygon));
  }
  let next = maxNum(gates.keys());
  for (const z of data.zones.filter((q) => q.type === 'exclusive' && idOf(q) === undefined)) {
    const id = String(++next);
    const c = z.polygon.reduce<P>((a, p) => [a[0] + p[0] / z.polygon.length, a[1] + p[1] / z.polygon.length], [0, 0]);
    gates.set(
      id,
      new Map<string, PyValue>([
        ['id', Number(id)],
        ['name', z.name],
        ['line_segment', [pt(...z.polygon[0]), pt(...z.polygon[1])]],
        ['opening_direction', [pyFloat(0), pyFloat(-1)]],
        ['exclusive_parking', false],
        ['station_pose', [co(c[0]), co(c[1]), pyFloat(0)]],
        ['linked_gate', false],
        ['linked_gates_ids', []],
        ['apply_dist', pyFloat(0.5)],
        ['transit_visa_release_dist', pyFloat(0.6)],
        ['other_visa_release_dist', pyFloat(0.6)],
        ['gate_tags', []],
        ['linked_poses', []],
        ['polygon_edges', edges(z.polygon)],
      ]),
    );
    ez.dirty = true;
    z.extra = { ...z.extra, dm: { ...(z.extra?.dm as object), externalId: id } };
  }
}
