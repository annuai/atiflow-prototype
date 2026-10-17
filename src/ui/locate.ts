import { store } from '@/core/store';
import type { RobotTelemetry, Station } from '@/core/types';
import { handle } from '@/ui/engineHandle';
import { copy } from './copy';

export interface LocateHit {
  kind: 'robot' | 'station';
  id: string;
  title: string;
  sub: string;
}

/** Robots and stations whose id contains the text (case-insensitive; "20487" or "101" is enough). Exact id first, then robots, then stations. */
export function findTargets(
  text: string,
  robots: Record<string, RobotTelemetry>,
  stations: Station[],
  limit = 6,
): LocateHit[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const hits: (LocateHit & { rank: number })[] = [];
  for (const r of Object.values(robots)) {
    const i = r.id.toLowerCase().indexOf(q);
    if (i >= 0)
      hits.push({
        kind: 'robot',
        id: r.id,
        title: r.id,
        sub: copy.locate.robotSub(copy.states[r.state] ?? r.state),
        rank: r.id.toLowerCase() === q ? 0 : 2 + i,
      });
  }
  for (const r of Object.values(robots)) {
    const id = r.task?.id;
    if (id && id.toLowerCase().includes(q))
      hits.push({
        kind: 'robot',
        id: r.id,
        title: id,
        sub: copy.locate.tripSub(r.id, r.task!.to ?? ''),
        rank: id.toLowerCase() === q ? 0 : 2,
      });
  }
  for (const s of stations) {
    const i = s.id.toLowerCase().indexOf(q);
    if (i >= 0)
      hits.push({
        kind: 'station',
        id: s.id,
        title: s.id,
        sub: copy.locate.stationSub(s.name),
        rank: s.id.toLowerCase() === q ? 0 : 100 + i,
      });
  }
  return hits
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ rank, ...h }) => (void rank, h));
}

let pending: string | null = null;
/** A locate that had to wait for another scene to be shown (the target belongs to another fleet's map); the Live Floor takes it once that scene is on screen. */
export function takePendingLocate(): string | null {
  const p = pending;
  pending = null;
  return p;
}

/** Select a robot or station and fly the Live Floor camera to it (leaving walk / follow mode, and clearing a fleet filter that would hide it). */
export function locateTarget(id: string) {
  const s = store.getState();
  if (s.cameraMode === 'walk' || s.cameraMode === 'follow') s.setCameraMode('orbit');
  const r = s.robots[id];
  if (r) {
    if (s.fleetId !== 'all' && r.fleetId !== s.fleetId) {
      pending = id; // the whole floor is shown first, then the camera flies there
      s.setFleet('all');
      s.setNav('live');
      return;
    }
    handle.engine?.focusRobot(id);
    return;
  }
  const st = s.nav?.stations.find((q) => q.id === id);
  if (st && s.fleetId !== 'all' && !st.fleets.includes(s.fleetId)) {
    pending = id;
    s.setFleet('all');
    s.setNav('live');
    return;
  }
  s.selectStation(id);
  handle.engine?.focusStation(id);
}
