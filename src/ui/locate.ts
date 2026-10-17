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

/** Robots and stations whose id contains the text (case-insensitive; "20487" or "101" is enough). Exact id first, then robots, then stations. With a `fleetId` only that fleet's robots and stations are searched ('all' or none = every fleet). */
export function findTargets(
  text: string,
  allRobots: Record<string, RobotTelemetry>,
  allStations: Station[],
  limit = 6,
  fleetId?: string,
): LocateHit[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const only = fleetId && fleetId !== 'all' ? fleetId : null;
  const robots = only ? Object.fromEntries(Object.entries(allRobots).filter(([, r]) => r.fleetId === only)) : allRobots;
  const stations = only ? allStations.filter((s) => s.fleets.includes(only)) : allStations;
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

/**
 * Locate something that may not have been reported yet (the page was just opened with `?focus=robot:AMR-007`, before the fleet's first report): runs at once when it is known, otherwise as
 * soon as it appears (for at most 20 s). Returns a function that cancels the wait.
 */
export function locateWhenKnown(id: string, kind: 'robot' | 'station'): () => void {
  const known = () =>
    kind === 'robot' ? !!store.getState().robots[id] : !!store.getState().nav?.stations.some((q) => q.id === id);
  if (known()) {
    locateTarget(id);
    return () => {};
  }
  let waiting = true;
  let later: ReturnType<typeof setTimeout> | undefined;
  const off = store.subscribe(() => {
    if (!waiting || !known()) return;
    waiting = false;
    off();
    later = setTimeout(() => locateTarget(id), 60); // the 3D scene gets the same report a moment later
  });
  const giveUp = setTimeout(() => {
    waiting = false;
    off();
  }, 20_000);
  return () => {
    waiting = false;
    off();
    clearTimeout(giveUp);
    clearTimeout(later);
  };
}

/** Select a robot or station and fly the Live Floor camera to it (leaving walk / follow mode, and clearing a fleet filter that would hide it). */
export function locateTarget(id: string) {
  const s = store.getState();
  if (s.cameraMode === 'walk' || s.cameraMode === 'follow') s.setCameraMode('orbit');
  const r = s.robots[id];
  if (r) {
    if (r.fleetId !== s.fleetId) {
      pending = id; // the robot's fleet is shown first, then the camera flies there
      s.setFleet(r.fleetId);
      s.setNav('fleet:' + r.fleetId);
      return;
    }
    handle.engine?.focusRobot(id);
    return;
  }
  const st = s.nav?.stations.find((q) => q.id === id);
  if (st && !st.fleets.includes(s.fleetId)) {
    const owner = st.fleets.find((f) => s.fleets.some((x) => x.id === f)) ?? st.fleets[0];
    if (owner) {
      pending = id; // the fleet that owns the station is shown first
      s.setFleet(owner);
      s.setNav('fleet:' + owner);
      return;
    }
  }
  s.selectStation(id);
  handle.engine?.focusStation(id);
}
