import { stagingProblems, cellRef } from './staging';
import { nodeOf } from './stations';
import { pointInPolygon } from './zones';
import type { MapData } from './types';

/** A problem found before publishing. `block` problems stop Publish (the map may be at work); the others are only shown. */
export interface MapProblem {
  level: 'block' | 'warn';
  title: string;
  detail?: string;
  stationId?: string;
}
const dist = (px: number, py: number, a: [number, number], b: [number, number]) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
};
/** The station is on the road network: a lane starts or ends at it, or one passes within a metre. */
export function onRoad(data: MapData, stationId: string): boolean {
  const s = data.stations.find((q) => q.id === stationId);
  const n = s && nodeOf(data, s);
  if (!s || !n) return false;
  if (data.lanes.some((l) => l.from === n.id || l.to === n.id)) return true;
  return data.lanes.some((l) => l.geom.some((g, i) => i > 0 && dist(n.x, n.y, l.geom[i - 1], g) <= 1));
}
/** The cell states Master Data keeps for an area (key "row-col"; a missing cell is available). */
export type CellStatesOf = (areaId: string) => Record<string, 'available' | 'reserved' | 'blocked' | 'filled'>;
/**
 * Publish gate (pure). `usedBy(stationId)` = the names of the published workflows that use a station; `cellStatesOf(areaId)` = what Master Data holds for a staging area.
 * BLOCKS: a station used by a published workflow was deleted; a station has no name or shares one or is not on a road; a road passes through a no-go zone; a staging area has bad values;
 * a staging area was deleted or made smaller while cells that would go are Filled or Reserved (Master Data owns those, and workflows rely on them).
 * Warns: a zone without a name; blocked cells that would go.
 */
export function publishProblems(
  next: MapData,
  previous: MapData | null,
  usedBy: (stationId: string) => string[],
  cellStatesOf: CellStatesOf = () => ({}),
): MapProblem[] {
  const out: MapProblem[] = [];
  const ids = new Set(next.stations.map((s) => s.id));
  for (const s of previous?.stations ?? [])
    if (!ids.has(s.id)) {
      const w = usedBy(s.id);
      if (w.length)
        out.push({
          level: 'block',
          title: `${s.id} · ${s.name} was deleted but workflows use it`,
          detail: `Used by ${w.join(', ')}. Put the station back or change those workflows first.`,
          stationId: s.id,
        });
    }
  const seen = new Map<string, string>();
  for (const s of next.stations) {
    const key = s.name.trim().toLowerCase();
    if (!key) out.push({ level: 'block', title: `${s.id} has no name`, stationId: s.id });
    else if (seen.has(key))
      out.push({ level: 'block', title: `${s.id} and ${seen.get(key)} share the name “${s.name}”`, stationId: s.id });
    else seen.set(key, s.id);
    if (s.onLane !== false && !onRoad(next, s.id))
      out.push({
        level: 'block',
        title: `${s.id} · ${s.name} is set On route but no route reaches it`,
        detail: 'Connect it with a route (the Routes tab), or set its placement to Off route.',
        stationId: s.id,
      });
  }
  const noGo = next.zones.filter((z) => z.type === 'no-go');
  if (noGo.length)
    for (const r of next.roads) {
      const lanes = next.lanes.filter((l) => r.laneIds.includes(l.id));
      const hit = noGo.find((z) => lanes.some((l) => l.geom.some(([x, y]) => pointInPolygon(x, y, z.polygon))));
      if (hit)
        out.push({
          level: 'block',
          title: `${r.name} passes through the no-go zone “${hit.name}”`,
          detail: 'Robots never enter a no-go zone: move the road or the zone.',
        });
    }
  for (const a of next.stagingAreas)
    for (const [field, text] of Object.entries(stagingProblems(next, a)))
      out.push({ level: 'block', title: `${a.name}: ${text}`, detail: `Field: ${field}` });
  for (const old of previous?.stagingAreas ?? []) {
    const now = next.stagingAreas.find((a) => a.id === old.id);
    const states = cellStatesOf(old.id);
    const lost: { ref: string; state: string }[] = [];
    for (let r = 1; r <= old.rows; r++)
      for (let c = 1; c <= old.cols; c++)
        if (!now || r > now.rows || c > now.cols) {
          const st = states[`${r}-${c}`];
          if (st && st !== 'available') lost.push({ ref: cellRef(r, c), state: st });
        }
    const holding = lost.filter((l) => l.state === 'filled' || l.state === 'reserved'),
      blocked = lost.filter((l) => l.state === 'blocked');
    if (holding.length)
      out.push({
        level: 'block',
        title: `${old.name} ${now ? 'was made smaller' : 'was deleted'} but ${holding.length} cell${holding.length === 1 ? '' : 's'} that would go ${holding.length === 1 ? 'is' : 'are'} Filled or Reserved`,
        detail: `${holding
          .slice(0, 6)
          .map((l) => `${l.ref} (${l.state})`)
          .join(', ')}${holding.length > 6 ? '…' : ''}. Empty them in Master Data first.`,
      });
    else if (blocked.length)
      out.push({
        level: 'warn',
        title: `${old.name}: ${blocked.length} Blocked cell${blocked.length === 1 ? '' : 's'} will be removed`,
        detail: blocked
          .slice(0, 6)
          .map((l) => l.ref)
          .join(', '),
      });
  }
  for (const z of next.zones) if (!z.name.trim()) out.push({ level: 'warn', title: `A ${z.type} zone has no name` });
  return out;
}
