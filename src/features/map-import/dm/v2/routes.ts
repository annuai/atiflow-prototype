import { routeSegments } from '@/features/map-editor';
import { pyFloat, type PyObj, type PyValue } from '../pyjson';
import { co, drop, list, maxNum, num, obj, pt, r3, str, xy } from '../tree';
import { near, specsOf, type P, type Spec, type V2 } from './context';

const dir3 = (p: P | undefined): PyValue => (p ? [pyFloat(r3(p[0])), pyFloat(r3(p[1]))] : []);
/** The planned path of a route in the file's form: ["straight", from, to, 0] and ["turn", from, direction, to, direction, 3]. */
function plannedPath(spec: Spec): PyValue {
  const segs = routeSegments(spec.points, spec.radius).map((s): PyValue =>
    s.kind === 'straight'
      ? ['straight', pt(...s.from), pt(...s.to), 0]
      : ['turn', pt(...s.from), dir3(s.dirFrom), pt(...s.to), dir3(s.dirTo), 3],
  );
  const entry: PyValue[] = [[spec.direction, segs]];
  if (spec.inplace !== undefined) entry.push(['inplace', pyFloat(r3(spec.inplace))]);
  return [[Number(spec.from) || spec.from, Number(spec.to) || spec.to], entry];
}

/**
 * Routes. Each is a record (from, to, direction, radius, the ids of its waypoints), its waypoints, the planned path the robot drives and the line pieces between its points in
 * `grid_map_attributes.json`. A route nobody changed is not touched; a changed one is written again from its points; a deleted one leaves every place; a new road is a new route
 * (two, when it is two-way). Routes were planned for the stations where the file had them, so a station that moved changes the routes that end at it.
 */
export function patchRoutes(c: V2, stood: Map<string, P>) {
  const { wp, attrs, routes, nodes, aLines } = c;
  const specs = specsOf(c.data);
  const byExt = new Map(specs.filter((q) => q.ext !== undefined).map((q) => [q.ext!, q]));
  const planned = list(wp.tree.get('routes')) as PyValue[];
  let nextId = Math.max(maxNum(routes.keys()), maxNum(nodes.keys()));
  let nextLine = maxNum(aLines.keys());
  const at = (id: string): P => stood.get(id) ?? [0, 0];
  const controlOf = (r: PyObj): P[] => [
    at(String(num(r.get('from_station')))),
    ...list(r.get('node')).map((id) =>
      xy([obj(nodes.get(String(num(id)))).get('x') as PyValue, obj(nodes.get(String(num(id)))).get('y') as PyValue]),
    ),
    at(String(num(r.get('to_station')))),
  ];
  const removePieces = (pts: P[]) => {
    if (!attrs) return;
    for (let i = 1; i < pts.length; i++)
      for (const [id, l] of [...aLines]) {
        if (near(xy(obj(l).get('t1')), pts[i - 1]) && near(xy(obj(l).get('t2')), pts[i])) {
          drop(attrs, aLines, id);
          break;
        }
      }
  };
  const addPieces = (pts: P[]) => {
    if (!attrs) return;
    for (let i = 1; i < pts.length; i++) {
      const id = ++nextLine;
      aLines.set(
        String(id),
        new Map<string, PyValue>([
          ['t1', pt(...pts[i - 1])],
          ['t2', pt(...pts[i])],
          ['lane_name', String(id)],
          ['is_edge_line', true],
          ['id', id],
          ['regime', 'default'],
          ['pre_segment_action', null],
        ]),
      );
      attrs.dirty = true;
    }
  };
  const forget = (r: PyObj, old: P[]) => {
    for (const nid of list(r.get('node'))) nodes.delete(String(num(nid)));
    removePieces(old);
  };
  const write = (id: string, s: Spec, plannedIndex: number | null) => {
    const nodeIds: PyValue[] = s.points.slice(1, -1).map(() => ++nextId);
    s.points.slice(1, -1).forEach((p, i) =>
      nodes.set(
        String(nodeIds[i]),
        new Map<string, PyValue>([
          ['id', nodeIds[i]],
          ['x', co(p[0])],
          ['y', co(p[1])],
          ['route_id', Number(id)],
          ['post_process', false],
          ['radius', pyFloat(s.radius)],
        ]),
      ),
    );
    routes.set(
      id,
      new Map<string, PyValue>([
        ['id', Number(id)],
        ['from_station', Number(s.from)],
        ['to_station', Number(s.to)],
        ['direction', s.direction],
        ['radius', pyFloat(s.radius)],
        ['node', nodeIds],
      ]),
    );
    if (plannedIndex !== null) planned[plannedIndex] = plannedPath(s);
    else planned.push(plannedPath(s));
    addPieces(s.points);
    wp.dirty = true;
  };
  const planIndex = (r: PyObj, ordinal: number): number => {
    const from = num(r.get('from_station')),
      to = num(r.get('to_station'));
    const hit = (i: number) => num(list(list(planned[i])[0])[0]) === from && num(list(list(planned[i])[0])[1]) === to;
    return planned[ordinal] && hit(ordinal) ? ordinal : planned.findIndex((_, i) => hit(i));
  };
  const unchanged = (r: PyObj, s: Spec, old: P[]) =>
    String(num(r.get('from_station'))) === s.from &&
    String(num(r.get('to_station'))) === s.to &&
    str(r.get('direction')) === s.direction &&
    Math.abs(num(r.get('radius')) - s.radius) < 1e-6 &&
    old.length === s.points.length &&
    old.every((p, i) => near(p, s.points[i]));

  const gone: number[] = [];
  let ordinal = -1;
  for (const [id, rv] of [...routes]) {
    ordinal++;
    const r = obj(rv),
      s = byExt.get(id),
      old = controlOf(r),
      index = planIndex(r, ordinal);
    if (!s) {
      forget(r, old);
      routes.delete(id);
      if (index >= 0) gone.push(index);
      wp.dirty = true;
    } else if (!unchanged(r, s, old)) {
      forget(r, old);
      write(id, s, index >= 0 ? index : null);
    }
  }
  for (const s of specs.filter((q) => q.ext === undefined || !routes.has(q.ext))) {
    const id = String(++nextId);
    write(id, s, null);
    // the road remembers the route it is now, so the next export finds it instead of adding it again
    s.road.extra = {
      ...s.road.extra,
      dm: { ...(s.road.extra?.dm as object), [s.back ? 'reverseId' : 'externalId']: id },
    };
  }
  if (gone.length) {
    const keep = planned.filter((_, i) => !gone.includes(i));
    planned.length = 0;
    planned.push(...keep);
    wp.dirty = true;
  }
  if (wp.dirty) wp.tree.set('routes', planned);
}
