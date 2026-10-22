import type { NavGraph } from '@/core/types';

/**
 * EXAMPLE data for the material heat map: how much material is waiting at each work station of a fleet's map (pieces). The numbers are made up from the station's id, so the same
 * station always gets the same value (and a few stations are much busier than the rest, which is what a real pile-up looks like). Replace `heatSpots` with live stock per location
 * (staging area cells, buffers at stations) when it exists: the map only needs `{id, name, x, y, units}`.
 */
export interface HeatSpot {
  id: string;
  name: string;
  /** site frame, metres */
  x: number;
  y: number;
  /** pieces waiting here */
  units: number;
  /** units against the busiest spot, 0..1 (what the colour shows) */
  level: number;
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

/** Work stations of a lane map with an example amount of waiting material each, busiest first. `seed` makes a different (but stable) picture per fleet. */
export function heatSpots(nav: NavGraph, seed: string): HeatSpot[] {
  const at = new Map(nav.nodes.map((n) => [n.id, n]));
  const spots = nav.stations
    .filter((s) => s.type !== 'charge' && s.type !== 'park')
    .flatMap((s) => {
      const n = at.get(s.nodeId);
      if (!n) return [];
      const v = hash(`${seed}:${s.id}`);
      return [{ id: s.id, name: s.name, x: n.x, y: n.y, units: Math.round(10 + 490 * v * v * v) }];
    });
  const max = Math.max(1, ...spots.map((s) => s.units));
  return spots.map((s) => ({ ...s, level: s.units / max })).sort((a, b) => b.units - a.units);
}

/** The colour of a level: green when little waits, through amber, to red when material piles up. */
export const heatColor = (level: number): string =>
  `hsl(${Math.round(140 * (1 - Math.min(1, Math.max(0, level))))} 80% 45%)`;

/** The busiest spots to mark with a pointer: the highest first, skipping any that sits closer than `gap` metres to one already chosen (so the pointers do not pile on top of each other). */
export function pickPointers(spots: HeatSpot[], n: number, gap: number): HeatSpot[] {
  const out: HeatSpot[] = [];
  for (const s of spots) {
    if (out.length >= n) break;
    if (out.every((o) => Math.hypot(o.x - s.x, o.y - s.y) >= gap)) out.push(s);
  }
  return out;
}
