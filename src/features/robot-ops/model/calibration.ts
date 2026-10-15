import type { CalibrationKind, CalibrationStatus } from './types';
import { ins } from '../labels';

/** The calibrations a robot has and how they are described. A new calibration = one entry here (and the robot service must know the kind). */
export const CALIBRATIONS: { kind: CalibrationKind; readonly title: string; readonly detail: string }[] = [
  {
    kind: 'sensor',
    get title() {
      return ins.calibrations.sensor.title;
    },
    get detail() {
      return ins.calibrations.sensor.detail;
    },
  },
  {
    kind: 'steering',
    get title() {
      return ins.calibrations.steering.title;
    },
    get detail() {
      return ins.calibrations.steering.detail;
    },
  },
];

const MIN = 60_000,
  H = 60 * MIN,
  DAY = 24 * H;
/** "Calibrated 120 days ago", "Never calibrated", "Calibrating...". */
export function describeCalibration(s: Pick<CalibrationStatus, 'lastRunAt' | 'running'>, now: number): string {
  if (s.running) return ins.calibrated.running;
  if (s.lastRunAt === null) return ins.calibrated.never;
  const d = Math.max(0, now - s.lastRunAt);
  if (d < MIN) return ins.calibrated.justNow;
  if (d < H) return ins.calibrated.minutes(Math.floor(d / MIN));
  if (d < DAY) {
    return ins.calibrated.hours(Math.floor(d / H));
  }
  return ins.calibrated.days(Math.floor(d / DAY));
}

/** Why a calibration cannot be started right now ('' = it can). The robot has to be online and not already doing one. */
export function calibrationBlocked(robotOnline: boolean, anyRunning: boolean): string {
  if (!robotOnline) return ins.calibrated.offline;
  if (anyRunning) return ins.calibrated.busy;
  return '';
}
