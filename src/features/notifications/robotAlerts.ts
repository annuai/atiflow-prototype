import type { RobotTelemetry } from '@/core/types';
import { localized } from '@/i18n';
import type { NewNotification } from './types';
import { DEFAULT_ALERTS, type AlertPrefs } from '@/features/preferences';

export const STUCK_AFTER_S = 90,
  BATTERY_LOW = 25,
  BATTERY_REARM = 40;
const T = () => localized('insights').notifications.robot;
const mins = (s: number) => (s < 90 ? T().sec(Math.round(s)) : T().min(Math.round(s / 60)));

/**
 * Turns the robot feed into notifications for a supervisor: one when a robot becomes blocked or faulty, when it has been stuck waiting for a long time,
 * and when its battery runs low. Each problem notifies once and is armed again after it has cleared. Pure: feed it telemetry, read what is new.
 */
export class RobotAlertWatcher {
  private active = new Map<string, number>();
  private waitingSince = new Map<string, number>();
  /** `prefs` is read on every batch, so a changed preference applies at once (which problems notify, how long a wait or how low a battery has to be). */
  constructor(
    private fleetName: (fleetId: string) => string = (id) => id,
    private prefs: () => AlertPrefs = () => DEFAULT_ALERTS,
  ) {}
  ingest(now: number, robots: RobotTelemetry[]): NewNotification[] {
    const out: NewNotification[] = [];
    const seen = new Set<string>();
    const P = this.prefs();
    const rearm = Math.max(BATTERY_REARM, P.batteryLow + 10);
    const raise = (
      r: RobotTelemetry,
      kind: 'blocked' | 'error' | 'stuck' | 'battery',
      n: Omit<NewNotification, 'id' | 'kind' | 'at' | 'actions'>,
    ) => {
      const key = `${r.id}:${kind}`;
      seen.add(key);
      if (this.active.has(key)) return;
      this.active.set(key, now);
      out.push({
        id: `${key}:${now}`,
        kind,
        at: now,
        actions: [{ kind: 'locate', robotId: r.id }, { kind: 'live-floor' }],
        ...n,
      });
    };
    for (const r of robots) {
      const where = this.fleetName(r.fleetId);
      if (r.state === 'blocked' && P.blocked)
        raise(r, 'blocked', {
          level: 'critical',
          title: T().blocked(r.id),
          body: `${r.alerts?.find((a) => a.code === 'OBSTACLE')?.msg ?? T().blockedFallback} · ${where}`,
        });
      if (r.state === 'error' && P.fault)
        raise(r, 'error', {
          level: 'critical',
          title: T().error(r.id),
          body: `${r.alerts?.[0]?.msg ?? T().errorFallback} · ${where}`,
        });
      if (r.state === 'waiting') {
        const since = this.waitingSince.get(r.id) ?? now;
        this.waitingSince.set(r.id, since);
        const s = (now - since) / 1000;
        if (P.stuck && s >= P.notifyAfterS)
          raise(r, 'stuck', {
            level: 'warn',
            title: T().stuck(r.id, mins(s)),
            body: `${r.alerts?.find((a) => a.code.endsWith('_WAIT'))?.msg ?? T().stuckFallback} · ${where}`,
          });
      } else this.waitingSince.delete(r.id);
      if (P.battery && r.battery < P.batteryLow && r.state !== 'charging' && r.task?.type !== 'charge')
        raise(r, 'battery', {
          level: 'warn',
          title: T().battery(r.id, Math.round(r.battery)),
          body: `${T().batteryBody} · ${where}`,
        });
      else if (r.battery >= rearm || r.state === 'charging') seen.delete(`${r.id}:battery`);
    }
    // a problem that is gone is armed again (the battery one only after the robot has charged up)
    for (const key of [...this.active.keys()])
      if (!seen.has(key) && !(key.endsWith(':battery') && this.isLow(key, robots, rearm))) this.active.delete(key);
    return out;
  }
  private isLow(key: string, robots: RobotTelemetry[], rearm: number) {
    const r = robots.find((x) => x.id === key.split(':')[0]);
    return !!r && r.battery < rearm && r.state !== 'charging';
  }
}
