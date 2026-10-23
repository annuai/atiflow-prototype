import { robotTypeByLabel } from '@/data/robotTypes';
import { planWith, tripContext } from './simulate';
import type { SlotId } from './approach/types';
import type { MapData } from './types';

/** One thing a check found. Station problems are reported once per station, route problems once per pair of stations. */
export type Finding =
  | { kind: 'unlinked'; robot: string; station: string }
  | { kind: 'no-node'; robot: string; station: string; slot: SlotId }
  | { kind: 'no-route'; robot: string; from: string; to: string }
  /** one per robot type: how many trips turn tighter than it can, and the worst of them */
  | { kind: 'tight'; robot: string; from: string; to: string; radius: number; need: number; count: number };
export interface RouteCheck {
  /** trips planned (pairs of stations x tasks x robot types) */
  checked: number;
  /** trips that can be driven (a tight turn still counts: it is a warning) */
  ok: number;
  stations: number;
  robots: string[];
  findings: Finding[];
}

export interface CheckOptions {
  fleet: string;
  /** robot type labels */
  robots: string[];
  onProgress?(done: number, total: number): void;
  shouldStop?(): boolean;
}
const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Plan a trip between every pair of stations for each robot type and say what cannot be driven: a station no road reaches, a station with no node that allows the trip, a pair with no route, and
 * (as a warning) a turn tighter than the robot can make. A station off the lane is tried every way it can be entered and left (Pick or Drop, Laden or Unladen). Runs in slices so the page stays
 * usable, and can be stopped.
 */
export async function checkRoutes(data: MapData, opt: CheckOptions): Promise<RouteCheck> {
  const stations = data.stations.filter((s) => !s.unplaced);
  const findings: Finding[] = [];
  const seen = new Set<string>();
  const add = (f: Finding, key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(f);
  };
  const tights = new Map<string, Extract<Finding, { kind: 'tight' }>>();
  const pairs = stations.flatMap((a) => stations.filter((b) => b.id !== a.id).map((b) => [a, b] as const));
  const total = pairs.length * opt.robots.length;
  let checked = 0,
    ok = 0,
    done = 0;
  for (const robot of opt.robots) {
    const ctx = tripContext(data, opt.fleet);
    const need = robotTypeByLabel(robot).capabilities.minTurnRadius;
    for (const [a, b] of pairs) {
      const ladens = a.onLane === false ? [false, true] : [false];
      const picks = b.onLane === false ? [false, true] : [false];
      let pairOk = true;
      for (const laden of ladens)
        for (const pick of picks) {
          checked++;
          const p = planWith(ctx, a.id, b.id, { laden, pick, robot });
          if (p.ok) {
            ok++;
            if (p.radius !== null && p.radius < need) {
              const was = tights.get(robot);
              if (!was || p.radius < was.radius)
                tights.set(robot, {
                  kind: 'tight',
                  robot,
                  from: a.id,
                  to: b.id,
                  radius: p.radius,
                  need,
                  count: (was?.count ?? 0) + 1,
                });
              else was.count++;
            }
          } else if (p.reason === 'unlinked')
            add({ kind: 'unlinked', robot, station: p.station }, `u:${robot}:${p.station}`);
          else if (p.reason === 'no-node')
            add({ kind: 'no-node', robot, station: p.station, slot: p.slot }, `n:${robot}:${p.station}:${p.slot}`);
          else if (p.reason === 'no-route') pairOk = false;
        }
      if (!pairOk) add({ kind: 'no-route', robot, from: a.id, to: b.id }, `r:${robot}:${a.id}:${b.id}`);
      if (++done % 25 === 0) {
        opt.onProgress?.(done, total);
        await yieldToUi();
        if (opt.shouldStop?.())
          return {
            checked,
            ok,
            stations: stations.length,
            robots: opt.robots,
            findings: [...findings, ...tights.values()],
          };
      }
    }
  }
  opt.onProgress?.(total, total);
  return { checked, ok, stations: stations.length, robots: opt.robots, findings: [...findings, ...tights.values()] };
}
