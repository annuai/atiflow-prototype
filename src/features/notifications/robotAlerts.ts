import type { RobotTelemetry } from '@/core/types';
import type { NewNotification } from './types';

export const STUCK_AFTER_S = 90, BATTERY_LOW = 25, BATTERY_REARM = 40;
const mins = (s: number) => (s < 90 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`);

/**
 * Turns the robot feed into notifications for a supervisor: one when a robot becomes blocked or faulty, when it has been stuck waiting for a long time,
 * and when its battery runs low. Each problem notifies once and is armed again after it has cleared. Pure: feed it telemetry, read what is new.
 */
export class RobotAlertWatcher {
  private active = new Map<string, number>(); private waitingSince = new Map<string, number>();
  constructor(private fleetName: (fleetId: string) => string = (id) => id) {}
  ingest(now: number, robots: RobotTelemetry[]): NewNotification[] {
    const out: NewNotification[] = []; const seen = new Set<string>();
    const raise = (r: RobotTelemetry, kind: 'blocked' | 'error' | 'stuck' | 'battery', n: Omit<NewNotification, 'id' | 'kind' | 'at' | 'actions'>) => {
      const key = `${r.id}:${kind}`; seen.add(key); if (this.active.has(key)) return;
      this.active.set(key, now);
      out.push({ id: `${key}:${now}`, kind, at: now, actions: [{ kind: 'locate', robotId: r.id }, { kind: 'live-floor' }], ...n });
    };
    for (const r of robots) {
      const where = this.fleetName(r.fleetId);
      if (r.state === 'blocked') raise(r, 'blocked', { level: 'critical', title: `${r.id} is blocked`, body: `${r.alerts?.find((a) => a.code === 'OBSTACLE')?.msg ?? 'Something is in its way'} · ${where}` });
      if (r.state === 'error') raise(r, 'error', { level: 'critical', title: `${r.id} has an error`, body: `${r.alerts?.[0]?.msg ?? 'The robot reported a fault'} · ${where}` });
      if (r.state === 'waiting') {
        const since = this.waitingSince.get(r.id) ?? now; this.waitingSince.set(r.id, since); const s = (now - since) / 1000;
        if (s >= STUCK_AFTER_S) raise(r, 'stuck', { level: 'warn', title: `${r.id} has been waiting for ${mins(s)}`, body: `${r.alerts?.find((a) => a.code.endsWith('_WAIT'))?.msg ?? 'Waiting for the road ahead'} · ${where}` });
      } else this.waitingSince.delete(r.id);
      if (r.battery < BATTERY_LOW && r.state !== 'charging' && r.task?.type !== 'charge') raise(r, 'battery', { level: 'warn', title: `${r.id} battery is at ${Math.round(r.battery)}%`, body: `Not heading to a charger · ${where}` });
      else if (r.battery >= BATTERY_REARM || r.state === 'charging') seen.delete(`${r.id}:battery`);
    }
    // a problem that is gone is armed again (the battery one only after the robot has charged up)
    for (const key of [...this.active.keys()]) if (!seen.has(key) && !(key.endsWith(':battery') && this.isLow(key, robots))) this.active.delete(key);
    return out;
  }
  private isLow(key: string, robots: RobotTelemetry[]) { const r = robots.find((x) => x.id === key.split(':')[0]); return !!r && r.battery < BATTERY_REARM && r.state !== 'charging'; }
}
