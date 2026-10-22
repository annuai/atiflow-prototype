import { normaliseData } from './seed';
import { addBox, addLine, addWorkArea, updateElement } from './structure/ops';
import type { MapData } from './types';

/**
 * A map "generated from a robot's run data". There is no real run data in the prototype, so this makes an EXAMPLE hall instead: outer walls, a grid of pillars, two rows of machines,
 * two Work areas and the path the robot "drove", all sized from the seed (the same robot and run give the same hall). It starts with no stations or routes: those are drawn in the Map
 * Editor. When a fleet manager can send real run data, replace this function with one that builds the walls from that data; nothing else changes.
 */
const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

export function generateSampleMap(o: { seed: string; routing: number }): MapData {
  const r = hash(o.seed);
  const W = Math.round(36 + r * 14), // 36..50 m
    H = Math.round(22 + hash(o.seed + 'h') * 8); // 22..30 m
  const x0 = 0,
    y0 = 0,
    x1 = W,
    y1 = H;
  let d: MapData = normaliseData({ nodes: [], lanes: [], stations: [], zones: [] });
  d = { ...d, p2p: o.routing === 2 };
  // the building
  d = addLine(
    d,
    'wall',
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0],
    ],
    { name: 'Outer wall', height: 6, thickness: 0.3 },
  ).data;
  // pillars on a grid
  for (let x = 6; x < W; x += 8)
    for (const y of [6, H - 6]) d = addBox(d, 'pillar', [x - 0.4, y - 0.4], [x + 0.4, y + 0.4]).data;
  // two rows of machines along the long walls, with the aisle between them free for robots
  for (let i = 0; i < 5; i++) {
    const x = 4 + i * ((W - 12) / 4);
    d = addBox(d, 'machine', [x, 2], [x + 4, 3.6], { label: `Line ${i + 1}`, name: `Machine ${i + 1}` }).data;
    d = addBox(d, 'machine', [x, H - 3.6], [x + 4, H - 2], { label: `Line ${i + 6}`, name: `Machine ${i + 6}` }).data;
  }
  // two Work areas: production on the left, staging on the right
  const mid = Math.round(W * 0.62);
  const a = addWorkArea(d, [
    [1, 1],
    [mid, 1],
    [mid, H - 1],
    [1, H - 1],
  ]);
  d = a.id ? updateElement(a.data, a.id, { name: 'Production', label: 'Production' }) : a.data;
  const b = addWorkArea(d, [
    [mid + 1, 1],
    [W - 1, 1],
    [W - 1, H - 1],
    [mid + 1, H - 1],
  ]);
  d = b.id ? updateElement(b.data, b.id, { name: 'Staging', label: 'Staging' }) : b.data;
  // the path the robot "drove" while it mapped: a loop through the aisle
  const ay = H / 2;
  d = {
    ...d,
    path: [
      [2, ay],
      [W - 2, ay],
      [W - 2, ay + 2],
      [2, ay + 2],
      [2, ay],
    ],
  };
  return d;
}
