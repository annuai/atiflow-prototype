import { pyFloat, type PyValue } from '../pyjson';
import { maxNum, obj, pt, put, r3, str, xy } from '../tree';
import { near, type LineChange, type V5 } from './context';

/**
 * `graph_object_v5.json`: the nodes (the dots a route is made of) and the directed edges between neighbours. A line that changed or went loses the edges between the file's nodes on its
 * old geometry; a line that changed or is new gets an edge for every pair of neighbouring nodes (both ways when two-way); nodes that no road passes through any more are removed.
 * Everything the changes did not touch (including the file's own nodes that are on no line) stays.
 */
export function patchGraph(c: V5, changes: LineChange[]) {
  const { graph, edgesInfo, nodesInfo } = c;
  const used = new Set(c.groups.flatMap((g) => g.chain));
  const removedNodes = [...c.fileNode].filter(([ours, g]) => nodesInfo.has(g) && !used.has(ours)).map(([, g]) => g);

  for (const ch of changes) {
    const old = new Set(ch.oldChain);
    for (const [k, e] of [...edgesInfo])
      if (old.has(str(obj(e).get('start_node'))) && old.has(str(obj(e).get('end_node')))) {
        edgesInfo.delete(k);
        graph.dirty = true;
      }
  }
  for (const id of used) {
    const n = c.node.get(id);
    if (!n) continue;
    const gi = c.gid(id);
    const m = nodesInfo.get(gi);
    if (!m) {
      nodesInfo.set(gi, new Map<string, PyValue>([['pos', pt(n.x, n.y)]]));
      graph.dirty = true;
    } else if (!near(xy(obj(m).get('pos')), [n.x, n.y])) put(graph, obj(m), 'pos', pt(n.x, n.y));
  }
  const has = new Set([...edgesInfo].map(([, e]) => `${str(obj(e).get('start_node'))}>${str(obj(e).get('end_node'))}`));
  let next = maxNum(edgesInfo.keys(), 'E');
  const add = (a: string, b: string, heading: string | null) => {
    if (has.has(`${a}>${b}`)) return;
    const pa = xy(obj(nodesInfo.get(a)).get('pos')),
      pb = xy(obj(nodesInfo.get(b)).get('pos'));
    edgesInfo.set(
      `E${++next}`,
      new Map<string, PyValue>([
        ['start_node', a],
        ['end_node', b],
        ['weight', pyFloat(r3(Math.hypot(pa[0] - pb[0], pa[1] - pb[1])))],
        ['heading_direction', heading],
      ]),
    );
    has.add(`${a}>${b}`);
    graph.dirty = true;
  };
  for (const ch of changes) {
    const g = ch.group;
    if (!g) continue;
    for (let i = 1; i < g.chain.length; i++) {
      const a = c.gid(g.chain[i - 1]),
        b = c.gid(g.chain[i]);
      const heading = g.heading === 'forward' ? 'forward' : null;
      add(a, b, heading);
      if (!g.oneWay) add(b, a, heading);
    }
  }
  for (const gn of removedNodes) {
    nodesInfo.delete(gn);
    for (const [k, e] of [...edgesInfo])
      if (str(obj(e).get('start_node')) === gn || str(obj(e).get('end_node')) === gn) edgesInfo.delete(k);
    graph.dirty = true;
  }
}
