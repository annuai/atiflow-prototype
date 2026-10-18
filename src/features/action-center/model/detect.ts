import type { RobotTelemetry } from '@/core/types';
import { localized } from '@/i18n';
import type { Candidate, Thresholds } from './types';

/** Pure: what is asking for help right now. Nothing here knows about React, storage or the simulator: it reads telemetry (the same for a real fleet). */
const RULE_CODES = ['FORBIDDEN_ZONE', 'FLEET_BOUNDARY', 'OFF_LANE', 'WRONG_WAY', 'TRAFFIC_VIOLATION'];

const D = () => localized('insights').actionCenter.detect;
/** Getters, so the text follows the language in use when a call is made. */
const SUGGESTION = {
  get blocked() {
    return localized('insights').actionCenter.suggestion.blocked;
  },
  get fault() {
    return localized('insights').actionCenter.suggestion.fault;
  },
  get deadlock() {
    return localized('insights').actionCenter.suggestion.deadlock;
  },
  get stuck() {
    return localized('insights').actionCenter.suggestion.stuck;
  },
  get battery() {
    return localized('insights').actionCenter.suggestion.battery;
  },
  get rule() {
    return localized('insights').actionCenter.suggestion.rule;
  },
};

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
const mins = (s: number) => (s < 60 ? D().sec(Math.round(s)) : D().min(Math.floor(s / 60)));

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
      title: D().deadlockTitle(ring.length),
      reason: D().deadlockReason(ring.join(', ')),
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
        title: D().blocked(r.id),
        reason: r.alerts?.find((a) => a.code === 'OBSTACLE')?.msg ?? D().blockedFallback,
        suggestion: SUGGESTION.blocked,
      });
    if (r.state === 'error')
      out.push({
        ...base,
        key: `fault:${r.id}`,
        kind: 'fault',
        severity: 'critical',
        title: D().error(r.id),
        reason: r.alerts?.[0]?.msg ?? D().errorFallback,
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
          title: D().stuck(r.id, mins(s)),
          reason: r.alerts?.find((a) => a.code.endsWith('_WAIT'))?.msg ?? D().stuckFallback,
          suggestion: SUGGESTION.stuck,
        });
    }
    if (r.battery < th.batteryLow && r.state !== 'charging' && r.state !== 'offline' && r.task?.type !== 'charge')
      out.push({
        ...base,
        key: `battery:${r.id}`,
        kind: 'battery',
        severity: r.battery < 10 ? 'critical' : 'warn',
        title: D().battery(r.id),
        reason: D().batteryReason(Math.round(r.battery)),
        suggestion: SUGGESTION.battery,
      });
    for (const a of r.alerts ?? [])
      if (RULE_CODES.includes(a.code))
        out.push({
          ...base,
          key: `rule:${r.id}:${a.code}`,
          kind: 'rule',
          severity: 'critical',
          title: D().rule(r.id),
          reason: a.msg,
          suggestion: SUGGESTION.rule,
        });
  }
  return out;
}
