import type { RobotTelemetry } from '@/core/types';
import type { Candidate, Thresholds } from './types';

/** Pure: what is asking for help right now. Nothing here knows about React, storage or the simulator: it reads telemetry (the same for a real fleet). */
export const RULE_CODES = ['FORBIDDEN_ZONE', 'FLEET_BOUNDARY', 'OFF_LANE', 'WRONG_WAY', 'TRAFFIC_VIOLATION'];

export const SUGGESTION = {
  blocked:
    'Walk to the robot, check the path ahead and remove what is in its way. It continues by itself once the way is clear.',
  fault:
    'Read the error on the robot, reset it and watch it for a moment. If the error comes back, take the robot out of service.',
  deadlock: 'These robots are waiting for each other. Move one of them out of the way by hand so the others can pass.',
  stuck: 'The robot is waiting for the road ahead. See who it waits for; if something physical holds it up, clear it.',
  battery: 'Send the robot to a charger, or swap it for a charged one before it stops on the route.',
  rule: 'The robot left the path it is allowed on. Stop it and guide it back to its lane.',
} as const;

/** Strongly connected groups of 2+ waiting robots that wait for each other (Tarjan). Each group is one deadlock ring. */
export function deadlockRings(robots: RobotTelemetry[]): string[][] {
  const waiting = new Map(robots.filter((r) => r.state === 'waiting' && r.waitsOn?.length).map((r) => [r.id, r]));
  const index = new Map<string, number>(),
    low = new Map<string, number>(),
    onStack = new Set<string>(),
    stack: string[] = [],
    out: string[][] = [];
  let i = 0;
  const visit = (v: string) => {
    index.set(v, i);
    low.set(v, i);
    i++;
    stack.push(v);
    onStack.add(v);
    for (const w of waiting.get(v)!.waitsOn!) {
      if (!waiting.has(w)) continue;
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) === index.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) out.push(comp.sort());
    }
  };
  for (const id of waiting.keys()) if (!index.has(id)) visit(id);
  return out;
}

const placeOf = (r: RobotTelemetry): string | undefined =>
  r.atStation ?? r.traffic?.zoneId ?? r.task?.next ?? undefined;
const mins = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min`);

/** `waitedS(id)` = how long the robot has been waiting without moving on (the engine tracks it). */
export function detect(robots: RobotTelemetry[], waitedS: (id: string) => number, th: Thresholds): Candidate[] {
  const out: Candidate[] = [];
  const byId = new Map(robots.map((r) => [r.id, r]));
  const rings = deadlockRings(robots);
  const inRing = new Set(rings.flat());
  for (const ring of rings) {
    const first = byId.get(ring[0])!;
    out.push({
      key: `deadlock:${ring.join('+')}`,
      kind: 'deadlock',
      severity: 'critical',
      robots: ring,
      fleetId: first.fleetId,
      place: placeOf(first),
      title: `${ring.length} robots are waiting for each other`,
      reason: `${ring.join(', ')} each wait for the next one: none of them can move.`,
      suggestion: SUGGESTION.deadlock,
    });
  }
  for (const r of robots) {
    const base = { robots: [r.id], fleetId: r.fleetId, place: placeOf(r) };
    if (r.state === 'blocked')
      out.push({
        ...base,
        key: `blocked:${r.id}`,
        kind: 'blocked',
        severity: 'critical',
        title: `${r.id} is blocked`,
        reason: r.alerts?.find((a) => a.code === 'OBSTACLE')?.msg ?? 'Something is in its way',
        suggestion: SUGGESTION.blocked,
      });
    if (r.state === 'error')
      out.push({
        ...base,
        key: `fault:${r.id}`,
        kind: 'fault',
        severity: 'critical',
        title: `${r.id} has an error`,
        reason: r.alerts?.[0]?.msg ?? 'The robot reported a fault',
        suggestion: SUGGESTION.fault,
      });
    if (r.state === 'waiting' && !inRing.has(r.id)) {
      const s = waitedS(r.id);
      if (s >= th.waitCallS)
        out.push({
          ...base,
          key: `stuck:${r.id}`,
          kind: 'stuck',
          severity: s >= th.waitUrgentS ? 'critical' : 'warn',
          title: `${r.id} has been waiting for ${mins(s)}`,
          reason: r.alerts?.find((a) => a.code.endsWith('_WAIT'))?.msg ?? 'Waiting for the road ahead',
          suggestion: SUGGESTION.stuck,
        });
    }
    if (r.battery < th.batteryLow && r.state !== 'charging' && r.state !== 'offline' && r.task?.type !== 'charge')
      out.push({
        ...base,
        key: `battery:${r.id}`,
        kind: 'battery',
        severity: r.battery < 10 ? 'critical' : 'warn',
        title: `${r.id} has a low battery`,
        reason: `${Math.round(r.battery)}% left and it is not heading to a charger`,
        suggestion: SUGGESTION.battery,
      });
    for (const a of r.alerts ?? [])
      if (RULE_CODES.includes(a.code))
        out.push({
          ...base,
          key: `rule:${r.id}:${a.code}`,
          kind: 'rule',
          severity: 'critical',
          title: `${r.id} is off its allowed path`,
          reason: a.msg,
          suggestion: SUGGESTION.rule,
        });
  }
  return out;
}
