import { text } from '../text';
import { stagingProblems, cellRef } from './staging';
import { routable } from './connect';
import { nodeOf } from './stations';
import { pointInPolygon } from './zones';
import { zoneType } from './zoneTypes';
import type { MapData } from './types';

/** A problem found before publishing. `block` problems stop Publish (the map may be at work); the others are only shown. */
export interface MapProblem {
  level: 'block' | 'warn';
  title: string;
  detail?: string;
  stationId?: string;
}
/** A cell state in words, in the language in use (the id itself when it has no text). */
const stateWord = (s: string): string => (text.cellStates as Record<string, string | undefined>)[s] ?? s;
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
/** An imported station that was never given a position blocks Publish. */
const unplacedProblem = (s: MapData['stations'][number]): MapProblem[] =>
  s.unplaced
    ? [
        {
          level: 'block',
          title: text.problems.unplaced(s.id, s.name),
          detail: text.problems.unplacedDetail,
          stationId: s.id,
        },
      ]
    : [];
/** The cell states Master Data keeps for an area (key "row-col"; a missing cell is available). */
export type CellStatesOf = (areaId: string) => Record<string, 'available' | 'reserved' | 'blocked' | 'filled'>;
/** A station the previous version had and this one does not, while a published workflow still uses it. */
function deletedStationProblems(next: MapData, previous: MapData | null, usedBy: (stationId: string) => string[]) {
  const out: MapProblem[] = [];
  const ids = new Set(next.stations.map((s) => s.id));
  for (const s of previous?.stations ?? [])
    if (!ids.has(s.id)) {
      const w = usedBy(s.id);
      if (w.length)
        out.push({
          level: 'block',
          title: text.problems.deleted(s.id, s.name),
          detail: text.problems.deletedDetail(w.join(', ')),
          stationId: s.id,
        });
    }
  return out;
}

/** Staging cells that would go because their area was deleted or made smaller: Filled / Reserved block, Blocked only warns. */
function lostCellProblems(next: MapData, previous: MapData | null, cellStatesOf: CellStatesOf) {
  const out: MapProblem[] = [];
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
        title: text.problems.cellsLost(old.name, !!now, holding.length),
        detail: text.problems.cellsLostDetail(
          `${holding
            .slice(0, 6)
            .map((l) => `${l.ref} (${stateWord(l.state)})`)
            .join(', ')}${holding.length > 6 ? '…' : ''}`,
        ),
      });
    else if (blocked.length)
      out.push({
        level: 'warn',
        title: text.problems.blockedGo(old.name, blocked.length),
        detail: blocked
          .slice(0, 6)
          .map((l) => l.ref)
          .join(', '),
      });
  }
  return out;
}

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
  out.push(...deletedStationProblems(next, previous, usedBy));
  const seen = new Map<string, string>();
  const network = routable(next); // an off-route station is joined to the route on the fly
  for (const s of next.stations) {
    out.push(...unplacedProblem(s));
    const key = s.name.trim().toLowerCase();
    if (!key) out.push({ level: 'block', title: text.problems.noName(s.id), stationId: s.id });
    else if (seen.has(key))
      out.push({ level: 'block', title: text.problems.shareName(s.id, seen.get(key) ?? '', s.name), stationId: s.id });
    else seen.set(key, s.id);
    if (s.onLane !== false && !onRoad(network, s.id))
      out.push({
        level: 'block',
        title: text.problems.notReached(s.id, s.name),
        detail: text.problems.notReachedDetail,
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
          title: text.problems.throughNoGo(r.name, hit.name),
          detail: text.problems.throughNoGoDetail,
        });
    }
  for (const a of next.stagingAreas)
    for (const [field, problem] of Object.entries(stagingProblems(next, a)))
      out.push({ level: 'block', title: `${a.name}: ${problem}`, detail: text.problems.field(field) });
  out.push(...lostCellProblems(next, previous, cellStatesOf));
  for (const z of next.zones)
    if (!z.name.trim()) out.push({ level: 'warn', title: text.problems.zoneNoName(zoneType(z.type).label) });
  return out;
}
