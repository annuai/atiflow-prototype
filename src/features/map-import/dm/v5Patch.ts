import type { MapData } from '@/features/map-editor';
import { patchStaging } from './stagingPatch';
import { commit, maxNum, obj, openDoc } from './tree';
import { groupsOf, type V5 } from './v5/context';
import { patchGraph } from './v5/graph';
import { patchLines } from './v5/lines';
import { patchStations } from './v5/stations';

/**
 * Writes the edits of a map back into a Deployment Manager v5 export by PATCHING its files, not rewriting them: `gmaj.json` and `grid_map_attributes.json` (lines, stations),
 * `graph_object_v5.json` (nodes, edges, stations) and `staging_areas.json`. An entry nobody changed is not touched, so an unedited map comes out byte for byte; an edited one changes only
 * what was edited and keeps every field we do not know. Checksums are left as they were (their algorithm is not known).
 * The ids this hands out (lines, graph nodes) are written down on `data`, so exporting the same map again finds them instead of adding them twice.
 */
export function patchV5(files: Record<string, Uint8Array>, dir: string, data: MapData): void {
  const gmaj = openDoc(files, dir + 'gmaj.json');
  const attrs = openDoc(files, dir + 'grid_map_attributes.json');
  const graph = openDoc(files, dir + 'graph_object_v5.json');
  const staging = openDoc(files, dir + 'staging_areas.json');
  if (!gmaj || !graph) return;
  const nodesInfo = obj(graph.tree.get('nodes_info'));
  const fileNode = new Map(Object.entries(data.fileNodes ?? {}));
  let nextN = maxNum(nodesInfo.keys(), 'N');
  const ctx: V5 = {
    data,
    gmaj,
    attrs,
    graph,
    groups: groupsOf(data),
    node: new Map(data.nodes.map((n) => [n.id, n])),
    lines: obj(gmaj.tree.get('terminal_lines_info')),
    attrLines: attrs ? obj(attrs.tree.get('terminal_lines_info')) : new Map(),
    nodesInfo,
    edgesInfo: obj(graph.tree.get('edges_info')),
    graphStations: obj(graph.tree.get('stations_info')),
    fileNode,
    gid: (ours) => {
      let g = fileNode.get(ours);
      if (!g) {
        g = `N${++nextN}`;
        fileNode.set(ours, g);
      }
      return g;
    },
  };
  patchGraph(ctx, patchLines(ctx));
  patchStations(ctx);
  patchStaging(staging, data, { gmaj, attrs, graph });
  data.fileNodes = Object.fromEntries(fileNode);
  for (const d of [gmaj, attrs, graph, staging]) commit(files, d);
}
