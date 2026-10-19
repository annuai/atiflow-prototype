import type { MapStation } from '@/features/map-editor';
import { accessNodes } from '@/features/map-editor';
import { pyFloat, type PyObj, type PyValue } from '../pyjson';
import { co, list, num, obj, put, rekey, same, str, type Doc } from '../tree';
import { tagsOf } from '../webui';
import { near, type V5 } from './context';

const rad = (deg: number) => (deg * Math.PI) / 180;
const PLAIN_NODE = (): PyObj =>
  new Map<string, PyValue>([
    [
      'park',
      new Map<string, PyValue>([
        ['pick', new Map([['params', new Map()]])],
        ['drop', new Map([['params', new Map()]])],
      ]),
    ],
    [
      'unpark',
      new Map<string, PyValue>([
        ['laden', new Map([['params', new Map()]])],
        ['unladen', new Map([['params', new Map()]])],
      ]),
    ],
  ]);

/** What a station's entries are made from: where it is, the way it faces and the route nodes it is joined to. */
interface Look {
  s: MapStation;
  x: number;
  y: number;
  theta: number;
  sameAngle: boolean;
  orientation: string;
  /** file nodes it is joined to */
  gids: string[];
  /** our nodes it is joined to */
  nodes: { id: string }[];
}
const poseOf = (l: Look): PyValue => [co(l.x), co(l.y), pyFloat(Math.round(l.theta * 1000) / 1000)];

/** The line ids of the roads that pass through one of our nodes. */
const lanesAt = (c: V5, nodeId: string): PyValue[] =>
  c.groups
    .filter((g) => g.chain.includes(nodeId))
    .map((g) => g.ext)
    .filter((e): e is string => e !== undefined)
    .map((e) => Number(e));

/** A station made here: an entry in every file, with the Deployment Manager's own defaults for what we do not know. */
function addStation(c: V5, l: Look, gs: PyObj, as: PyObj) {
  const { s } = l;
  const entry = new Map<string, PyValue>([
    ['id', Number(s.externalId)],
    ['station_name', s.name],
    ['pose', poseOf(l)],
    ['orientation', l.orientation],
    ['station_tags', tagsOf(s, undefined)],
    [
      'three_point_turn',
      new Map<string, PyValue>([
        ['enable', false],
        ['start_direction', 'left'],
        ['start_action', 'forward'],
        ['aisle_width', pyFloat(0)],
        ['aisle_length', pyFloat(0)],
      ]),
    ],
    ['nodes', l.nodes.map((q) => new Map<string, PyValue>([['lane_ids', lanesAt(c, q.id)], ...PLAIN_NODE()]))],
    ['is_transit_allowed', true],
    ['unpark_merge', true],
  ]);
  gs.set(s.externalId!, entry);
  c.gmaj.dirty = true;
  if (c.attrs) {
    const a = new Map(entry) as PyObj;
    a.set('type', 'point');
    a.set('station_lane', null);
    a.set('station_lane_unpark', null);
    as.set(s.externalId!, a);
    c.attrs.dirty = true;
  }
  c.graphStations.set(
    s.name,
    new Map<string, PyValue>([
      ['pose', poseOf(l)],
      ['tags', tagsOf(s, undefined)],
      ['properties', new Map()],
      ['orientation', l.orientation],
      ['name', s.name],
      ['graph_node_coords', null],
      ['associated_nodes', new Map(l.gids.map((g) => [g, PLAIN_NODE()] as [string, PyValue]))],
    ]),
  );
  c.graph.dirty = true;
}

/** Name, pose, orientation and tags of one entry, changed only where they differ. */
function syncEntry(doc: Doc, entry: PyObj, l: Look, oldName: string, keys: { name?: string; tags: string }) {
  if (keys.name) put(doc, entry, keys.name, l.s.name);
  const p = list(entry.get('pose'));
  if (!near([num(p[0]), num(p[1])], [l.x, l.y], 0.0006) || !l.sameAngle) put(doc, entry, 'pose', poseOf(l));
  put(doc, entry, 'orientation', l.orientation);
  const tags = tagsOf(l.s, entry.get(keys.tags), oldName);
  if (!same(entry.get(keys.tags), tags)) put(doc, entry, keys.tags, tags);
}

/** The route nodes a station is joined to in the graph: nodes we know that are gone from the station are removed, a station with none is given the nodes its access reaches. */
function syncAssociated(c: V5, ge: PyObj, l: Look) {
  const assoc = obj(ge.get('associated_nodes'));
  const want = new Set(l.gids);
  const ours = new Set(c.fileNode.values()); // nodes of the file that we know; any other node of the station stays as it was
  for (const k of [...assoc.keys()])
    if (ours.has(k) && !want.has(k)) {
      assoc.delete(k);
      c.graph.dirty = true;
    }
  for (const g of assoc.size ? [] : l.gids)
    if (!assoc.has(g)) {
      assoc.set(g, PLAIN_NODE());
      c.graph.dirty = true;
    }
}

/** A station the file has: only what differs is written. */
function updateStation(c: V5, l: Look, old: PyObj, as: PyObj) {
  const { s } = l;
  const oldName = str(old.get('station_name'));
  syncEntry(c.gmaj, old, l, oldName, { name: 'station_name', tags: 'station_tags' });
  if (c.attrs && as.has(s.externalId!))
    syncEntry(c.attrs, obj(as.get(s.externalId!)), l, oldName, { name: 'station_name', tags: 'station_tags' });
  const key = c.graphStations.has(oldName) ? oldName : s.name;
  if (!c.graphStations.has(key)) return;
  if (key !== s.name) rekey(c.graph, c.graphStations, key, s.name);
  const ge = obj(c.graphStations.get(s.name));
  syncEntry(c.graph, ge, l, oldName, { name: 'name', tags: 'tags' });
  syncAssociated(c, ge, l);
}

/** Stations: deleted ones leave every file, new ones are added to every file, the others are brought up to date. */
export function patchStations(c: V5) {
  const { data, gmaj, attrs, graph } = c;
  const gs = obj(gmaj.tree.get('stations_info'));
  const as = attrs ? obj(attrs.tree.get('stations_info')) : new Map<string, PyValue>();
  const known = new Set(data.stations.map((s) => s.externalId));
  for (const id of [...gs.keys()])
    if (!known.has(id)) {
      const name = str(obj(gs.get(id)).get('station_name'));
      gs.delete(id);
      as.delete(id);
      c.graphStations.delete(name);
      gmaj.dirty = true;
      if (attrs) attrs.dirty = true;
      graph.dirty = true;
    }
  for (const s of data.stations) {
    const n = c.node.get(s.nodeId);
    if (!n || s.unplaced) continue;
    const nodes = accessNodes(data, s.id);
    const old = s.externalId !== undefined && gs.has(s.externalId) ? obj(gs.get(s.externalId)) : null;
    const was = old ? list(old.get('pose')) : [];
    const sameAngle = !!old && Math.abs((s.angle ?? 0) - (num(was[2]) * 180) / Math.PI) < 0.06;
    const look: Look = {
      s,
      x: n.x,
      y: n.y,
      theta: sameAngle ? num(was[2]) : rad(s.angle ?? 0),
      sameAngle,
      orientation: s.onLane === false ? 'off_lane' : 'on_lane',
      gids: nodes.map((q) => c.gid(q.id)),
      nodes,
    };
    if (old) updateStation(c, look, old, as);
    else addStation(c, look, gs, as);
  }
}
