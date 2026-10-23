import type { MapStation, ResolvedNode } from '@/features/map-editor';
import { resolveNodes } from '@/features/map-editor';
import { pyFloat, type PyObj, type PyValue } from '../pyjson';
import { co, list, num, obj, put, rekey, same, str, type Doc } from '../tree';
import { fillRoles, writeRoles } from './roles';
import { tagsOf } from '../webui';
import { near, type V5 } from './context';

const rad = (deg: number) => (deg * Math.PI) / 180;
/** What a station's entries are made from: where it is, the way it faces and the route nodes it is joined to. */
interface Look {
  s: MapStation;
  x: number;
  y: number;
  theta: number;
  sameAngle: boolean;
  orientation: string;
  /** the nodes of the station with their places on the network */
  res: ResolvedNode[];
  /** file nodes it is joined to */
  gids: string[];
  /** the nodes (by index) whose roles were edited or made here: the graph file is only rewritten for those (it may legitimately list the roles of a node differently from the station file) */
  edited: Set<number>;
}
const poseOf = (l: Look): PyValue => [co(l.x), co(l.y), pyFloat(Math.round(l.theta * 1000) / 1000)];

/** The line ids of the roads that pass through one of our nodes. */
const lanesAt = (c: V5, nodeId: string): PyValue[] =>
  c.groups
    .filter((g) => g.chain.includes(nodeId))
    .map((g) => g.ext)
    .filter((e): e is string => e !== undefined)
    .map((e) => Number(e));

/** An entry of a station's `nodes` list made here: the line it sits on, where it is (the attribute file also keeps the position) and its roles. */
function newNode(c: V5, r: ResolvedNode, pose: boolean): PyObj {
  const m = new Map<string, PyValue>([['lane_ids', r.at ? lanesAt(c, r.at.id).slice(0, 1) : []]]);
  if (pose && r.at) m.set('pose', [co(r.at.x), co(r.at.y)]);
  fillRoles(m, r.node.roles);
  return m;
}
/** The `associated_nodes` block of a station of the graph: every node it uses by its file id, with its roles. */
function associated(c: V5, l: Look): PyObj {
  const out = new Map<string, PyValue>();
  for (const r of l.res) {
    if (!r.at) continue;
    const m = new Map<string, PyValue>();
    fillRoles(m, r.node.roles);
    out.set(c.gid(r.at.id), m);
  }
  return out;
}
/**
 * The `nodes` list of a station of `gmaj.json` / `grid_map_attributes.json`: each of our nodes updates the file node it came from (its roles only; its line stays), a node made here is added,
 * a node that was taken away is dropped. A list that did not change is not touched.
 */
function syncFileNodes(c: V5, doc: Doc, entry: PyObj, l: Look, pose: boolean) {
  const had = list(entry.get('nodes')).filter((v): v is PyObj => v instanceof Map);
  const kept: [number, PyObj][] = [];
  const added: PyObj[] = [];
  for (const r of l.res) {
    // a station without a stored node list has one automatic node: it is the first node of the file, not a new one
    const at = r.node.file ?? (l.s.nodes ? undefined : r.index);
    const old = at !== undefined ? had[at] : undefined;
    if (old) {
      if (writeRoles(doc, old, r.node.roles)) l.edited.add(r.index);
      kept.push([at!, old]);
    } else {
      added.push(newNode(c, r, pose));
      l.edited.add(r.index);
    }
  }
  const next = [...kept.sort((a, b) => a[0] - b[0]).map((k) => k[1]), ...added];
  if (next.length !== had.length || next.some((n, i) => n !== had[i])) {
    entry.set('nodes', next);
    doc.dirty = true;
  }
}
/** The three-point turn of a station: on when the station asks for it, otherwise switched off if the file had it on. */
function syncTurn(doc: Doc, entry: PyObj, s: MapStation) {
  const t = entry.get('three_point_turn');
  const want = s.features?.threePointTurn;
  if (want) {
    const m: PyObj = t instanceof Map ? t : new Map();
    if (!(t instanceof Map)) entry.set('three_point_turn', m);
    put(doc, m, 'enable', true);
    put(doc, m, 'start_direction', want.startDirection);
    put(doc, m, 'start_action', want.startAction);
    put(doc, m, 'aisle_width', pyFloat(want.aisleWidth));
    put(doc, m, 'aisle_length', pyFloat(want.aisleLength));
  } else if (t instanceof Map && t.get('enable') === true) put(doc, t, 'enable', false);
}

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
    ['nodes', l.res.map((r) => newNode(c, r, false))],
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
      ['associated_nodes', associated(c, l)],
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

/** The route nodes a station is joined to in the graph: nodes we know that are gone from the station are removed, each node it uses is there with its roles. */
function syncAssociated(c: V5, ge: PyObj, l: Look) {
  const assoc = obj(ge.get('associated_nodes'));
  const want = new Set(l.gids);
  const ours = new Set(c.fileNode.values()); // nodes of the file that we know; any other node of the station stays as it was
  for (const k of [...assoc.keys()])
    if (ours.has(k) && !want.has(k)) {
      assoc.delete(k);
      c.graph.dirty = true;
    }
  const hadAny = assoc.size > 0; // a station the graph knows keeps the nodes it lists; only nodes made or edited here are added to it
  for (const r of l.res) {
    if (!r.at) continue;
    const g = c.gid(r.at.id);
    const made = !assoc.has(g);
    if (made && hadAny && !l.edited.has(r.index)) continue;
    if (made) {
      assoc.set(g, new Map());
      c.graph.dirty = true;
    }
    if (made || l.edited.has(r.index)) writeRoles(c.graph, obj(assoc.get(g)), r.node.roles);
  }
}

/** A station the file has: only what differs is written. */
function updateStation(c: V5, l: Look, old: PyObj, as: PyObj) {
  const { s } = l;
  const oldName = str(old.get('station_name'));
  syncEntry(c.gmaj, old, l, oldName, { name: 'station_name', tags: 'station_tags' });
  syncFileNodes(c, c.gmaj, old, l, false);
  syncTurn(c.gmaj, old, s);
  if (c.attrs && as.has(s.externalId!)) {
    const a = obj(as.get(s.externalId!));
    syncEntry(c.attrs, a, l, oldName, { name: 'station_name', tags: 'station_tags' });
    syncFileNodes(c, c.attrs, a, l, true);
    syncTurn(c.attrs, a, s);
  }
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
    const res = resolveNodes(data, s);
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
      res,
      edited: new Set<number>(),
      gids: res.flatMap((r) => (r.at ? [c.gid(r.at.id)] : [])),
    };
    if (old) updateStation(c, look, old, as);
    else addStation(c, look, gs, as);
  }
}
