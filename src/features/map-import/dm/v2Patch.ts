import type { MapData } from '@/features/map-editor';
import { commit, obj, openDoc, xy } from './tree';
import type { PyValue } from './pyjson';
import type { P, V2 } from './v2/context';
import { patchGates } from './v2/gates';
import { patchRoutes } from './v2/routes';
import { patchStations } from './v2/stations';

/**
 * Writes the edits of a point-to-point (v2) map back into the Deployment Manager's files by patching them: `waypoints.json` (station list, routes with their waypoints and planned path),
 * `grid_map_attributes.json` (stations, and the line pieces of every route) and `ez.json` (traffic gates). A route nobody changed is not touched, so an unedited map comes out byte
 * for byte; an edited, new or deleted route changes only its own entries. (`webui_map.json` holds real station data in v2 and is patched by `patchWebui`.)
 * The planned path of a changed route is worked out from its waypoints and radius (straights joined by circular turns), in the file's own form.
 */
export function patchV2(files: Record<string, Uint8Array>, dir: string, data: MapData): void {
  const wp = openDoc(files, dir + 'waypoints.json');
  const attrs = openDoc(files, dir + 'grid_map_attributes.json');
  const ez = openDoc(files, dir + 'ez.json');
  if (!wp) return;
  const me = obj(wp.tree.get('map_editor'));
  const stations = obj(me.get('stations'));
  const ctx: V2 = {
    data,
    wp,
    attrs,
    stations,
    routes: obj(me.get('routes')),
    nodes: obj(me.get('nodes')),
    aStations: attrs ? obj(attrs.tree.get('stations_info')) : new Map(),
    aLines: attrs ? obj(attrs.tree.get('terminal_lines_info')) : new Map(),
    placed: new Map(data.nodes.map((n) => [n.id, n])),
  };
  // where the stations stood in the file: the planned paths of the routes were made for those points
  const stood = new Map<string, P>(
    [...stations].map(([k, v]) => [k, xy([obj(v).get('x') as PyValue, obj(v).get('y') as PyValue])]),
  );
  patchStations(ctx);
  patchRoutes(ctx, stood);
  if (ez) patchGates(ez, data);
  for (const d of [wp, attrs, ez]) commit(files, d);
}
