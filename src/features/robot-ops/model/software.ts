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

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
/** "Sep 15, 2026". */
export const formatDate = (at: number) => DATE.format(at);
/** "Today, 10:15 AM", "Yesterday, 4:02 PM", otherwise the date; "Never" when null. */
export function formatCheck(at: number | null, now: number): string {
  if (at === null) return 'Never';
  if (sameDay(at, now)) return `Today, ${TIME.format(at)}`;
  if (sameDay(at, now - 86_400_000)) return `Yesterday, ${TIME.format(at)}`;
  return formatDate(at);
}
