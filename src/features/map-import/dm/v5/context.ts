import type { MapData, MapRoad, RoadHeading } from '@/features/map-editor';
import type { NavNode } from '@/core/types';
import type { PyObj } from '../pyjson';
import type { Doc } from '../tree';

export type P = [number, number];
/** Our road points are rounded to 0.01 m: that much difference is not an edit. */
export const TOL = 0.0075;
export const near = (a: P, b: P, t = TOL) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= t;
export const HEADING: Record<RoadHeading, string> = { both: 'both', forward: 'forward', backward: 'backward' };

/** One line of the file as our roads hold it: all the pieces that share its id, in order. */
export interface Group {
  ext?: string;
  roads: MapRoad[];
  /** our node ids from the start of the line to its end */
  chain: string[];
  t1: P;
  t2: P;
  oneWay: boolean;
  heading: RoadHeading;
  name: string;
}
/** A line that was changed, added or removed; `oldChain` = the file's nodes that lay on it. */
export interface LineChange {
  id: string;
  oldChain: string[];
  group?: Group;
}

/** Everything the parts of the v5 patch share. */
export interface V5 {
  data: MapData;
  gmaj: Doc;
  attrs: Doc | null;
  graph: Doc;
  groups: Group[];
  node: Map<string, NavNode>;
  lines: PyObj;
  attrLines: PyObj;
  nodesInfo: PyObj;
  edgesInfo: PyObj;
  graphStations: PyObj;
  /** which file node each of our nodes is */
  fileNode: Map<string, string>;
  /** the file node of one of our nodes (a new one gets the next free id) */
  gid(ours: string): string;
}

/** Roads are cut where nodes lie on them; a line of the file is all the pieces with its id, joined in order. */
export function groupsOf(data: MapData): Group[] {
  const lane0 = (r: MapRoad) => data.lanes.find((l) => l.id === r.laneIds[0]);
  const byKey = new Map<string, MapRoad[]>();
  for (const r of data.roads) {
    if (r.extra?.access) continue;
    const ext = (r.extra?.dm as { externalId?: unknown } | undefined)?.externalId;
    const key = ext !== undefined ? `x${ext}` : `n${r.id}`;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  const out: Group[] = [];
  for (const [key, roads] of byKey) {
    const ends = roads
      .map((r) => ({ r, l: lane0(r) }))
      .filter((e): e is { r: MapRoad; l: NonNullable<ReturnType<typeof lane0>> } => !!e.l);
    if (!ends.length) continue;
    const tos = new Set(ends.map((e) => e.l.to));
    let cur = ends.find((e) => !tos.has(e.l.from)) ?? ends[0];
    const ordered = [cur];
    for (let i = 0; i < ends.length; i++) {
      const next = ends.find((e) => e !== cur && !ordered.includes(e) && e.l.from === cur.l.to);
      if (!next) break;
      ordered.push(next);
      cur = next;
    }
    const first = ordered[0].r,
      last = ordered[ordered.length - 1].r;
    out.push({
      ext: key.startsWith('x') ? key.slice(1) : undefined,
      roads: ordered.map((e) => e.r),
      chain: [ordered[0].l.from, ...ordered.map((e) => e.l.to)],
      t1: first.points[0],
      t2: last.points[last.points.length - 1],
      oneWay: first.oneWay,
      heading: first.heading ?? 'both',
      name: first.name.replace(/ \(\d+\)$/, ''),
    });
  }
  return out;
}
