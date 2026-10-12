import type { RobotTelemetry, Station } from '@/core/types';

export interface LocateHit { kind: 'robot' | 'station'; id: string; title: string; sub: string }

/** Robots and stations whose id contains the text (case-insensitive; "20487" or "101" is enough). Exact id first, then robots, then stations. */
export function findTargets(text: string, robots: Record<string, RobotTelemetry>, stations: Station[], limit = 6): LocateHit[] {
  const q = text.trim().toLowerCase(); if (!q) return [];
  const hits: (LocateHit & { rank: number })[] = [];
  for (const r of Object.values(robots)) { const i = r.id.toLowerCase().indexOf(q); if (i >= 0) hits.push({ kind: 'robot', id: r.id, title: r.id, sub: `Robot · ${r.state}`, rank: r.id.toLowerCase() === q ? 0 : 2 + i }); }
  for (const s of stations) { const i = s.id.toLowerCase().indexOf(q); if (i >= 0) hits.push({ kind: 'station', id: s.id, title: s.id, sub: `Station · ${s.name}`, rank: s.id.toLowerCase() === q ? 0 : 100 + i }); }
  return hits.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id)).slice(0, limit).map(({ rank, ...h }) => (void rank, h));
}
