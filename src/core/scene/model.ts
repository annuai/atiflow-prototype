import type { NavGraph, SiteLayout } from '../types';

/**
 * A SCENE is one map as the Live Floor shows it: the BUILDING (geometry layer: walls, machines, floor) and what robots drive on (network layer: nodes, lanes, stations, traffic gates,
 * no-go zones), in the site frame. It is a plain value (no Three, no React) so it can be built, hashed, compared and cached anywhere. See docs/design/map-scenes.md.
 */
export interface Placement {
  /** where the map's own frame sits in the site frame, metres and radians */
  x: number;
  y: number;
  rot: number;
  /** true while it is only the automatic layout (beside the other buildings); false once somebody set it */
  auto: boolean;
}
export interface SceneModel {
  /** `mapId@networkKey`: changes when the map's network changes, so a loaded scene is replaced exactly when it is out of date */
  key: string;
  mapId: string;
  /** the fleets (their ids in the world) that run on this map */
  fleets: string[];
  /** The building. Two maps of the same building have the SAME `geometry.key`, so it is loaded once and shared. */
  geometry: { key: string; site: SiteLayout };
  network: NavGraph;
  placement: Placement;
}

/** 32-bit FNV-1a: small, fast, stable between runs (not a security hash: a key to tell two layers apart). */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
const r2 = (v: number) => Math.round(v * 100) / 100;
const pt = (p: [number, number]) => `${r2(p[0])},${r2(p[1])}`;

/** Identity of a building: what is drawn (walls, machines, floor, areas, bounds), not its name or ids of anything else. */
export function geometryKey(site: SiteLayout): string {
  const parts = [
    site.walls.map((w) => `${pt(w.a)}>${pt(w.b)}:${r2(w.t)}:${r2(w.h)}:${w.layer}`).join(';'),
    site.equipment.map((e) => `${e.kind}:${r2(e.x)},${r2(e.y)}:${r2(e.w)}x${r2(e.d)}x${r2(e.h)}`).join(';'),
    site.floorPolygons.map((p) => p.map(pt).join(' ')).join('|'),
    site.zones.map((z) => `${z.id}:${z.polygon.map(pt).join(' ')}`).join('|'),
    [site.bounds.minX, site.bounds.minY, site.bounds.maxX, site.bounds.maxY].map(r2).join(','),
  ];
  return `g-${hashText(parts.join('#'))}-${site.walls.length}-${site.equipment.length}`;
}

/** Identity of a network: its lanes, stations (with their fleets), traffic gates and no-go zones. */
export function networkKey(nav: NavGraph): string {
  const parts = [
    nav.lanes.map((l) => `${l.id}:${l.from}>${l.to}:${l.fleets.join('+')}:${l.geom.map(pt).join(' ')}`).join(';'),
    nav.stations.map((s) => `${s.id}:${s.nodeId}:${s.type}:${s.name}:${s.fleets.join('+')}`).join(';'),
    nav.nodes.map((n) => `${n.id}:${pt([n.x, n.y])}`).join(';'),
    nav.trafficZones.map((z) => `${z.id}:${z.capacity}:${z.fleets.join('+')}:${z.polygon.map(pt).join(' ')}`).join('|'),
    nav.forbiddenZones.map((z) => `${z.id}:${z.polygon.map(pt).join(' ')}`).join('|'),
    nav.fleets.map((f) => `${f.id}:${f.color}:${f.areas.join('+')}`).join(';'),
  ];
  return hashText(parts.join('#'));
}

/**
 * The part of a world's network that belongs to the fleets of one map: their lanes, stations and traffic gates (a lane two maps share is in both), the nodes those use, the no-go zones of
 * this map (an imported map's carry its id in front, the ECC ones do not) and the fleets that appear on those lanes.
 */
export function sliceNetwork(nav: NavGraph, fleetIds: string[], opts: { mapId: string; imported: boolean }): NavGraph {
  const own = <T extends { fleets: string[] }>(x: T) => x.fleets.some((f) => fleetIds.includes(f));
  const lanes = nav.lanes.filter(own),
    stations = nav.stations.filter(own);
  const used = new Set([...lanes.flatMap((l) => [l.from, l.to]), ...stations.map((s) => s.nodeId)]);
  return {
    ...nav,
    nodes: nav.nodes.filter((n) => used.has(n.id)),
    lanes,
    stations,
    trafficZones: nav.trafficZones.filter(own),
    forbiddenZones: nav.forbiddenZones.filter((z) =>
      opts.imported ? z.id.startsWith(`${opts.mapId}/`) : !z.id.includes('/'),
    ),
    fleets: nav.fleets.filter((f) => fleetIds.includes(f.id) || lanes.some((l) => l.fleets.includes(f.id))),
  };
}
