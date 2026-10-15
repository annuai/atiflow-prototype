import type { CalibrationKind, CalibrationStatus } from './types';

/** The calibrations a robot has and how they are described. A new calibration = one entry here (and the robot service must know the kind). */
export const CALIBRATIONS: { kind: CalibrationKind; title: string; detail: string }[] = [
  { kind: 'sensor', title: 'Sensor Calibration', detail: 'LiDAR and cameras geometric sensor offsets' },
  { kind: 'steering', title: 'Steering Calibration', detail: 'Dual differential encoder steering offsets' },
];

const MIN = 60_000,
  H = 60 * MIN,
  DAY = 24 * H;
/** "Calibrated 120 days ago", "Never calibrated", "Calibrating...". */
export function describeCalibration(s: Pick<CalibrationStatus, 'lastRunAt' | 'running'>, now: number): string {
  if (s.running) return 'Calibrating…';
  if (s.lastRunAt === null) return 'Never calibrated';
  const d = Math.max(0, now - s.lastRunAt);
  if (d < MIN) return 'Calibrated just now';
  if (d < H) return `Calibrated ${Math.floor(d / MIN)} min ago`;
  if (d < DAY) {
    const h = Math.floor(d / H);
    return `Calibrated ${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  }
  const days = Math.floor(d / DAY);
  return `Calibrated ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** Why a calibration cannot be started right now ('' = it can). The robot has to be online and not already doing one. */
export function calibrationBlocked(robotOnline: boolean, anyRunning: boolean): string {
  if (!robotOnline) return 'The robot has to be online to calibrate.';
  if (anyRunning) return 'A calibration is already running.';
  return '';
}
