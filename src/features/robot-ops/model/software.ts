import { formatDate } from '@/i18n';
import { ins } from '../labels';
import type { SoftwareStatus } from './types';

/** "v3.2.1" -> [3, 2, 1] (anything that is not a number counts as 0). */
const parts = (v: string) =>
  v
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
/** Negative when `a` is older than `b`. */
export function compareVersions(a: string, b: string): number {
  const x = parts(a),
    y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
/** A newer version than the robot's is on offer (an unknown installed version counts as out of date). */
export const updateAvailable = (s: Pick<SoftwareStatus, 'installed' | 'latest'>) =>
  s.installed === null || compareVersions(s.installed, s.latest) < 0;

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
/** "Today, 10:15 AM", "Yesterday, 4:02 PM", otherwise the date; "Never" when null. */
export function formatCheck(at: number | null, now: number): string {
  if (at === null) return ins.time.never;
  if (sameDay(at, now)) return ins.time.today(formatDate(at, 'time'));
  if (sameDay(at, now - 86_400_000)) return ins.time.yesterday(formatDate(at, 'time'));
  return formatDate(at, 'date');
}
