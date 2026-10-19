import type { MapStation } from '@/features/map-editor';
import { pyFloat, type PyObj, type PyValue } from '../pyjson';
import { co, drop, list, num, obj, put, r3, same, str } from '../tree';
import { tagsOf } from '../webui';
import { rad, type V2 } from './context';

/** Where a station is, in the Deployment Manager's own station list (x, y, heading in radians; an angle nobody changed keeps its exact value). */
function poseOf(c: V2, s: MapStation, old?: PyValue): [number, number, number] | null {
  const n = c.placed.get(s.nodeId);
  if (!n) return null;
  const was = list(old);
  const unchanged = was.length > 2 && Math.abs((s.angle ?? 0) - (num(was[2]) * 180) / Math.PI) < 0.06;
  return [r3(n.x), r3(n.y), unchanged ? num(was[2]) : Math.round(rad(s.angle ?? 0) * 1e6) / 1e6];
}
const poseValue = (p: [number, number, number]): PyValue => [co(p[0]), co(p[1]), pyFloat(p[2])];

/** The station record of `waypoints.json` (`map_editor.stations`): added when new, then changed where it differs. */
function syncRecord(c: V2, s: MapStation) {
  const n = c.placed.get(s.nodeId)!;
  let e = c.stations.get(s.externalId!) as PyObj | undefined;
  if (!e) {
    e = new Map<string, PyValue>([
      ['id', Number(s.externalId)],
      ['name', s.name],
      ['x', co(n.x)],
      ['y', co(n.y)],
      ['rotation', pyFloat(s.angle ?? 0)],
      ['charging', s.type === 'charge'],
      ['inplace', false],
      ['clockwise', 0],
      ['common_dispatch_station', false],
      ['post_process', false],
      ['station_tags', tagsOf(s, undefined)],
      ['hidden', false],
    ]);
    c.stations.set(s.externalId!, e);
    c.wp.dirty = true;
  }
  put(c.wp, e, 'name', s.name);
  if (Math.abs(num(e.get('x')) - n.x) > 0.0006) put(c.wp, e, 'x', co(n.x));
  if (Math.abs(num(e.get('y')) - n.y) > 0.0006) put(c.wp, e, 'y', co(n.y));
  if (Math.abs(num(e.get('rotation')) - (s.angle ?? 0)) > 0.0006) put(c.wp, e, 'rotation', pyFloat(s.angle ?? 0));
  put(c.wp, e, 'charging', s.type === 'charge');
  const tags = tagsOf(s, e.get('station_tags'), str(e.get('name')));
  if (!same(e.get('station_tags'), tags)) put(c.wp, e, 'station_tags', tags);
}

/** The station of `grid_map_attributes.json`. */
function syncAttribute(c: V2, s: MapStation) {
  const attrs = c.attrs;
  if (!attrs) return;
  let a = c.aStations.get(s.externalId!) as PyObj | undefined;
  const pose = poseOf(c, s, a?.get('pose'));
  if (!a) {
    a = new Map<string, PyValue>([
      ['pose', pose ? poseValue(pose) : []],
      ['station_tags', tagsOf(s, undefined)],
      ['orientation', 'axial'],
      ['station_name', s.name],
      ['graph_node_coords', null],
      ['is_transit_allowed', true],
      ['station_lane', null],
      ['unpark_merge', true],
    ]);
    c.aStations.set(s.externalId!, a);
    attrs.dirty = true;
  }
  put(attrs, a, 'station_name', s.name);
  const was = list(a.get('pose'));
  const moved =
    !!pose &&
    (Math.abs(num(was[0]) - pose[0]) > 0.0006 ||
      Math.abs(num(was[1]) - pose[1]) > 0.0006 ||
      Math.abs(num(was[2]) - pose[2]) > 1e-6);
  if (moved) put(attrs, a, 'pose', poseValue(pose!));
  const tags = tagsOf(s, a.get('station_tags'), str(a.get('station_name')));
  if (!same(a.get('station_tags'), tags)) put(attrs, a, 'station_tags', tags);
}

/** The Deployment Manager's own list of station poses runs in the order of the station records: rewritten only where a pose differs. */
function syncList(c: V2) {
  const wanted: PyValue[] = [...c.stations].map(([, v]) => [
    obj(v).get('x') as PyValue,
    obj(v).get('y') as PyValue,
    pyFloat(rad(num(obj(v).get('rotation')))),
  ]);
  const had = list(c.wp.tree.get('stations'));
  const differs = (i: number) => {
    const h = list(had[i]),
      n = list(wanted[i]);
    return [0, 1, 2].some((k) => Math.abs(num(h[k]) - num(n[k])) > 0.0006);
  };
  if (had.length === wanted.length && !wanted.some((_, i) => differs(i))) return;
  put(
    c.wp,
    c.wp.tree,
    'stations',
    wanted.map((w, i) => [list(w)[0], list(w)[1], had[i] && !differs(i) ? list(had[i])[2] : list(w)[2]]),
  );
}

/** Stations: removed ones leave the files, new ones are added, the others change where they differ. */
export function patchStations(c: V2) {
  const keep = new Set(c.data.stations.map((s) => s.externalId!));
  for (const k of [...c.stations.keys()]) if (!keep.has(k)) drop(c.wp, c.stations, k);
  for (const k of [...c.aStations.keys()]) if (!keep.has(k) && c.attrs) drop(c.attrs, c.aStations, k);
  for (const s of c.data.stations) {
    if (!c.placed.has(s.nodeId)) continue;
    syncRecord(c, s);
    syncAttribute(c, s);
  }
  syncList(c);
}
