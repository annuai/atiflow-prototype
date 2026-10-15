import { LaneGraph } from '@/core/lanes';
import type { NavGraph, Vec2 } from '@/core/types';
import type { MapData } from './types';

/** The map as a lane graph for the simulation: only this map's own nodes, lanes and stations (each map owns its full network). */
export function navOf(data: MapData, fleet: string): NavGraph {
  return { schema: 2, siteId: 'map', nodes: data.nodes, lanes: data.lanes, stations: data.stations, fleets: [{ id: fleet, name: fleet, color: '#14b8a6', areas: [] }], trafficZones: [], forbiddenZones: [] };
}

export type TripPlan = { ok: true; pts: Vec2[]; len: number } | { ok: false; reason: 'missing' | 'same' | 'no-route' };
/** The lane path a robot of the fleet drives from one station to another on this map, and its length in metres. */
export function planTrip(data: MapData, fleet: string, from: string, to: string): TripPlan {
  const g = new LaneGraph(navOf(data, fleet)); const a = g.stationNode(from), b = g.stationNode(to);
  if (!a || !b) return { ok: false, reason: 'missing' };
  if (a.id === b.id) return { ok: false, reason: 'same' };
  const lanes = g.route(a.id, b.id, fleet); if (!lanes?.length) return { ok: false, reason: 'no-route' };
  const plan = g.plan(lanes, { x: a.x, y: a.y }); return { ok: true, pts: plan.pts.map((p) => ({ x: p.x, y: p.y })), len: plan.total };
}
