import type { RobotTelemetry } from '../../core/types';
import { STUCK_ALERT } from './constants';
import { reportedPose } from './footprint';
import type { World } from './world';

/** What the fleet reports about every robot right now (the telemetry contract of `core/types.ts`). */
export function snapshotOf(w: World): RobotTelemetry[] {
  const ts = Date.now();
  return w.bots.map((b) => {
    const moving =
      (b.state === 'moving' || b.state === 'waiting' || b.state === 'blocked' || b.state === 'error') && b.plan;
    const traffic = b.waitingZone
      ? { zoneId: b.waitingZone, status: 'waiting' as const }
      : b.holds.size || b.locks.size
        ? { zoneId: [...b.holds.keys(), ...b.locks.keys()][0], status: 'inside' as const }
        : null;
    const alerts: NonNullable<RobotTelemetry['alerts']> = [];
    const who = b.waitsOn.length ? ` (${b.waitsOn.slice(0, 2).join(', ')} first)` : '';
    if (b.state === 'error') alerts.push({ code: 'FAULT', severity: 'critical', msg: 'Fault: needs someone on site' });
    if (b.state === 'blocked') alerts.push({ code: 'OBSTACLE', severity: 'critical', msg: 'Path obstructed' });
    if (b.battery < 25) alerts.push({ code: 'LOW_BATT', severity: 'warn', msg: 'Low battery' });
    if (b.handedOver > b.s)
      alerts.push({
        code: 'ZONE_HANDOVER',
        severity: 'warn',
        msg: 'Zone handed over to another robot to break a deadlock',
      });
    if (b.waitingZone) alerts.push({ code: 'TRAFFIC_WAIT', severity: 'info', msg: `Waiting for ${b.waitingZone}` });
    else if (b.state === 'waiting' && b.waitReason === 'intersection')
      alerts.push({
        code: 'INTERSECTION_WAIT',
        severity: 'info',
        msg: `Waiting for the intersection to clear${who}`,
      });
    else if (b.state === 'waiting' && b.waitReason === 'headway')
      alerts.push({
        code: 'HEADWAY_WAIT',
        severity: 'info',
        msg: b.waitsOn.length ? `Queued behind ${b.waitsOn[0]}` : 'Queued behind another robot',
      });
    if (b.state === 'waiting' && b.waitSince >= 0 && w.time - b.waitSince > STUCK_ALERT)
      alerts.push({
        code: 'STUCK',
        severity: 'warn',
        msg: `Waiting for ${Math.round((w.time - b.waitSince) / 60)} min, needs a look`,
      });
    return {
      id: b.id,
      model: b.model,
      fleetId: b.fleetId,
      siteId: w.siteId,
      pose: reportedPose(b),
      speed: b.speed,
      state: b.state,
      battery: Math.round(b.battery),
      payload: b.attached ? b.payload : null,
      trailer: b.trailer ? { x: b.trailer.x, y: b.trailer.y, theta: b.trailer.th } : null,
      task: b.task,
      path: moving ? [b.pos, ...b.plan!.pts.filter((_, i) => b.plan!.cum[i] > b.s)] : [],
      laneId: b.lane,
      traffic,
      waitReason: b.waitReason,
      waitsOn: b.state === 'waiting' ? [...b.waitsOn] : [],
      odometer: { empty: Math.round(b.odoEmpty * 10) / 10, loaded: Math.round(b.odoLoaded * 10) / 10 },
      energyKWh: Math.round(b.energyKWh * 1000) / 1000,
      atStation:
        b.stationId && (b.state === 'working' || b.state === 'charging' || b.state === 'idle') ? b.stationId : null,
      alerts,
      ts,
    };
  });
}
